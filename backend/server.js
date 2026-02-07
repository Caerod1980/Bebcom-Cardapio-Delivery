// backend/server.js - VERSÃO CORRIGIDA E OTIMIZADA
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config(); // Para carregar variáveis de ambiente localmente

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Configurações - VERIFIQUE SE AS VARIÁVEIS ESTÃO NO RENDER!
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'bebcom_delivery';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

console.log('🔧 Configurações carregadas:');
console.log(`   - Porta: ${PORT}`);
console.log(`   - DB Name: ${DB_NAME}`);
console.log(`   - MongoDB URI: ${MONGODB_URI ? '✅ Configurada' : '❌ NÃO CONFIGURADA!'}`);
console.log(`   - Admin Password: ${ADMIN_PASSWORD ? '✅ Configurada' : '❌ NÃO CONFIGURADA!'}`);

// Conexão MongoDB com mais configurações
let db;
let client;
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ CRÍTICO: MONGODB_URI não configurada no Render!');
            console.log('   ⚠️  Configure a variável MONGODB_URI nas Environment Variables do Render');
            return false;
        }

        connectionAttempts++;
        console.log(`🔌 Tentativa ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS} de conexão ao MongoDB Atlas...`);
        
        // Configuração mais robusta para MongoDB Atlas
        client = new MongoClient(MONGODB_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            connectTimeoutMS: 10000, // 10 segundos
            socketTimeoutMS: 45000,  // 45 segundos
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 10000,
        });

        // Adicionar listeners de eventos
        client.on('serverOpening', () => {
            console.log('🔄 Servidor MongoDB abrindo conexão...');
        });

        client.on('serverClosed', () => {
            console.log('🔒 Servidor MongoDB fechou conexão');
            isConnected = false;
        });

        client.on('topologyOpening', () => {
            console.log('📡 Abrindo topologia MongoDB...');
        });

        client.on('topologyClosed', () => {
            console.log('📴 Topologia MongoDB fechada');
            isConnected = false;
        });

        // Tentar conectar
        await client.connect();
        
        // Verificar conexão
        await client.db('admin').command({ ping: 1 });
        
        db = client.db(DB_NAME);
        isConnected = true;
        
        console.log('✅ CONEXÃO MONGODB ESTABELECIDA COM SUCESSO!');
        console.log(`📊 Banco: ${DB_NAME}`);
        console.log(`📡 Host: ${client.options.srvHost || 'Não identificado'}`);
        
        // Inicializar collections se necessário
        await initializeCollections();
        return true;
        
    } catch (error) {
        console.error('❌ ERRO AO CONECTAR AO MONGODB:');
        console.error(`   Tipo: ${error.name}`);
        console.error(`   Mensagem: ${error.message}`);
        console.error(`   Código: ${error.code}`);
        
        if (error.message.includes('ENOTFOUND')) {
            console.error('   ⚠️  DNS não resolveu. Verifique a URI do MongoDB.');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error('   ⚠️  Conexão recusada. Verifique IP whitelist no MongoDB Atlas.');
        } else if (error.message.includes('Authentication failed')) {
            console.error('   ⚠️  Autenticação falhou. Verifique usuário/senha.');
        } else if (error.message.includes('timed out')) {
            console.error('   ⚠️  Timeout. O MongoDB Atlas pode estar lento.');
        }
        
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            console.log(`   🔄 Tentando novamente em 5 segundos...`);
            setTimeout(connectDB, 5000);
        } else {
            console.log('   🚫 Máximo de tentativas atingido. Servidor rodará em modo offline.');
        }
        
        return false;
    }
}

async function initializeCollections() {
    try {
        console.log('📋 Inicializando collections...');
        
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        // Criar collections se não existirem
        const requiredCollections = [
            { name: 'products', index: 'type' },
            { name: 'flavors', index: 'type' },
            { name: 'orders', index: 'orderId' },
            { name: 'settings', index: 'key' }
        ];
        
        for (const { name, index } of requiredCollections) {
            if (!collectionNames.includes(name)) {
                await db.createCollection(name);
                console.log(`   ✅ Collection "${name}" criada`);
                
                // Criar índice
                if (index) {
                    await db.collection(name).createIndex({ [index]: 1 });
                    console.log(`   📍 Índice "${index}" criado para "${name}"`);
                }
                
                // Inicializar dados padrão
                if (name === 'products') {
                    await db.collection(name).insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        version: '1.0'
                    });
                }
                if (name === 'flavors') {
                    await db.collection(name).insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        version: '1.0'
                    });
                }
                if (name === 'settings') {
                    await db.collection(name).insertOne({
                        key: 'app_config',
                        value: {
                            adminPasswordSet: ADMIN_PASSWORD ? true : false,
                            initializedAt: new Date().toISOString()
                        },
                        createdAt: new Date().toISOString()
                    });
                }
            } else {
                console.log(`   ✅ Collection "${name}" já existe`);
            }
        }
        
        console.log('✅ Collections inicializadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar collections:', error.message);
    }
}

// Middleware para verificar conexão com DB
function checkDBConnection(req, res, next) {
    if (!isConnected && req.method !== 'GET' && !req.path.includes('/health')) {
        return res.status(503).json({
            success: false,
            error: 'Serviço temporariamente indisponível. MongoDB offline.',
            timestamp: new Date().toISOString()
        });
    }
    next();
}

// Middleware de autenticação melhorado
function checkAdminPassword(req, res, next) {
    console.log('🔐 Verificando autenticação...');
    
    const password = req.body.password || req.headers['x-admin-password'];
    
    if (!password) {
        console.log('❌ Senha não fornecida');
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa não fornecida',
            timestamp: new Date().toISOString()
        });
    }
    
    if (password !== ADMIN_PASSWORD) {
        console.log('❌ Senha incorreta');
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa incorreta',
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('✅ Autenticação válida');
    next();
}

// ========== ROTAS DA API ==========

// Health Check melhorado
app.get('/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbDetails = {};
    
    if (client && isConnected) {
        try {
            await client.db('admin').command({ ping: 1 });
            dbStatus = 'connected';
            
            // Obter mais detalhes
            const stats = await db.stats();
            dbDetails = {
                collections: stats.collections,
                objects: stats.objects,
                storageSize: stats.storageSize,
                indexSize: stats.indexSize
            };
        } catch (error) {
            dbStatus = 'error';
            dbDetails = { error: error.message };
        }
    }
    
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API',
        version: '3.2',
        mongodb: {
            status: dbStatus,
            connected: isConnected,
            database: DB_NAME,
            details: dbDetails
        },
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Obter disponibilidade de produtos
app.get('/api/product-availability', checkDBConnection, async (req, res) => {
    try {
        if (!isConnected) {
            console.log('⚠️  MongoDB offline, retornando dados vazios');
            return res.json({
                success: true,
                productAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true
            });
        }
        
        const productData = await db.collection('products')
            .findOne({ type: 'availability' });
        
        console.log(`📦 Produtos carregados: ${Object.keys(productData?.data || {}).length} itens`);
        
        res.json({
            success: true,
            productAvailability: productData?.data || {},
            lastUpdated: productData?.lastUpdated || new Date().toISOString(),
            offline: false
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar produtos',
            productAvailability: {}
        });
    }
});

// Obter disponibilidade de sabores
app.get('/api/flavor-availability', checkDBConnection, async (req, res) => {
    try {
        if (!isConnected) {
            console.log('⚠️  MongoDB offline, retornando dados vazios');
            return res.json({
                success: true,
                flavorAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true
            });
        }
        
        const flavorData = await db.collection('flavors')
            .findOne({ type: 'availability' });
        
        console.log(`🍹 Sabores carregados: ${Object.keys(flavorData?.data || {}).length} itens`);
        
        res.json({
            success: true,
            flavorAvailability: flavorData?.data || {},
            lastUpdated: flavorData?.lastUpdated || new Date().toISOString(),
            offline: false
        });
    } catch (error) {
        console.error('Erro ao buscar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar sabores',
            flavorAvailability: {}
        });
    }
});

// Atualizar produtos (admin) - COM LOGS DETALHADOS
app.post('/api/admin/product-availability/bulk', checkDBConnection, checkAdminPassword, async (req, res) => {
    try {
        console.log('📦 RECEBENDO ATUALIZAÇÃO DE PRODUTOS...');
        console.log('   Headers:', JSON.stringify(req.headers, null, 2));
        console.log('   Body size:', JSON.stringify(req.body).length, 'bytes');
        
        const { productAvailability } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            console.log('❌ Dados inválidos recebidos');
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        console.log(`   Produtos recebidos: ${Object.keys(productAvailability).length} itens`);
        
        if (!isConnected) {
            console.log('❌ MongoDB offline, não é possível salvar');
            return res.status(503).json({
                success: false,
                error: 'MongoDB offline. Não é possível salvar.',
                offline: true
            });
        }
        
        // Salvar no MongoDB
        const result = await db.collection('products').updateOne(
            { type: 'availability' },
            {
                $set: {
                    data: productAvailability,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0'
                },
                $setOnInsert: {
                    createdAt: new Date().toISOString(),
                    type: 'availability'
                }
            },
            { upsert: true }
        );
        
        console.log('✅ PRODUTOS SALVOS NO MONGODB COM SUCESSO!');
        console.log(`   Matched: ${result.matchedCount}`);
        console.log(`   Modified: ${result.modifiedCount}`);
        console.log(`   Upserted: ${result.upsertedCount ? 'Sim' : 'Não'}`);
        
        // Logar alguns produtos
        const sampleProducts = Object.entries(productAvailability).slice(0, 3);
        console.log('   Amostra de produtos:');
        sampleProducts.forEach(([id, status]) => {
            console.log(`     ${id}: ${status ? '✅ Disponível' : '❌ Indisponível'}`);
        });
        
        res.json({
            success: true,
            message: 'Produtos atualizados com sucesso no MongoDB',
            timestamp: new Date().toISOString(),
            count: Object.keys(productAvailability).length,
            mongodb: {
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedId || false
            }
        });
        
    } catch (error) {
        console.error('❌ ERRO AO SALVAR PRODUTOS:', error);
        console.error('   Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: `Erro ao salvar produtos: ${error.message}`,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Atualizar sabores (admin) - COM LOGS DETALHADOS
app.post('/api/admin/flavor-availability/bulk', checkDBConnection, checkAdminPassword, async (req, res) => {
    try {
        console.log('🍹 RECEBENDO ATUALIZAÇÃO DE SABORES...');
        
        const { flavorAvailability } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        console.log(`   Sabores recebidos: ${Object.keys(flavorAvailability).length} itens`);
        
        if (!isConnected) {
            console.log('❌ MongoDB offline, não é possível salvar');
            return res.status(503).json({
                success: false,
                error: 'MongoDB offline. Não é possível salvar.',
                offline: true
            });
        }
        
        const result = await db.collection('flavors').updateOne(
            { type: 'availability' },
            {
                $set: {
                    data: flavorAvailability,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: '1.0'
                },
                $setOnInsert: {
                    createdAt: new Date().toISOString(),
                    type: 'availability'
                }
            },
            { upsert: true }
        );
        
        console.log('✅ SABORES SALVOS NO MONGODB COM SUCESSO!');
        console.log(`   Matched: ${result.matchedCount}`);
        console.log(`   Modified: ${result.modifiedCount}`);
        
        // Logar alguns sabores
        const sampleFlavors = Object.entries(flavorAvailability).slice(0, 3);
        console.log('   Amostra de sabores:');
        sampleFlavors.forEach(([key, status]) => {
            console.log(`     ${key}: ${status ? '✅ Disponível' : '❌ Indisponível'}`);
        });
        
        res.json({
            success: true,
            message: 'Sabores atualizados com sucesso no MongoDB',
            timestamp: new Date().toISOString(),
            count: Object.keys(flavorAvailability).length,
            mongodb: {
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedId || false
            }
        });
    } catch (error) {
        console.error('❌ ERRO AO SALVAR SABORES:', error);
        res.status(500).json({
            success: false,
            error: `Erro ao salvar sabores: ${error.message}`
        });
    }
});

// Sincronizar dados - COM LOGS
app.get('/api/sync-all', async (req, res) => {
    console.log('🔄 SOLICITAÇÃO DE SINCRONIZAÇÃO RECEBIDA');
    
    try {
        if (!isConnected) {
            console.log('⚠️  MongoDB offline, retornando dados vazios');
            return res.json({
                success: true,
                productAvailability: {},
                flavorAvailability: {},
                lastSync: new Date().toISOString(),
                offline: true
            });
        }
        
        const [products, flavors] = await Promise.all([
            db.collection('products').findOne({ type: 'availability' }),
            db.collection('flavors').findOne({ type: 'availability' })
        ]);
        
        const productCount = Object.keys(products?.data || {}).length;
        const flavorCount = Object.keys(flavors?.data || {}).length;
        
        console.log(`📊 Sincronização realizada:`);
        console.log(`   Produtos: ${productCount} itens`);
        console.log(`   Sabores: ${flavorCount} itens`);
        
        res.json({
            success: true,
            productAvailability: products?.data || {},
            flavorAvailability: flavors?.data || {},
            lastSync: new Date().toISOString(),
            counts: {
                products: productCount,
                flavors: flavorCount
            },
            offline: false
        });
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            error: 'Erro na sincronização',
            productAvailability: {},
            flavorAvailability: {}
        });
    }
});

// Rota de teste do MongoDB
app.get('/api/test-db', async (req, res) => {
    console.log('🧪 TESTE DO MONGODB SOLICITADO');
    
    try {
        if (!isConnected) {
            return res.json({
                success: false,
                message: 'MongoDB não conectado',
                isConnected: false
            });
        }
        
        // Teste de escrita
        const testDoc = {
            test: 'connection',
            timestamp: new Date().toISOString(),
            random: Math.random().toString(36).substring(7)
        };
        
        const writeResult = await db.collection('test').insertOne(testDoc);
        
        // Teste de leitura
        const readResult = await db.collection('test')
            .findOne({ _id: writeResult.insertedId });
        
        // Contar documentos
        const count = await db.collection('test').countDocuments();
        
        // Listar collections
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log('✅ Teste do MongoDB realizado com sucesso');
        console.log(`   Collections: ${collectionNames.join(', ')}`);
        console.log(`   Documentos na coleção 'test': ${count}`);
        
        res.json({
            success: true,
            message: 'Teste do MongoDB realizado com sucesso',
            isConnected: true,
            write: {
                insertedId: writeResult.insertedId,
                document: testDoc
            },
            read: readResult,
            database: {
                name: DB_NAME,
                collections: collectionNames,
                testCount: count
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Teste do MongoDB falhou:', error);
        res.json({
            success: false,
            message: 'Teste do MongoDB falhou',
            error: error.message,
            isConnected: false
        });
    }
});

// Criar pedido
app.post('/api/create-payment', checkDBConnection, async (req, res) => {
    try {
        const { orderId, customer, items, deliveryType, paymentMethod, totalAmount, deliveryFee } = req.body;
        
        console.log(`💰 NOVO PEDIDO: ${orderId}`);
        console.log(`   Cliente: ${customer?.name || 'Sem nome'}`);
        console.log(`   Itens: ${items?.length || 0}`);
        console.log(`   Tipo: ${deliveryType}`);
        
        // Salvar no MongoDB se conectado
        if (isConnected) {
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await db.collection('orders').insertOne(order);
            console.log(`📝 Pedido ${orderId} salvo no MongoDB`);
        } else {
            console.log('⚠️  MongoDB offline, pedido não salvo');
        }
        
        // Simular resposta PIX
        res.json({
            success: true,
            orderId,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${totalAmount || 50}`)}`,
            copyPasteKey: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865406' + 
                         Math.floor((totalAmount || 50) * 100).toString().padStart(10, '0') + 
                         '5802BR5925BEBCOM DELIVERY LTDA6008BAURU-SP62070503***6304ABCD',
            message: 'QR Code PIX gerado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pedido'
        });
    }
});

// Listar pedidos (admin)
app.get('/api/admin/orders', checkDBConnection, checkAdminPassword, async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(503).json({
                success: false,
                error: 'MongoDB offline'
            });
        }
        
        const orders = await db.collection('orders')
            .find()
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
        
        console.log(`📋 Listando ${orders.length} pedidos`);
        
        res.json({
            success: true,
            orders,
            count: orders.length
        });
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar pedidos'
        });
    }
});

// Configurações do sistema
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        backendUrl: 'https://bebcom-cardapio-delivery.onrender.com',
        whatsappNumber: '5514996130369',
        storeLocation: {
            address: "R. José Henrique Ferraz, 18-10 - Centro, Bauru - SP",
            city: "Bauru",
            state: "SP"
        },
        deliveryRates: {
            baseFee: 5.00,
            freeDeliveryMin: 100.00
        },
        mongodb: {
            connected: isConnected,
            database: DB_NAME
        }
    });
});

// Dashboard de status
app.get('/api/status', async (req, res) => {
    try {
        let dbStats = {};
        
        if (isConnected) {
            try {
                const stats = await db.stats();
                dbStats = {
                    collections: stats.collections,
                    objects: stats.objects,
                    avgObjSize: stats.avgObjSize,
                    storageSize: stats.storageSize,
                    indexSize: stats.indexSize
                };
                
                // Contar documentos
                const productCount = await db.collection('products').countDocuments();
                const flavorCount = await db.collection('flavors').countDocuments();
                const orderCount = await db.collection('orders').countDocuments();
                
                dbStats.documentCounts = {
                    products: productCount,
                    flavors: flavorCount,
                    orders: orderCount
                };
            } catch (error) {
                dbStats.error = error.message;
            }
        }
        
        res.json({
            success: true,
            status: 'online',
            timestamp: new Date().toISOString(),
            mongodb: {
                connected: isConnected,
                connectionAttempts: connectionAttempts,
                ...dbStats
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Rota principal com informações
app.get('/', (req, res) => {
    res.json({
        service: 'BebCom Delivery API',
        version: '3.2',
        status: 'online',
        mongodb: {
            connected: isConnected,
            database: DB_NAME
        },
        endpoints: [
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/api/status', method: 'GET', description: 'Status detalhado' },
            { path: '/api/product-availability', method: 'GET', description: 'Obter produtos' },
            { path: '/api/flavor-availability', method: 'GET', description: 'Obter sabores' },
            { path: '/api/sync-all', method: 'GET', description: 'Sincronizar tudo' },
            { path: '/api/test-db', method: 'GET', description: 'Testar MongoDB' },
            { path: '/api/config', method: 'GET', description: 'Configurações' }
        ],
        adminEndpoints: [
            { path: '/api/admin/product-availability/bulk', method: 'POST', description: 'Atualizar produtos' },
            { path: '/api/admin/flavor-availability/bulk', method: 'POST', description: 'Atualizar sabores' },
            { path: '/api/admin/orders', method: 'GET', description: 'Listar pedidos' }
        ],
        documentation: 'Verifique o console para logs detalhados'
    });
});

// Iniciar servidor
async function startServer() {
    console.log('='.repeat(60));
    console.log('🚀 INICIANDO BEBCOM DELIVERY API v3.2');
    console.log('='.repeat(60));
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`🌐 Porta: ${PORT}`);
    console.log(`🔐 Senha Admin: ${ADMIN_PASSWORD ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}`);
    console.log(`🗄️  MongoDB URI: ${MONGODB_URI ? 'CONFIGURADA' : 'NÃO CONFIGURADA'}`);
    console.log('─'.repeat(60));
    
    // Conectar ao MongoDB
    console.log('🔌 Iniciando conexão com MongoDB Atlas...');
    await connectDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('─'.repeat(60));
        console.log(`✅ SERVIDOR INICIADO COM SUCESSO!`);
        console.log(`🌍 URL: http://localhost:${PORT}`);
        console.log(`🌐 Render URL: https://bebcom-cardapio-delivery.onrender.com`);
        console.log(`📊 MongoDB: ${isConnected ? '✅ CONECTADO' : '❌ OFFLINE'}`);
        console.log('='.repeat(60));
        console.log('📝 LOGS DE OPERAÇÃO:');
        console.log('─'.repeat(60));
    });
}

// Health check periódico
setInterval(async () => {
    if (client && isConnected) {
        try {
            await client.db('admin').command({ ping: 1 });
        } catch (error) {
            console.log('⚠️  Health check do MongoDB falhou, reconectando...');
            isConnected = false;
            await connectDB();
        }
    }
}, 30000); // A cada 30 segundos

// Encerramento gracioso
process.on('SIGTERM', async () => {
    console.log('👋 Encerrando servidor (SIGTERM)...');
    if (client) {
        await client.close();
        console.log('🔌 MongoDB desconectado');
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('👋 Servidor interrompido (SIGINT)');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 ERRO NÃO TRATADO:', error);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 PROMISE REJEITADA NÃO TRATADA:', reason);
});

// Iniciar servidor
startServer().catch(error => {
    console.error('💥 ERRO CRÍTICO AO INICIAR SERVIDOR:', error);
    process.exit(1);
});
