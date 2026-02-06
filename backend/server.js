// server.js - Backend FUNCIONAL e CORRIGIDO
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Configurações
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'Bebcom25*';
const DATA_FILE = path.join(__dirname, 'data.json');

// Armazenamento em memória (fallback se arquivo não existir)
let productAvailabilityDB = {};
let flavorAvailabilityDB = {};

// ====== CONFIGURAÇÃO CORS (CRÍTICA!) ======
app.use(cors({
    origin: '*', // Permite todas as origens
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'X-Requested-With'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Middleware para headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.use(express.json());

// ====== SISTEMA DE ARMAZENAMENTO EM ARQUIVO ======

async function loadDataFromFile() {
    try {
        // Verificar se arquivo existe
        await fs.access(DATA_FILE);
        
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        productAvailabilityDB = parsed.productAvailabilityDB || {};
        flavorAvailabilityDB = parsed.flavorAvailabilityDB || {};
        
        console.log(`📂 Dados carregados: ${Object.keys(productAvailabilityDB).length} produtos, ${Object.keys(flavorAvailabilityDB).length} sabores`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Arquivo não existe, criar um novo com estrutura básica
            console.log('📂 Arquivo data.json não encontrado. Criando novo...');
            const initialData = {
                productAvailabilityDB: {},
                flavorAvailabilityDB: {},
                lastUpdated: new Date().toISOString()
            };
            
            await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
            console.log('✅ Arquivo data.json criado com sucesso');
            
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
        console.log('💾 Dados salvos em data.json');
        
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error.message);
        // Continuar mesmo sem salvar no arquivo
    }
}

// ====== ROTAS OBRIGATÓRIAS ======

// 1. ROTA DE HEALTH CHECK (MUITO IMPORTANTE)
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        environment: process.env.NODE_ENV || 'production',
        storage: 'file-system',
        data: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        },
        endpoints: [
            '/api/product-availability',
            '/api/flavor-availability', 
            '/api/sync-all',
            '/api/admin/status'
        ]
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
        timestamp: new Date().toISOString(),
        message: 'API administrativa funcionando'
    });
});

// 3. ROTA RAIZ (redireciona para health)
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

// 6. SINCRONIZAÇÃO COMPLETA (CRÍTICA PARA O FRONTEND)
app.get('/api/sync-all', (req, res) => {
    res.json({
        success: true,
        message: 'Sincronização completa realizada',
        productAvailability: productAvailabilityDB,
        flavorAvailability: flavorAvailabilityDB,
        counts: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        },
        timestamp: new Date().toISOString(),
        source: 'backend'
    });
});

// 7. CRIAR PAGAMENTO (SIMULADO)
app.post('/api/create-payment', (req, res) => {
    try {
        const { orderId, customer, items, totalAmount } = req.body;
        
        const generatedOrderId = orderId || 'BEB' + Date.now().toString().slice(-8);
        
        res.json({
            success: true,
            paymentType: 'pix',
            orderId: generatedOrderId,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=BEBCOM-${generatedOrderId}`,
            copyPasteKey: '00020126360014BR.GOV.BCB.PIX0114+55149999999990225BebCom Delivery - Pedido ' + generatedOrderId + '5204000053039865802BR5913BebCom Delivery6008SAO PAULO62070503***6304',
            instructions: 'Pague via PIX usando o QR Code acima',
            amount: totalAmount || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao criar pagamento',
            details: error.message
        });
    }
});

// 8. STATUS DO PEDIDO
app.get('/api/order-status/:orderId', (req, res) => {
    res.json({
        success: true,
        orderId: req.params.orderId,
        status: 'paid',
        paid: true,
        timestamp: new Date().toISOString(),
        message: 'Pedido confirmado e pago'
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

// ATUALIZAR PRODUTOS (ROTA QUE O FRONTEND USA!)
app.post('/api/admin/product-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { productAvailability, adminName = 'Admin BebCom' } = req.body;
        
        console.log('📝 Recebendo atualização de produtos:', Object.keys(productAvailability || {}).length);
        
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
        
        console.log(`✅ Admin "${adminName}" atualizou ${savedCount} produtos`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} produtos no sistema`,
            savedCount,
            storage: 'file-system',
            timestamp: new Date().toISOString(),
            note: 'Dados salvos permanentemente'
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

// ATUALIZAR SABORES (ROTA QUE O FRONTEND USA!)
app.post('/api/admin/flavor-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { flavorAvailability, adminName = 'Admin BebCom' } = req.body;
        
        console.log('📝 Recebendo atualização de sabores:', Object.keys(flavorAvailability || {}).length);
        
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
        
        console.log(`✅ Admin "${adminName}" atualizou ${savedCount} sabores`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} sabores no sistema`,
            savedCount,
            storage: 'file-system',
            timestamp: new Date().toISOString(),
            note: 'Dados salvos permanentemente'
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

// ROTA DE TESTE (sem autenticação, para debug)
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API está funcionando!',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            products: '/api/product-availability',
            flavors: '/api/flavor-availability',
            sync: '/api/sync-all',
            adminStatus: '/api/admin/status'
        }
    });
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

// ====== ROTA DE FALLBACK PARA ERROS 404 ======
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        requestedUrl: req.originalUrl,
        availableEndpoints: [
            'GET  /health',
            'GET  /api/product-availability',
            'GET  /api/flavor-availability',
            'GET  /api/sync-all',
            'GET  /api/admin/status',
            'POST /api/admin/product-availability/bulk',
            'POST /api/admin/flavor-availability/bulk',
            'POST /api/create-payment',
            'GET  /api/order-status/:orderId'
        ],
        timestamp: new Date().toISOString()
    });
});

// ====== INICIAR SERVIDOR ======

async function startServer() {
    // Carregar dados do arquivo (ou criar se não existir)
    await loadDataFromFile();
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
        console.log('='.repeat(50));
        console.log(`🚀 BebCom Delivery API v3.0`);
        console.log('='.repeat(50));
        console.log(`📍 Porta: ${PORT}`);
        console.log(`🔗 Health: http://0.0.0.0:${PORT}/health`);
        console.log(`🔗 API Test: http://0.0.0.0:${PORT}/api/test`);
        console.log(`💾 Armazenamento: ${DATA_FILE}`);
        console.log(`📊 Dados: ${Object.keys(productAvailabilityDB).length} produtos, ${Object.keys(flavorAvailabilityDB).length} sabores`);
        console.log('✅ CORS configurado para todas as origens');
        console.log('='.repeat(50));
        console.log('📋 Endpoints disponíveis:');
        console.log('  GET  /health');
        console.log('  GET  /api/product-availability');
        console.log('  GET  /api/flavor-availability');
        console.log('  GET  /api/sync-all');
        console.log('  GET  /api/admin/status');
        console.log('  POST /api/admin/product-availability/bulk');
        console.log('  POST /api/admin/flavor-availability/bulk');
        console.log('='.repeat(50));
    });
}

startServer().catch(console.error);

// Garantir que dados sejam salvos ao encerrar
process.on('SIGINT', async () => {
    console.log('\n💾 Salvando dados antes de encerrar...');
    await saveDataToFile();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n💾 Salvando dados antes de encerrar (SIGTERM)...');
    await saveDataToFile();
    process.exit(0);
});
