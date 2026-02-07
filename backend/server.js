// backend/server.js - VERSÃO PRODUÇÃO RENDER/MONGODB ATLAS
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// ========== CONFIGURAÇÃO CORS PARA PRODUÇÃO RENDER ==========
app.use(cors({
    origin: [
        'https://bebcom-cardapio-delivery.onrender.com',
        'https://*.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

// Middleware para logs detalhados
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Origin:', req.headers.origin);
    if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        console.log('Body recebido:', JSON.stringify(req.body, null, 2).substring(0, 500));
    }
    next();
});

app.use(express.json());

// Middleware para tratamento de preflight
app.options('*', cors());

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'bebcom_delivery';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ========== ROTA RAIZ (CRÍTICA PARA RENDER) ==========
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        version: '4.0',
        timestamp: new Date().toISOString(),
        mongodb: isConnected ? 'connected' : 'disconnected',
        environment: 'production',
        url: req.protocol + '://' + req.get('host')
    });
});

// ========== HEALTH CHECK OTIMIZADO ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API',
        mongodb: isConnected ? 'connected' : 'disconnected',
        mongodbState: isConnected
    });
});

// ========== STATUS MONGODB (PARA DIAGNÓSTICO) ==========
app.get('/api/mongodb-status', async (req, res) => {
    try {
        if (!isConnected || !db) {
            return res.json({
                success: false,
                message: 'MongoDB não conectado',
                state: 'disconnected'
            });
        }
        
        const collections = await db.listCollections().toArray();
        const collectionsCount = await db.collection('products').countDocuments();
        const flavorsCount = await db.collection('flavors').countDocuments();
        
        res.json({
            success: true,
            message: 'MongoDB Atlas conectado com sucesso!',
            timestamp: new Date().toISOString(),
            connection: {
                state: 'connected',
                host: 'mongodb.atlas',
                database: DB_NAME
            },
            collections: collections.map(c => c.name),
            stats: {
                totalCollections: collections.length,
                products: collectionsCount,
                flavors: flavorsCount,
                orders: await db.collection('orders').countDocuments()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            state: 'error'
        });
    }
});

console.log('='.repeat(60));
console.log('🚀 INICIANDO BEBCOM DELIVERY API - PRODUÇÃO');
console.log('='.repeat(60));
console.log(`📅 ${new Date().toISOString()}`);
console.log(`🌐 Porta: ${PORT}`);
console.log(`🔐 Senha Admin: ${ADMIN_PASSWORD ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA'}`);
console.log(`🗄️  MongoDB URI: ${MONGODB_URI ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA'}`);
console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'production'}`);
console.log('─'.repeat(60));

// Conexão MongoDB
let db;
let client;
let isConnected = false;

async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ CRÍTICO: MONGODB_URI não configurada no Render!');
            console.log('⚠️  Servidor rodará em modo offline');
            return false;
        }

        console.log('🔌 Conectando ao MongoDB Atlas...');
        
        // Configuração para MongoDB Atlas
        client = new MongoClient(MONGODB_URI, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            maxPoolSize: 10,
            minPoolSize: 2,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        // Conectar (sem bloquear startup)
        setTimeout(async () => {
            try {
                await client.connect();
                await client.db('admin').command({ ping: 1 });
                db = client.db(DB_NAME);
                isConnected = true;
                console.log('✅ CONEXÃO MONGODB ESTABELECIDA!');
                console.log(`📊 Banco: ${DB_NAME}`);
                
                // Inicializar collections em background
                initializeCollections();
            } catch (error) {
                console.error('❌ MongoDB offline:', error.message);
                console.error('Detalhes do erro:', error);
            }
        }, 1000); // Esperar 1 segundo antes de conectar
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro na configuração MongoDB:', error.message);
        return false;
    }
}

async function initializeCollections() {
    try {
        if (!isConnected) return;
        
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
                        createdAt: new Date().toISOString()
                    });
                }
                if (name === 'flavors') {
                    await db.collection(name).insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }
        
        console.log('✅ Collections OK!');
        
    } catch (error) {
        console.error('❌ Erro nas collections:', error.message);
    }
}

// ========== MIDDLEWARE DE AUTENTICAÇÃO ADMIN ==========
function checkAdminPassword(req, res, next) {
    console.log('🔐 Validando senha administrativa...');
    
    // Verificar senha do corpo da requisição
    const password = req.body.password;
    
    if (!password) {
        console.log('❌ Senha não fornecida no body');
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa não fornecida',
            code: 'NO_PASSWORD'
        });
    }
    
    if (password !== ADMIN_PASSWORD) {
        console.log('❌ Senha incorreta');
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa incorreta',
            code: 'INVALID_PASSWORD'
        });
    }
    
    console.log('✅ Senha validada com sucesso');
    next();
}

// ========== ROTAS DA API ==========

// Obter disponibilidade de produtos
app.get('/api/product-availability', async (req, res) => {
    try {
        if (!isConnected || !db) {
            console.log('⚠️ MongoDB offline, retornando dados locais');
            return res.json({
                success: true,
                productAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true,
                message: 'Modo offline - MongoDB desconectado'
            });
        }
        
        const productData = await db.collection('products').findOne({ type: 'availability' });
        
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
app.get('/api/flavor-availability', async (req, res) => {
    try {
        if (!isConnected || !db) {
            return res.json({
                success: true,
                flavorAvailability: {},
                lastUpdated: new Date().toISOString(),
                offline: true
            });
        }
        
        const flavorData = await db.collection('flavors').findOne({ type: 'availability' });
        
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

// ========== ROTAS ADMIN (COM SENHA NO BODY) ==========

// Atualizar produtos (admin) - VERSÃO CORRIGIDA
app.post('/api/admin/product-availability/bulk', async (req, res) => {
    console.log('📦 Recebendo atualização de produtos...');
    console.log('Body recebido:', JSON.stringify(req.body, null, 2));
    
    try {
        const { productAvailability, password } = req.body;
        
        // VALIDAR SENHA PRIMEIRO
        if (!password) {
            console.log('❌ Senha não fornecida');
            return res.status(401).json({
                success: false,
                error: 'Senha administrativa não fornecida',
                code: 'NO_PASSWORD'
            });
        }
        
        if (password !== ADMIN_PASSWORD) {
            console.log('❌ Senha incorreta');
            return res.status(401).json({
                success: false,
                error: 'Senha administrativa incorreta',
                code: 'INVALID_PASSWORD'
            });
        }
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos - productAvailability é obrigatório'
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
        
        console.log(`💾 Salvando ${Object.keys(productAvailability).length} produtos no MongoDB...`);
        
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
        
        // Log da ação
        await db.collection('admin_logs').insertOne({
            action: 'update_products',
            timestamp: new Date().toISOString(),
            itemsCount: Object.keys(productAvailability).length,
            result: {
                matched: result.matchedCount,
                modified: result.modifiedCount
            }
        });
        
        console.log(`✅ Produtos salvos no MongoDB! Itens: ${Object.keys(productAvailability).length}`);
        console.log('Resultado MongoDB:', result);
        
        res.json({
            success: true,
            message: 'Produtos atualizados com sucesso no MongoDB Atlas',
            timestamp: new Date().toISOString(),
            count: Object.keys(productAvailability).length,
            mongodbResult: {
                matched: result.matchedCount,
                modified: result.modifiedCount,
                upsertedId: result.upsertedId
            },
            saved: true
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            error: `Erro ao salvar produtos: ${error.message}`,
            saved: false
        });
    }
});

// Atualizar sabores (admin) - VERSÃO CORRIGIDA
app.post('/api/admin/flavor-availability/bulk', async (req, res) => {
    console.log('🍹 Recebendo atualização de sabores...');
    
    try {
        const { flavorAvailability, password } = req.body;
        
        // VALIDAR SENHA PRIMEIRO
        if (!password) {
            console.log('❌ Senha não fornecida');
            return res.status(401).json({
                success: false,
                error: 'Senha administrativa não fornecida',
                code: 'NO_PASSWORD'
            });
        }
        
        if (password !== ADMIN_PASSWORD) {
            console.log('❌ Senha incorreta');
            return res.status(401).json({
                success: false,
                error: 'Senha administrativa incorreta',
                code: 'INVALID_PASSWORD'
            });
        }
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos - flavorAvailability é obrigatório'
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
        
        console.log(`💾 Salvando ${Object.keys(flavorAvailability).length} sabores no MongoDB...`);
        
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
        
        // Log da ação
        await db.collection('admin_logs').insertOne({
            action: 'update_flavors',
            timestamp: new Date().toISOString(),
            itemsCount: Object.keys(flavorAvailability).length,
            result: {
                matched: result.matchedCount,
                modified: result.modifiedCount
            }
        });
        
        console.log(`✅ Sabores salvos no MongoDB! Itens: ${Object.keys(flavorAvailability).length}`);
        
        res.json({
            success: true,
            message: 'Sabores atualizados com sucesso no MongoDB Atlas',
            timestamp: new Date().toISOString(),
            count: Object.keys(flavorAvailability).length,
            mongodbResult: {
                matched: result.matchedCount,
                modified: result.modifiedCount
            },
            saved: true
        });
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error.message);
        res.status(500).json({
            success: false,
            error: `Erro ao salvar sabores: ${error.message}`,
            saved: false
        });
    }
});

// Teste de salvamento (para diagnóstico)
app.post('/api/test-save', async (req, res) => {
    console.log('🧪 TEST SAVE endpoint chamado');
    
    try {
        if (!isConnected || !db) {
            return res.status(503).json({
                success: false,
                message: 'MongoDB offline'
            });
        }
        
        const testData = {
            test: true,
            timestamp: new Date().toISOString(),
            data: req.body || {}
        };
        
        const result = await db.collection('test_logs').insertOne(testData);
        
        res.json({
            success: true,
            message: 'Teste de salvamento realizado com sucesso!',
            timestamp: new Date().toISOString(),
            dataReceived: req.body,
            mongodbResult: {
                insertedId: result.insertedId
            },
            server: 'Render Production',
            instanceId: process.env.RENDER_INSTANCE_ID || 'unknown'
        });
        
    } catch (error) {
        console.error('❌ Erro no teste de salvamento:', error);
        res.status(500).json({
            success: false,
            error: error.message
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
                offline: true
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
            offline: false
        });
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.json({
            success: false,
            error: 'Erro na sincronização',
            productAvailability: {},
            flavorAvailability: {}
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
                isConnected: false
            });
        }
        
        // Teste simples
        const testDoc = {
            test: 'ok',
            timestamp: new Date().toISOString(),
            server: 'Render Production'
        };
        
        await db.collection('test').insertOne(testDoc);
        const count = await db.collection('test').countDocuments();
        
        res.json({
            success: true,
            message: 'MongoDB funcionando',
            isConnected: true,
            testCount: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
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
                createdAt: new Date().toISOString()
            };
            
            await db.collection('orders').insertOne(order);
            console.log(`📝 Pedido ${orderId} salvo no MongoDB`);
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

// Listar endpoints
app.get('/api/endpoints', (req, res) => {
    res.json({
        success: true,
        endpoints: [
            { path: '/', method: 'GET', description: 'Status do serviço' },
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/api/mongodb-status', method: 'GET', description: 'Status MongoDB Atlas' },
            { path: '/api/product-availability', method: 'GET', description: 'Obter disponibilidade de produtos' },
            { path: '/api/flavor-availability', method: 'GET', description: 'Obter disponibilidade de sabores' },
            { path: '/api/sync-all', method: 'GET', description: 'Sincronizar todos os dados' },
            { path: '/api/test-db', method: 'GET', description: 'Testar conexão MongoDB' },
            { path: '/api/test-save', method: 'POST', description: 'Teste de salvamento' },
            { path: '/api/endpoints', method: 'GET', description: 'Listar todos endpoints' }
        ],
        adminEndpoints: [
            { path: '/api/admin/product-availability/bulk', method: 'POST', description: 'Atualizar produtos (admin - enviar senha no body)' },
            { path: '/api/admin/flavor-availability/bulk', method: 'POST', description: 'Atualizar sabores (admin - enviar senha no body)' }
        ],
        note: 'Para endpoints admin, enviar senha no campo "password" do body'
    });
});

// ========== INICIAR SERVIDOR ==========
async function startServer() {
    // Iniciar conexão MongoDB em background (não bloqueante)
    connectDB();
    
    // Iniciar servidor HTTP IMEDIATAMENTE
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log('─'.repeat(60));
        console.log(`✅ SERVIDOR HTTP INICIADO!`);
        console.log(`🌐 Porta: ${PORT}`);
        console.log(`📡 Render Health Check: http://localhost:${PORT}/`);
        console.log(`🔗 URL Pública: https://bebcom-cardapio-delivery.onrender.com`);
        console.log(`🗄️  MongoDB: ${MONGODB_URI ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}`);
        console.log(`🔐 Admin: ${ADMIN_PASSWORD ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO'}`);
        console.log('='.repeat(60));
        console.log('📝 Serviço pronto para receber requisições...');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('👋 Recebido SIGTERM, encerrando graciosamente...');
        server.close(() => {
            console.log('✅ Servidor HTTP fechado');
            if (client) {
                client.close();
                console.log('🔌 MongoDB desconectado');
            }
            process.exit(0);
        });
    });
    
    process.on('SIGINT', () => {
        console.log('👋 Recebido SIGINT, encerrando...');
        server.close(() => {
            if (client) client.close();
            process.exit(0);
        });
    });
}

// Iniciar
startServer().catch(error => {
    console.error('💥 ERRO AO INICIAR SERVIDOR:', error);
    process.exit(1);
});
