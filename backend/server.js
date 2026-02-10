// backend/server.js - VERSÃO OTIMIZADA PARA RENDER
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');

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

// ========== SISTEMA DE AUTO-PING OTIMIZADO ==========
let pingIntervalId = null;
let isServerReady = false;

function performAutoPing() {
    // Só executa auto-ping se o servidor estiver pronto
    if (!isServerReady) {
        console.log('⏳ Servidor ainda não pronto, pulando auto-ping...');
        return;
    }
    
    try {
        const url = process.env.RENDER_EXTERNAL_URL 
            ? `${process.env.RENDER_EXTERNAL_URL}/health`
            : `http://localhost:${PORT}/health`;
        
        console.log(`🔄 Auto-ping para: ${url}`);
        
        const parsedUrl = new URL(url);
        
        const options = {
            timeout: 10000, // 10 segundos
            rejectUnauthorized: false // Ignorar erros de certificado para self-signed
        };
        
        if (parsedUrl.protocol === 'https:') {
            const req = https.get(parsedUrl, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Auto-ping OK (HTTPS) - Status: ${res.statusCode}`);
                    } else {
                        console.log(`⚠️ Auto-ping status: ${res.statusCode}`);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log(`⚠️ Auto-ping HTTPS falhou: ${error.message}`);
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.log('⚠️ Auto-ping HTTPS timeout (10s)');
            });
            
            req.setTimeout(10000);
            
        } else {
            const req = http.get(parsedUrl, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Auto-ping OK (HTTP) - Status: ${res.statusCode}`);
                    } else {
                        console.log(`⚠️ Auto-ping status: ${res.statusCode}`);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.log(`⚠️ Auto-ping HTTP falhou: ${error.message}`);
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.log('⚠️ Auto-ping HTTP timeout (10s)');
            });
            
            req.setTimeout(10000);
        }
        
    } catch (error) {
        console.log('⚠️ Erro no auto-ping:', error.message);
    }
}

function startAutoPing() {
    if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
        console.log('🚀 Iniciando sistema de auto-ping para Render Free');
        
        // Aguardar 3 minutos antes do primeiro ping (servidor estabilizar)
        console.log('⏳ Aguardando 3 minutos para estabilização do servidor...');
        
        setTimeout(() => {
            console.log('✅ Servidor estabilizado, ativando auto-ping...');
            isServerReady = true;
            
            // Configurar ping periódico a cada 13 minutos
            const PING_INTERVAL = 13 * 60 * 1000;
            
            // Primeiro ping agora
            performAutoPing();
            
            // Ping periódico
            pingIntervalId = setInterval(performAutoPing, PING_INTERVAL);
            
            console.log(`⏰ Auto-ping configurado a cada ${PING_INTERVAL/60000} minutos`);
        }, 180000); // 3 minutos
        
    } else {
        console.log('💻 Ambiente local - auto-ping desativado');
        isServerReady = true;
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
    console.log(`🔧 Auto-ping: ${process.env.RENDER ? 'ATIVADO (inicia em 3min)' : 'DESATIVADO'}`);
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

// ========== ROTAS ADMIN COM AUTENTICAÇÃO ==========

// Atualizar produtos (admin) com autenticação
app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        const db = app.locals.db;
        if (!db) {
            return res.status(500).json({
                success: false,
                error: 'Banco de dados não disponível'
            });
        }
        
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

// Atualizar sabores (admin) com autenticação
app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        const db = app.locals.db;
        if (!db) {
            return res.status(500).json({
                success: false,
                error: 'Banco de dados não disponível'
            });
        }
        
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
