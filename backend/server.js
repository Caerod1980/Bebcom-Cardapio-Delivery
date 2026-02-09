// backend/server.js - VERSÃO ULTRA-OTIMIZADA PARA RENDER
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware SIMPLES
app.use(cors());
app.use(express.json());

// Configurações
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ========== ROTAS CRÍTICAS (DEVEM RESPONDER IMEDIATAMENTE) ==========

// Health Check ULTRA RÁPIDO - SEM MONGODB
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API'
    });
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        version: '3.1-ultra',
        timestamp: new Date().toISOString(),
        message: 'API rodando normalmente no Render'
    });
});

// ========== INICIAR SERVIDOR PRIMEIRO ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 BEBCOM DELIVERY API - ULTRA OTIMIZADA');
    console.log('='.repeat(60));
    console.log(`✅ SERVIDOR INICIADO NA PORTA ${PORT}`);
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`📡 Health Check: http://0.0.0.0:${PORT}/health`);
    console.log(`🌐 Acesso público: https://bebcom-cardapio-delivery.onrender.com`);
    console.log('='.repeat(60));
    
    // Agora inicializa MongoDB em background
    setTimeout(initializeMongoDB, 100);
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
        
        // Configurar db global para uso nas rotas
        app.locals.db = db;
        app.locals.isDBConnected = true;
        
        // Inicializar collections
        await initializeCollections(db);
        
        // Configurar rotas que dependem do MongoDB
        setupMongoRoutes(app, db);
        
    } catch (error) {
        console.log('⚠️  MongoDB offline - servidor funcionando em modo local');
        app.locals.isDBConnected = false;
    }
}

async function initializeCollections(db) {
    try {
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const requiredCollections = ['products', 'flavors', 'orders', 'admin_logs'];
        
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

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
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

// ========== ROTAS BÁSICAS (SEM MONGODB) ==========

// Obter hash da senha
app.get('/api/admin-password', (req, res) => {
    const crypto = require('crypto');
    const passwordHash = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD || '')
        .digest('hex');
    
    res.json({
        success: true,
        passwordHash: passwordHash,
        salt: 'bebcom_' + new Date().getFullYear()
    });
});

// Listar endpoints
app.get('/api/endpoints', (req, res) => {
    const endpoints = {
        success: true,
        endpoints: [
            { path: '/', method: 'GET', description: 'Status do serviço' },
            { path: '/health', method: 'GET', description: 'Health check' },
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
        dbConnected: app.locals.isDBConnected || false
    });
});

// ========== ROTAS COM MONGODB (configuradas depois) ==========
function setupMongoRoutes(app, db) {
    
    // Obter disponibilidade de produtos
    app.get('/api/product-availability', async (req, res) => {
        try {
            const productData = await db.collection('products').findOne({ type: 'availability' });
            
            res.json({
                success: true,
                productAvailability: productData?.data || {},
                lastUpdated: productData?.lastUpdated || new Date().toISOString(),
                offline: false
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar produtos',
                productAvailability: {},
                offline: true
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
                offline: false
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao buscar sabores',
                flavorAvailability: {},
                offline: true
            });
        }
    });
    
    // Atualizar produtos (admin)
    app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
        try {
            const { productAvailability } = req.body;
            
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
                        updatedAt: new Date().toISOString()
                    }
                },
                { upsert: true }
            );
            
            res.json({
                success: true,
                message: 'Produtos atualizados com sucesso',
                timestamp: new Date().toISOString(),
                count: Object.keys(productAvailability).length
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Erro ao salvar produtos: ${error.message}`
            });
        }
    });
    
    // Atualizar sabores (admin)
    app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
        try {
            const { flavorAvailability } = req.body;
            
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
                        updatedAt: new Date().toISOString()
                    }
                },
                { upsert: true }
            );
            
            res.json({
                success: true,
                message: 'Sabores atualizados com sucesso',
                timestamp: new Date().toISOString(),
                count: Object.keys(flavorAvailability).length
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
                error: 'Erro na sincronização'
            });
        }
    });
    
    // Teste do MongoDB
    app.get('/api/test-db', async (req, res) => {
        try {
            await db.collection('test').insertOne({
                test: 'connection_test',
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: 'MongoDB funcionando perfeitamente',
                isConnected: true,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'MongoDB falhou',
                error: error.message,
                isConnected: false
            });
        }
    });
    
    // Criar pedido
    app.post('/api/create-payment', async (req, res) => {
        try {
            const { orderId, customer, items, deliveryType, paymentMethod, totalAmount, deliveryFee } = req.body;
            
            const order = {
                orderId,
                customer,
                items,
                deliveryType,
                paymentMethod: paymentMethod || 'pix',
                totalAmount: totalAmount || items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                deliveryFee: deliveryFee || 0,
                status: 'pending',
                paid: false,
                createdAt: new Date().toISOString()
            };
            
            await db.collection('orders').insertOne(order);
            
            const total = totalAmount || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            res.json({
                success: true,
                orderId,
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${total}`)}`,
                message: 'QR Code PIX gerado com sucesso',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao processar pedido'
            });
        }
    });
    
    // Status do pedido
    app.get('/api/order-status/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            
            const order = await db.collection('orders').findOne({ orderId });
            
            res.json({
                success: true,
                orderId,
                paid: order?.paid || false,
                status: order?.status || 'pending',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao verificar status'
            });
        }
    });
    
    console.log('✅ Rotas MongoDB configuradas!');
}

// ========== CONFIGURAÇÕES FINAIS ==========

// Graceful shutdown para Render
process.on('SIGTERM', () => {
    console.log('👋 Recebido SIGTERM do Render, encerrando...');
    server.close(() => {
        console.log('✅ Servidor encerrado graciosamente');
        process.exit(0);
    });
    
    // Timeout após 8 segundos (Render dá 10 segundos)
    setTimeout(() => {
        console.log('⚠️  Forçando encerramento...');
        process.exit(1);
    }, 8000);
});

process.on('SIGINT', () => {
    console.log('👋 Recebido SIGINT, encerrando...');
    server.close(() => {
        process.exit(0);
    });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('💥 Erro não capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Promise rejeitada não tratada:', error);
});

console.log('🔄 Inicializando BebCom Delivery API...');
