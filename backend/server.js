// backend/server.js - VERSÃO OTIMIZADA PARA RENDER
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-admin-password', 'X-Admin-Password', 'x-admin-key', 'X-Admin-Key']
}));
app.use(express.json());

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'bebcom_delivery';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ========== ROTA RAIZ (CRÍTICA PARA RENDER) ==========
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        version: '3.1',
        timestamp: new Date().toISOString(),
        message: 'API rodando normalmente',
        dbConnected: isConnected,
        adminPasswordConfigured: !!ADMIN_PASSWORD
    });
});

// ========== HEALTH CHECK OTIMIZADO ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API',
        db: isConnected ? 'connected' : 'disconnected'
    });
});

// ========== OBTER SENHA ADMIN ==========
app.get('/api/admin-password', (req, res) => {
    // Retorna um hash da senha para verificação no frontend
    // Não expõe a senha diretamente
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

console.log('='.repeat(60));
console.log('🚀 INICIANDO BEBCOM DELIVERY API v3.1');
console.log('='.repeat(60));
console.log(`📅 ${new Date().toISOString()}`);
console.log(`🌐 Porta: ${PORT}`);
console.log(`🔐 Senha Admin: ${ADMIN_PASSWORD ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA'}`);
console.log(`🗄️  MongoDB URI: ${MONGODB_URI ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA'}`);
console.log('─'.repeat(60));

// Conexão MongoDB
let db;
let client;
let isConnected = false;
let connectionRetryCount = 0;
const MAX_RETRIES = 5;

async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ CRÍTICO: MONGODB_URI não configurada no Render!');
            console.log('⚠️  Servidor rodará em modo offline (apenas leitura)');
            return false;
        }

        console.log('🔌 Conectando ao MongoDB Atlas...');
        
        // Configuração otimizada para MongoDB Atlas
        client = new MongoClient(MONGODB_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 10000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });

        // Conectar com retry
        await connectWithRetry();
        
    } catch (error) {
        console.error('❌ Erro na configuração MongoDB:', error.message);
        return false;
    }
}

async function connectWithRetry() {
    try {
        await client.connect();
        await client.db('admin').command({ ping: 1 });
        db = client.db(DB_NAME);
        isConnected = true;
        connectionRetryCount = 0;
        console.log('✅ CONEXÃO MONGODB ESTABELECIDA!');
        console.log(`📊 Banco: ${DB_NAME}`);
        
        // Configurar keep-alive
        setInterval(async () => {
            try {
                if (client && isConnected) {
                    await client.db('admin').command({ ping: 1 });
                }
            } catch (error) {
                console.log('⚠️  MongoDB keep-alive falhou:', error.message);
                isConnected = false;
                await reconnectDB();
            }
        }, 30000); // Ping a cada 30 segundos
        
        // Inicializar collections em background
        setTimeout(initializeCollections, 2000);
        
        return true;
        
    } catch (error) {
        connectionRetryCount++;
        console.error(`❌ MongoDB offline (tentativa ${connectionRetryCount}/${MAX_RETRIES}):`, error.message);
        
        if (connectionRetryCount < MAX_RETRIES) {
            console.log(`🔄 Tentando reconectar em ${connectionRetryCount * 2} segundos...`);
            setTimeout(connectWithRetry, connectionRetryCount * 2000);
        } else {
            console.log('⚠️  MongoDB permanece offline, servidor funcionando em modo local');
            isConnected = false;
        }
        return false;
    }
}

async function reconnectDB() {
    if (connectionRetryCount >= MAX_RETRIES) return;
    
    try {
        console.log('🔄 Tentando reconectar ao MongoDB...');
        await client.connect();
        isConnected = true;
        connectionRetryCount = 0;
        console.log('✅ MongoDB reconectado!');
    } catch (error) {
        console.error('❌ Falha na reconexão:', error.message);
    }
}

async function initializeCollections() {
    try {
        if (!isConnected || !db) {
            console.log('⚠️  MongoDB offline, pulando inicialização de collections');
            return;
        }
        
        console.log('📋 Inicializando collections...');
        
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        // Collections necessárias
        const requiredCollections = ['products', 'flavors', 'orders', 'admin_logs'];
        
        for (const name of requiredCollections) {
            if (!collectionNames.includes(name)) {
                await db.createCollection(name);
                console.log(`   ✅ Collection "${name}" criada`);
                
                // Inicializar dados padrão
                if (name === 'products') {
                    await db.collection(name).insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        version: '3.1'
                    });
                    console.log('   📦 Dados padrão de produtos inicializados');
                }
                if (name === 'flavors') {
                    await db.collection(name).insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        version: '3.1'
                    });
                    console.log('   🍹 Dados padrão de sabores inicializados');
                }
            }
        }
        
        console.log('✅ Collections OK!');
        
    } catch (error) {
        console.error('❌ Erro nas collections:', error.message);
    }
}

// ========== ROTAS DA API ==========

// Middleware de autenticação - VERSÃO ATUALIZADA
function checkAdminPassword(req, res, next) {
    const password = req.body.password || 
                    req.headers['x-admin-password'] || 
                    req.headers['x-admin-key'] ||
                    req.query.adminPassword;

    console.log('🔐 Tentativa de acesso admin:', {
        hasPassword: !!password,
        passwordLength: password ? password.length : 0,
        headers: req.headers
    });

    if (!password) {
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa não fornecida'
        });
    }

    // Aceita tanto a senha direta quanto o hash
    const crypto = require('crypto');
    const currentYear = new Date().getFullYear();
    
    // Hash da senha sem salt
    const expectedHash = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD || '')
        .digest('hex');
    
    // Hash da senha com salt (bebcom_YYYY)
    const hashWithSalt = crypto
        .createHash('sha256')
        .update(ADMIN_PASSWORD + 'bebcom_' + currentYear)
        .digest('hex');

    console.log('🔐 Hash esperados:', {
        expectedHash: expectedHash.substring(0, 8) + '...',
        hashWithSalt: hashWithSalt.substring(0, 8) + '...',
        received: password.substring(0, 8) + '...'
    });

    // Verifica se é a senha direta OU o hash correto
    if (password === ADMIN_PASSWORD || 
        password === expectedHash || 
        password === hashWithSalt) {
        
        console.log('✅ Acesso admin concedido');
        next();
    } else {
        console.log('❌ Acesso admin negado');
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa incorreta'
        });
    }
}

// Obter disponibilidade de produtos
app.get('/api/product-availability', async (req, res) => {
    try {
        if (!isConnected || !db) {
            return res.json({
                success: true,
                productAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true,
                message: 'Modo offline - usando cache local'
            });
        }
        
        const productData = await db.collection('products').findOne({ type: 'availability' });
        
        res.json({
            success: true,
            productAvailability: productData?.data || {},
            lastUpdated: productData?.lastUpdated || new Date().toISOString(),
            offline: false,
            message: 'Dados carregados do MongoDB'
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
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
        if (!isConnected || !db) {
            return res.json({
                success: true,
                flavorAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true,
                message: 'Modo offline - usando cache local'
            });
        }
        
        const flavorData = await db.collection('flavors').findOne({ type: 'availability' });
        
        res.json({
            success: true,
            flavorAvailability: flavorData?.data || {},
            lastUpdated: flavorData?.lastUpdated || new Date().toISOString(),
            offline: false,
            message: 'Dados carregados do MongoDB'
        });
    } catch (error) {
        console.error('Erro ao buscar sabores:', error);
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
        console.log('📦 Recebendo atualização de produtos...');
        
        const { productAvailability } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        if (!isConnected || !db) {
            console.log('❌ MongoDB offline, não é possível salvar');
            return res.status(503).json({
                success: false,
                error: 'MongoDB offline. Não é possível salvar.',
                offline: true
            });
        }
        
        // Log da ação
        await db.collection('admin_logs').insertOne({
            action: 'update_product_availability',
            itemsCount: Object.keys(productAvailability).length,
            timestamp: new Date().toISOString(),
            source: req.headers['x-forwarded-for'] || req.ip
        });
        
        // Salvar no MongoDB
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
        
        console.log(`✅ Produtos salvos! Itens: ${Object.keys(productAvailability).length}`);
        
        res.json({
            success: true,
            message: 'Produtos atualizados com sucesso no MongoDB',
            timestamp: new Date().toISOString(),
            count: Object.keys(productAvailability).length,
            mongodbResult: {
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedCount
            },
            savedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error.message);
        res.status(500).json({
            success: false,
            error: `Erro ao salvar produtos: ${error.message}`
        });
    }
});

// Atualizar sabores (admin)
app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        console.log('🍹 Recebendo atualização de sabores...');
        
        const { flavorAvailability } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        if (!isConnected || !db) {
            console.log('❌ MongoDB offline, não é possível salvar');
            return res.status(503).json({
                success: false,
                error: 'MongoDB offline. Não é possível salvar.',
                offline: true
            });
        }
        
        // Log da ação
        await db.collection('admin_logs').insertOne({
            action: 'update_flavor_availability',
            itemsCount: Object.keys(flavorAvailability).length,
            timestamp: new Date().toISOString(),
            source: req.headers['x-forwarded-for'] || req.ip
        });
        
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
        
        console.log(`✅ Sabores salvos! Itens: ${Object.keys(flavorAvailability).length}`);
        
        res.json({
            success: true,
            message: 'Sabores atualizados com sucesso no MongoDB',
            timestamp: new Date().toISOString(),
            count: Object.keys(flavorAvailability).length,
            mongodbResult: {
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upserted: result.upsertedCount
            },
            savedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error.message);
        res.status(500).json({
            success: false,
            error: `Erro ao salvar sabores: ${error.message}`
        });
    }
});

// Sincronizar dados
app.get('/api/sync-all', async (req, res) => {
    try {
        if (!isConnected || !db) {
            return res.json({
                success: true,
                productAvailability: {},
                flavorAvailability: {},
                lastSync: new Date().toISOString(),
                offline: true,
                dbStatus: 'disconnected'
            });
        }
        
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
            dbStatus: 'connected',
            syncTimestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            error: 'Erro na sincronização',
            productAvailability: {},
            flavorAvailability: {},
            offline: true
        });
    }
});

// Teste do MongoDB
app.get('/api/test-db', async (req, res) => {
    try {
        if (!isConnected || !db) {
            return res.json({
                success: false,
                message: 'MongoDB não conectado',
                isConnected: false,
                timestamp: new Date().toISOString()
            });
        }
        
        // Teste simples
        const testDoc = {
            test: 'connection_test',
            timestamp: new Date().toISOString(),
            service: 'BebCom Delivery'
        };
        
        await db.collection('test').insertOne(testDoc);
        const count = await db.collection('test').countDocuments();
        
        // Limpar documentos de teste antigos
        await db.collection('test').deleteMany({
            timestamp: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        
        res.json({
            success: true,
            message: 'MongoDB funcionando perfeitamente',
            isConnected: true,
            testCount: count,
            timestamp: new Date().toISOString(),
            dbName: DB_NAME
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'MongoDB falhou',
            error: error.message,
            isConnected: false,
            timestamp: new Date().toISOString()
        });
    }
});

// Criar pedido
app.post('/api/create-payment', async (req, res) => {
    try {
        const { orderId, customer, items, deliveryType, paymentMethod, totalAmount, deliveryFee } = req.body;
        
        // Salvar no MongoDB se conectado
        if (isConnected && db) {
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
            
            // Log do pedido
            await db.collection('admin_logs').insertOne({
                action: 'new_order',
                orderId: orderId,
                customerName: customer.name,
                total: totalAmount,
                timestamp: new Date().toISOString()
            });
        }
        
        // Simular resposta PIX
        const total = totalAmount || items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        res.json({
            success: true,
            orderId,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${total}`)}`,
            copyPasteKey: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865406' + 
                         Math.floor(total * 100).toString().padStart(10, '0') + 
                         '5802BR5925BEBCOM DELIVERY LTDA6008BAURU-SP62070503***6304ABCD',
            message: 'QR Code PIX gerado com sucesso',
            paymentUrl: `https://bebcom-cardapio-delivery.onrender.com/api/payment/${orderId}`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pedido',
            message: error.message
        });
    }
});

// Status do pedido
app.get('/api/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!isConnected || !db) {
            return res.json({
                success: true,
                orderId,
                paid: false,
                status: 'pending',
                offline: true
            });
        }
        
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

// Listar endpoints
app.get('/api/endpoints', (req, res) => {
    res.json({
        success: true,
        endpoints: [
            { path: '/', method: 'GET', description: 'Status do serviço' },
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/api/admin-password', method: 'GET', description: 'Obter hash da senha admin' },
            { path: '/api/product-availability', method: 'GET', description: 'Obter disponibilidade de produtos' },
            { path: '/api/flavor-availability', method: 'GET', description: 'Obter disponibilidade de sabores' },
            { path: '/api/sync-all', method: 'GET', description: 'Sincronizar todos os dados' },
            { path: '/api/test-db', method: 'GET', description: 'Testar conexão MongoDB' },
            { path: '/api/endpoints', method: 'GET', description: 'Listar todos endpoints' },
            { path: '/api/order-status/:orderId', method: 'GET', description: 'Verificar status do pedido' }
        ],
        adminEndpoints: [
            { path: '/api/admin/product-availability/bulk', method: 'POST', description: 'Atualizar produtos (admin)' },
            { path: '/api/admin/flavor-availability/bulk', method: 'POST', description: 'Atualizar sabores (admin)' }
        ],
        timestamp: new Date().toISOString()
    });
});

// ========== INICIAR SERVIDOR ==========
async function startServer() {
    try {
        // Iniciar conexão MongoDB em background (não bloqueante)
        connectDB().then(() => {
            console.log('🔌 Conexão MongoDB inicializada');
        }).catch(error => {
            console.error('❌ Falha ao conectar MongoDB:', error);
        });
        
        // Iniciar servidor HTTP IMEDIATAMENTE
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('─'.repeat(60));
            console.log(`✅ SERVIDOR HTTP INICIADO!`);
            console.log(`🌐 Porta: ${PORT}`);
            console.log(`📡 Render Health Check: http://localhost:${PORT}/`);
            console.log(`🔗 Acesse: https://bebcom-cardapio-delivery.onrender.com`);
            console.log(`🗄️  MongoDB: ${isConnected ? '✅ CONECTADO' : '⚠️  OFFLINE'}`);
            console.log('='.repeat(60));
            console.log('📝 Serviço pronto para receber requisições...');
        });
        
        // Otimizar timeout para Render
        server.keepAliveTimeout = 65000; // 65 segundos
        server.headersTimeout = 66000; // 66 segundos
        
        // Graceful shutdown otimizado
        const gracefulShutdown = async (signal) => {
            console.log(`👋 Recebido ${signal}, encerrando graciosamente...`);
            
            // Parar de aceitar novas conexões
            server.close(() => {
                console.log('✅ Servidor HTTP fechado');
                
                // Fechar conexão MongoDB
                if (client) {
                    client.close();
                    console.log('🔌 MongoDB desconectado');
                }
                
                console.log(`🔄 Encerramento completo (${signal})`);
                process.exit(0);
            });
            
            // Timeout forçado após 10 segundos
            setTimeout(() => {
                console.error('❌ Timeout no encerramento, forçando saída...');
                process.exit(1);
            }, 10000);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        console.error('💥 ERRO AO INICIAR SERVIDOR:', error);
        process.exit(1);
    }
}

// Iniciar
startServer();
