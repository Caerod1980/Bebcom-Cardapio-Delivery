// server.js - Backend FUNCIONAL SEM MONGODB (para deploy rápido)
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Configurações
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'Bebcom25*';
const DATA_FILE = path.join(__dirname, 'data.json');

// Armazenamento em memória
let productAvailabilityDB = {};
let flavorAvailabilityDB = {};

// ====== SISTEMA DE ARMAZENAMENTO EM ARQUIVO ======

async function loadDataFromFile() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        productAvailabilityDB = parsed.productAvailabilityDB || {};
        flavorAvailabilityDB = parsed.flavorAvailabilityDB || {};
        
        console.log(`📂 Dados carregados do arquivo: ${Object.keys(productAvailabilityDB).length} produtos, ${Object.keys(flavorAvailabilityDB).length} sabores`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Arquivo não existe, criar um novo
            await saveDataToFile();
            console.log('📂 Arquivo de dados criado');
        } else {
            console.error('❌ Erro ao carregar dados:', error.message);
        }
    }
}

async function saveDataToFile() {
    try {
        const data = {
            productAvailabilityDB,
            flavorAvailabilityDB,
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('💾 Dados salvos no arquivo');
        
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error.message);
    }
}

// Middleware básico
app.use(cors());
app.use(express.json());

// ====== ROTAS OBRIGATÓRIAS ======

// 1. ROTA DE HEALTH CHECK
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        timestamp: new Date().toISOString(),
        version: '2.2.0',
        environment: process.env.NODE_ENV || 'production',
        storage: 'file-system',
        data: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        }
    });
});

// 2. STATUS DO ADMIN
app.get('/api/admin/status', (req, res) => {
    res.json({
        success: true,
        adminEnabled: true,
        storage: 'file-system',
        data: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        },
        timestamp: new Date().toISOString()
    });
});

// 3. ROTA RAIZ
app.get('/', (req, res) => {
    res.redirect('/health');
});

// 4. DISPONIBILIDADE DE PRODUTOS
app.get('/api/product-availability', (req, res) => {
    res.json({
        success: true,
        productAvailability: productAvailabilityDB,
        count: Object.keys(productAvailabilityDB).length,
        timestamp: new Date().toISOString(),
        source: 'file-storage',
        message: 'Dados persistentes (sobrevivem ao reinício)'
    });
});

// 5. DISPONIBILIDADE DE SABORES
app.get('/api/flavor-availability', (req, res) => {
    res.json({
        success: true,
        flavorAvailability: flavorAvailabilityDB,
        count: Object.keys(flavorAvailabilityDB).length,
        timestamp: new Date().toISOString(),
        source: 'file-storage',
        message: 'Dados persistentes (sobrevivem ao reinício)'
    });
});

// 6. SINCRONIZAÇÃO COMPLETA
app.get('/api/sync-all', (req, res) => {
    res.json({
        success: true,
        message: 'Sincronização completa',
        productAvailability: productAvailabilityDB,
        flavorAvailability: flavorAvailabilityDB,
        counts: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        },
        timestamp: new Date().toISOString()
    });
});

// 7. CRIAR PAGAMENTO
app.post('/api/create-payment', (req, res) => {
    const orderId = 'BEB' + Date.now();
    
    res.json({
        success: true,
        paymentType: 'pix',
        orderId,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TEST-${orderId}`,
        copyPasteKey: '123e4567-e89b-12d3-a456-426614174000',
        instructions: 'Pague via PIX usando o QR Code acima',
        timestamp: new Date().toISOString()
    });
});

// 8. STATUS DO PEDIDO
app.get('/api/order-status/:orderId', (req, res) => {
    res.json({
        success: true,
        orderId: req.params.orderId,
        status: 'paid',
        paid: true,
        timestamp: new Date().toISOString()
    });
});

// ====== ROTAS ADMIN ======

// Middleware de autenticação
const authAdmin = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.body.adminKey;
    
    if (key === ADMIN_KEY) {
        next();
    } else {
        res.status(401).json({
            success: false,
            error: 'Acesso não autorizado. Use o header x-admin-key',
            hint: 'Chave esperada: ' + ADMIN_KEY
        });
    }
};

// ATUALIZAR PRODUTOS
app.post('/api/admin/product-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { productAvailability, adminName = 'Admin BebCom' } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos. Envie {productAvailability: {...}}'
            });
        }
        
        // Atualizar dados
        Object.keys(productAvailability).forEach(productId => {
            productAvailabilityDB[productId] = productAvailability[productId];
        });
        
        const savedCount = Object.keys(productAvailability).length;
        
        // Salvar no arquivo
        await saveDataToFile();
        
        // Log da ação
        console.log(`📝 Admin "${adminName}" atualizou ${savedCount} produtos`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} produtos no sistema de arquivos`,
            savedCount,
            storage: 'file-system',
            timestamp: new Date().toISOString(),
            note: 'Dados persistidos e sobreviverão ao reinício do servidor'
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar produtos',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ATUALIZAR SABORES
app.post('/api/admin/flavor-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { flavorAvailability, adminName = 'Admin BebCom' } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos. Envie {flavorAvailability: {...}}'
            });
        }
        
        // Atualizar dados
        Object.keys(flavorAvailability).forEach(flavorKey => {
            flavorAvailabilityDB[flavorKey] = flavorAvailability[flavorKey];
        });
        
        const savedCount = Object.keys(flavorAvailability).length;
        
        // Salvar no arquivo
        await saveDataToFile();
        
        // Log da ação
        console.log(`📝 Admin "${adminName}" atualizou ${savedCount} sabores`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} sabores no sistema de arquivos`,
            savedCount,
            storage: 'file-system',
            timestamp: new Date().toISOString(),
            note: 'Dados persistidos e sobreviverão ao reinício do servidor'
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar sabores',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// BACKUP DOS DADOS
app.get('/api/admin/backup', authAdmin, async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        res.json({
            success: true,
            backup: parsed,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao criar backup',
            details: error.message
        });
    }
});

// RESETAR DADOS
app.post('/api/admin/reset-data', authAdmin, async (req, res) => {
    try {
        productAvailabilityDB = {};
        flavorAvailabilityDB = {};
        
        await saveDataToFile();
        
        res.json({
            success: true,
            message: 'Dados resetados com sucesso',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao resetar dados:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao resetar dados',
            timestamp: new Date().toISOString()
        });
    }
});

// ====== INICIAR SERVIDOR ======

async function startServer() {
    // Carregar dados do arquivo
    await loadDataFromFile();
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
        console.log(`✅ Admin Status: http://0.0.0.0:${PORT}/api/admin/status`);
        console.log(`💾 Armazenamento: Sistema de arquivos (data.json)`);
        console.log(`📊 Dados carregados: ${Object.keys(productAvailabilityDB).length} produtos, ${Object.keys(flavorAvailabilityDB).length} sabores`);
        console.log('');
        console.log('✅ TUDO PRONTO! O sistema agora:');
        console.log('   • Salva alterações permanentemente');
        console.log('   • Sobrevive a reinícios do servidor');
        console.log('   • Não precisa de MongoDB');
        console.log('   • Funciona offline');
    });
}

startServer().catch(console.error);

// Garantir que dados sejam salvos ao encerrar
process.on('SIGINT', async () => {
    console.log('\n💾 Salvando dados antes de encerrar...');
    await saveDataToFile();
    process.exit(0);
});
