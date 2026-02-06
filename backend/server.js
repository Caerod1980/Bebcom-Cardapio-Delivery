// server.js - Backend FUNCIONAL e CORRIGIDO COM AUTENTICAÇÃO SEGURA
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();

// Configurações
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bebcom-delivery-secret-key-2024';
const DATA_FILE = path.join(__dirname, 'data.json');

// Armazenamento em memória (fallback se arquivo não existir)
let productAvailabilityDB = {};
let flavorAvailabilityDB = {};

// ====== CONFIGURAÇÃO CORS (CRÍTICA!) ======
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Middleware para headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.use(express.json());

// ====== SISTEMA DE ARMAZENAMENTO EM ARQUIVO ======

async function loadDataFromFile() {
    try {
        await fs.access(DATA_FILE);
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        productAvailabilityDB = parsed.productAvailabilityDB || {};
        flavorAvailabilityDB = parsed.flavorAvailabilityDB || {};
        
        console.log(`📂 Dados carregados: ${Object.keys(productAvailabilityDB).length} produtos, ${Object.keys(flavorAvailabilityDB).length} sabores`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
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
    }
}

// ====== MIDDLEWARE DE AUTENTICAÇÃO ======

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acesso não fornecido'
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Token inválido ou expirado'
            });
        }
        
        req.user = user;
        next();
    });
}

// ====== ROTAS PÚBLICAS ======

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
        }
    });
});

// LOGIN ADMINISTRATIVO (PÚBLICO)
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        
        // SENHA CORRETA (agora só no backend!)
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';
        
        if (password === ADMIN_PASSWORD) {
            // Gerar token JWT
            const token = jwt.sign(
                { role: 'admin', access: 'full' }, 
                JWT_SECRET, 
                { expiresIn: '2h' }
            );
            
            res.json({
                success: true,
                token,
                message: 'Login realizado com sucesso',
                expiresIn: '2 hours'
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Senha incorreta'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro interno no servidor'
        });
    }
});

// ROTA RAIZ
app.get('/', (req, res) => {
    res.redirect('/health');
});

// DISPONIBILIDADE DE PRODUTOS
app.get('/api/product-availability', (req, res) => {
    res.json({
        success: true,
        productAvailability: productAvailabilityDB,
        count: Object.keys(productAvailabilityDB).length,
        timestamp: new Date().toISOString()
    });
});

// DISPONIBILIDADE DE SABORES
app.get('/api/flavor-availability', (req, res) => {
    res.json({
        success: true,
        flavorAvailability: flavorAvailabilityDB,
        count: Object.keys(flavorAvailabilityDB).length,
        timestamp: new Date().toISOString()
    });
});

// SINCRONIZAÇÃO COMPLETA
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
        timestamp: new Date().toISOString()
    });
});

// CRIAR PAGAMENTO (SIMULADO)
app.post('/api/create-payment', (req, res) => {
    try {
        const { orderId, totalAmount } = req.body;
        
        const generatedOrderId = orderId || 'BEB' + Date.now().toString().slice(-8);
        
        res.json({
            success: true,
            paymentType: 'pix',
            orderId: generatedOrderId,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=BEBCOM-${generatedOrderId}`,
            copyPasteKey: '00020126360014BR.GOV.BCB.PIX0114+55149999999990225BebCom Delivery - Pedido ' + generatedOrderId,
            amount: totalAmount || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao criar pagamento'
        });
    }
});

// STATUS DO PEDIDO
app.get('/api/order-status/:orderId', (req, res) => {
    res.json({
        success: true,
        orderId: req.params.orderId,
        status: 'paid',
        paid: true,
        timestamp: new Date().toISOString()
    });
});

// ====== ROTAS ADMINISTRATIVAS (PROTEGIDAS) ======

// VERIFICAR TOKEN
app.get('/api/admin/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user,
        message: 'Token válido',
        timestamp: new Date().toISOString()
    });
});

// ATUALIZAR PRODUTOS EM MASSA
app.post('/api/admin/product-availability/bulk', authenticateToken, async (req, res) => {
    try {
        const { productAvailability } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        // Atualizar dados
        Object.keys(productAvailability).forEach(productId => {
            productAvailabilityDB[productId] = productAvailability[productId];
        });
        
        const savedCount = Object.keys(productAvailability).length;
        
        // Salvar no arquivo
        await saveDataToFile();
        
        console.log(`✅ Admin atualizou ${savedCount} produtos`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} produtos`,
            savedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar produtos'
        });
    }
});

// ATUALIZAR SABORES EM MASSA
app.post('/api/admin/flavor-availability/bulk', authenticateToken, async (req, res) => {
    try {
        const { flavorAvailability } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        // Atualizar dados
        Object.keys(flavorAvailability).forEach(flavorKey => {
            flavorAvailabilityDB[flavorKey] = flavorAvailability[flavorKey];
        });
        
        const savedCount = Object.keys(flavorAvailability).length;
        
        // Salvar no arquivo
        await saveDataToFile();
        
        console.log(`✅ Admin atualizou ${savedCount} sabores`);
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} sabores`,
            savedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar sabores'
        });
    }
});

// BACKUP DOS DADOS
app.get('/api/admin/backup', authenticateToken, async (req, res) => {
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
            error: 'Erro ao criar backup'
        });
    }
});

// RESETAR DADOS
app.post('/api/admin/reset', authenticateToken, async (req, res) => {
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
            error: 'Erro ao resetar dados'
        });
    }
});

// ====== ROTA DE FALLBACK ======
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        timestamp: new Date().toISOString()
    });
});

// ====== INICIAR SERVIDOR ======

async function startServer() {
    await loadDataFromFile();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('='.repeat(50));
        console.log(`🚀 BebCom Delivery API v3.0 (AUTH FIXED)`);
        console.log('='.repeat(50));
        console.log(`📍 Porta: ${PORT}`);
        console.log(`🔗 Health: http://localhost:${PORT}/health`);
        console.log(`🔗 Login: POST http://localhost:${PORT}/api/admin/login`);
        console.log(`💾 Dados: ${Object.keys(productAvailabilityDB).length} produtos`);
        console.log(`🔐 Autenticação: JWT Token`);
        console.log('='.repeat(50));
    });
}

startServer().catch(console.error);

// Garantir salvamento ao encerrar
process.on('SIGINT', async () => {
    console.log('\n💾 Salvando dados antes de encerrar...');
    await saveDataToFile();
    process.exit(0);
});
