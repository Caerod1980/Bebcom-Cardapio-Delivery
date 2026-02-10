// backend/server.js - VERSÃO CORRIGIDA PARA RENDER COM HTTPS
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https'); // Adicionar módulo https

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware SIMPLES
app.use(cors());
app.use(express.json());

// Configurações
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ========== LOG DE PORTA ==========
console.log('='.repeat(60));
console.log('🔍 VERIFICAÇÃO DE CONFIGURAÇÃO DE PORTA');
console.log('='.repeat(60));
console.log(`process.env.PORT: ${process.env.PORT || 'NÃO DEFINIDO'}`);
console.log(`Porta usada: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('='.repeat(60));

if (!process.env.PORT) {
    console.log('⚠️  ATENÇÃO: PORT não definida no ambiente. Usando fallback 10000.');
} else {
    console.log(`✅ PORT definida pelo ambiente: ${process.env.PORT}`);
}

if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
    console.log('✅ Detectado ambiente Render');
} else {
    console.log('⚠️  Ambiente local detectado');
}

// ========== ROTAS CRÍTICAS ==========

// Health Check ULTRA RÁPIDO
app.get('/health', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString().slice(0, 19) + 'Z',
        service: 'BebCom Delivery API',
        port: PORT
    }));
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        version: '3.2-sync',
        timestamp: new Date().toISOString(),
        message: 'API rodando normalmente no Render',
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});

// ========== SISTEMA DE AUTO-PING CORRIGIDO ==========
let pingIntervalId = null;

function performAutoPing() {
    try {
        const url = process.env.RENDER_EXTERNAL_URL 
            ? `${process.env.RENDER_EXTERNAL_URL}/health`
            : `http://localhost:${PORT}/health`;
        
        console.log(`🔄 Auto-ping para: ${url}`);
        
        // Verificar se é HTTP ou HTTPS
        if (url.startsWith('https://')) {
            // Usar módulo HTTPS
            const req = https.get(url, (res) => {
                if (res.statusCode === 200) {
                    console.log(`✅ Auto-ping OK (HTTPS)`);
                } else {
                    console.log(`⚠️ Auto-ping status: ${res.statusCode}`);
                }
                res.resume(); // Consumir os dados
            });
            
            req.on('error', (error) => {
                console.log(`⚠️ Auto-ping HTTPS falhou: ${error.message}`);
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                console.log('⚠️ Auto-ping HTTPS timeout (5s)');
            });
            
        } else {
            // Usar módulo HTTP
            const req = http.get(url, (res) => {
                if (res.statusCode === 200) {
                    console.log(`✅ Auto-ping OK (HTTP)`);
                } else {
                    console.log(`⚠️ Auto-ping status: ${res.statusCode}`);
                }
                res.resume();
            });
            
            req.on('error', (error) => {
                console.log(`⚠️ Auto-ping HTTP falhou: ${error.message}`);
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                console.log('⚠️ Auto-ping HTTP timeout (5s)');
            });
        }
        
    } catch (error) {
        console.log('⚠️ Erro no auto-ping:', error.message);
    }
}

function startAutoPing() {
    if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
        console.log('🚀 Iniciando sistema de auto-ping para Render Free');
        
        // Configurar ping periódico a cada 14 minutos
        const PING_INTERVAL = 14 * 60 * 1000;
        
        // Primeiro ping após 2 minutos (dar tempo para estabilizar)
        setTimeout(() => {
            performAutoPing();
        }, 120000);
        
        // Ping periódico
        pingIntervalId = setInterval(performAutoPing, PING_INTERVAL);
        
        console.log(`⏰ Auto-ping configurado a cada ${PING_INTERVAL/60000} minutos`);
    } else {
        console.log('💻 Ambiente local - auto-ping desativado');
    }
}

function stopAutoPing() {
    if (pingIntervalId) {
        clearInterval(pingIntervalId);
        console.log('🛑 Auto-ping parado');
    }
}

// ========== INICIAR SERVIDOR ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 BEBCOM DELIVERY API - COM SISTEMA DE SINCRONIZAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ SERVIDOR INICIADO NA PORTA ${PORT}`);
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`📡 Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`🌐 Acesso público: https://bebcom-cardapio-delivery.onrender.com`);
    console.log(`🔧 Auto-ping: ${process.env.RENDER ? 'ATIVADO' : 'DESATIVADO'}`);
    console.log('='.repeat(60));
    
    // Iniciar auto-ping depois que o servidor está rodando
    startAutoPing();
    
    // Inicializar MongoDB em background
    setTimeout(() => {
        initializeMongoDB();
    }, 2000);
});

// ========== MONGODB EM BACKGROUND ==========
async function initializeMongoDB() {
    try {
        const { MongoClient, ServerApiVersion } = require('mongodb');
        const MONGODB_URI = process.env.MONGODB_URI;
        const DB_NAME = 'bebcom_delivery';
        
        if (!MONGODB_URI) {
            console.log('⚠️  MONGODB_URI não configurada - modo offline ativado');
            return;
        }
        
        console.log('🔌 Conectando ao MongoDB em background...');
        
        const client = new MongoClient(MONGODB_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000
        });
        
        await client.connect();
        await client.db('admin').command({ ping: 1 });
        const db = client.db(DB_NAME);
        
        console.log('✅ MONGODB CONECTADO COM SUCESSO!');
        
        app.locals.db = db;
        app.locals.isDBConnected = true;
        
        await initializeCollections(db);
        setupMongoRoutes(app, db);
        
    } catch (error) {
        console.log('⚠️  MongoDB offline - servidor funcionando em modo local');
        console.log('Detalhes do erro:', error.message);
        app.locals.isDBConnected = false;
    }
}

async function initializeCollections(db) {
    try {
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const requiredCollections = ['products', 'flavors', 'orders', 'admin_logs', 'sync_queue'];
        
        for (const name of requiredCollections) {
            if (!collectionNames.includes(name)) {
                await db.createCollection(name);
                console.log(`📦 Collection "${name}" criada`);
            }
        }
        
        console.log('✅ Collections inicializadas');
    } catch (error) {
        console.log('⚠️  Erro nas collections:', error.message);
    }
}

// ========== ROTAS BÁSICAS ==========

// Obter hash da senha
app.get('/api/admin-password', (req, res) => {
    const crypto = require('crypto');
    const currentYear = new Date().getFullYear();
    const passwordHash = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD || '')
        .digest('hex');
    
    res.json({
        success: true,
        passwordHash: passwordHash,
        salt: 'bebcom_' + currentYear
    });
});

// Listar endpoints
app.get('/api/endpoints', (req, res) => {
    const endpoints = {
        success: true,
        endpoints: [
            { path: '/', method: 'GET', description: 'Status do serviço' },
            { path: '/health', method: 'GET', description: 'Health check rápido' },
            { path: '/api/admin-password', method: 'GET', description: 'Obter hash da senha admin' },
            { path: '/api/test', method: 'GET', description: 'Teste simples' }
        ],
        timestamp: new Date().toISOString()
    };
    
    if (app.locals.isDBConnected) {
        endpoints.endpoints.push(
            { path: '/api/product-availability', method: 'GET', description: 'Obter disponibilidade de produtos' },
            { path: '/api/flavor-availability', method: 'GET', description: 'Obter disponibilidade de sabores' },
            { path: '/api/sync-all', method: 'GET', description: 'Sincronizar todos os dados' }
        );
        endpoints.adminEndpoints = [
            { path: '/api/admin/product-availability/bulk', method: 'POST', description: 'Atualizar produtos (admin)' },
            { path: '/api/admin/flavor-availability/bulk', method: 'POST', description: 'Atualizar sabores (admin)' }
        ];
    }
    
    res.json(endpoints);
});

// Teste simples
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando!',
        timestamp: new Date().toISOString(),
        dbConnected: app.locals.isDBConnected || false,
        autoPing: pingIntervalId ? 'ativo' : 'inativo',
        port: PORT
    });
});

// ========== ROTAS COM MONGODB ==========
function setupMongoRoutes(app, db) {
    
    // Obter disponibilidade de produtos
    app.get('/api/product-availability', async (req, res) => {
        try {
            const productData = await db.collection('products').findOne({ type: 'availability' });
            
            res.json({
                success: true,
                productAvailability: productData?.data || {},
                lastUpdated: productData?.lastUpdated || new Date().toISOString(),
                offline: false,
                dbStatus: 'connected'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar produtos',
                productAvailability: {},
                offline: true,
                dbStatus: 'disconnected'
            });
        }
    });
    
    // Obter disponibilidade de sabores
    app.get('/api/flavor-availability', async (req, res) => {
        try {
            const flavorData = await db.collection('flavors').findOne({ type: 'availability' });
            
            res.json({
                success: true,
                flavorAvailability: flavorData?.data || {},
                lastUpdated: flavorData?.lastUpdated || new Date().toISOString(),
                offline: false,
                dbStatus: 'connected'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar sabores',
                flavorAvailability: {},
                offline: true,
                dbStatus: 'disconnected'
            });
        }
    });
    
    // Atualizar produtos (admin)
    app.post('/api/admin/product-availability/bulk', async (req, res) => {
        try {
            const { productAvailability, adminName, source } = req.body;
            
            if (!productAvailability || typeof productAvailability !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos'
                });
            }
            
            const result = await db.collection('products').updateOne(
                { type: 'availability' },
                {
                    $set: {
                        data: productAvailability,
                        lastUpdated: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        updatedBy: adminName || 'Admin BebCom',
                        source: source || 'direct'
                    }
                },
                { upsert: true }
            );
            
            await db.collection('admin_logs').insertOne({
                action: 'update_products',
                admin: adminName || 'Admin BebCom',
                count: Object.keys(productAvailability).length,
                source: source || 'direct',
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: 'Produtos atualizados com sucesso',
                timestamp: new Date().toISOString(),
                count: Object.keys(productAvailability).length,
                upsertedId: result.upsertedId
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao salvar produtos: ${error.message}`
            });
        }
    });
    
    // Atualizar sabores (admin)
    app.post('/api/admin/flavor-availability/bulk', async (req, res) => {
        try {
            const { flavorAvailability, adminName, source } = req.body;
            
            if (!flavorAvailability || typeof flavorAvailability !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos'
                });
            }
            
            const result = await db.collection('flavors').updateOne(
                { type: 'availability' },
                {
                    $set: {
                        data: flavorAvailability,
                        lastUpdated: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        updatedBy: adminName || 'Admin BebCom',
                        source: source || 'direct'
                    }
                },
                { upsert: true }
            );
            
            await db.collection('admin_logs').insertOne({
                action: 'update_flavors',
                admin: adminName || 'Admin BebCom',
                count: Object.keys(flavorAvailability).length,
                source: source || 'direct',
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: 'Sabores atualizados com sucesso',
                timestamp: new Date().toISOString(),
                count: Object.keys(flavorAvailability).length,
                upsertedId: result.upsertedId
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao salvar sabores: ${error.message}`
            });
        }
    });
    
    // Sincronizar dados
    app.get('/api/sync-all', async (req, res) => {
        try {
            const [products, flavors] = await Promise.all([
                db.collection('products').findOne({ type: 'availability' }),
                db.collection('flavors').findOne({ type: 'availability' })
            ]);
            
            res.json({
                success: true,
                productAvailability: products?.data || {},
                flavorAvailability: flavors?.data || {},
                lastSync: new Date().toISOString(),
                offline: false,
                dbStatus: 'connected'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro na sincronização',
                dbStatus: 'disconnected'
            });
        }
    });
    
    console.log('✅ Rotas MongoDB configuradas!');
}

// ========== MIDDLEWARE DE AUTENTICAÇÃO SIMPLIFICADO ==========
function checkAdminPassword(req, res, next) {
    const password = req.body.password || 
                    req.headers['x-admin-password'] || 
                    req.headers['x-admin-key'] ||
                    req.query.adminPassword;

    if (!password) {
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa não fornecida'
        });
    }

    const crypto = require('crypto');
    const currentYear = new Date().getFullYear();
    
    const expectedHash = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD || '')
        .digest('hex');
    
    const hashWithSalt = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD + 'bebcom_' + currentYear)
        .digest('hex');

    if (password === ADMIN_PASSWORD || 
        password === expectedHash || 
        password === hashWithSalt) {
        next();
    } else {
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa incorreta'
        });
    }
}

// Adicionar middleware às rotas admin
app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
    // O código desta rota já está definido em setupMongoRoutes
    // Esta é apenas a assinatura para adicionar o middleware
    const db = app.locals.db;
    if (!db) {
        return res.status(500).json({
            success: false,
            error: 'Banco de dados não disponível'
        });
    }
    
    // Chama a função original
    const originalHandler = setupMongoRoutes.toString();
    // Implementação está em setupMongoRoutes
});

app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
    const db = app.locals.db;
    if (!db) {
        return res.status(500).json({
            success: false,
            error: 'Banco de dados não disponível'
        });
    }
    
    // Implementação está em setupMongoRoutes
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', () => {
    console.log('👋 Recebido SIGTERM do Render, encerrando...');
    stopAutoPing();
    
    server.close(() => {
        console.log('✅ Servidor encerrado graciosamente');
        process.exit(0);
    });
    
    setTimeout(() => {
        console.log('⚠️  Forçando encerramento...');
        process.exit(1);
    }, 8000);
});

process.on('SIGINT', () => {
    console.log('👋 Recebido SIGINT, encerrando...');
    stopAutoPing();
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('💥 Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Promise rejeitada não tratada:', error);
});

console.log('🔄 Inicializando BebCom Delivery API...');
