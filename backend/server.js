// backend/server.js - VERSÃO FINAL COM MONGODB
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'bebcom_delivery';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// Conexão MongoDB
let db;
let client;
let isConnected = false;

async function connectDB() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI não configurada');
            return false;
        }

        console.log('🔌 Conectando ao MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        isConnected = true;
        
        console.log('✅ MongoDB Atlas conectado!');
        console.log(`📊 Banco: ${DB_NAME}`);
        
        // Inicializar collections se necessário
        await initializeCollections();
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message);
        return false;
    }
}

async function initializeCollections() {
    try {
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        // Criar collections se não existirem
        const requiredCollections = ['products', 'flavors', 'orders'];
        
        for (const collection of requiredCollections) {
            if (!collectionNames.includes(collection)) {
                await db.createCollection(collection);
                console.log(`✅ Collection ${collection} criada`);
                
                // Inicializar com dados vazios
                if (collection === 'products') {
                    await db.collection('products').insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    });
                }
                if (collection === 'flavors') {
                    await db.collection('flavors').insertOne({
                        type: 'availability',
                        data: {},
                        lastUpdated: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar collections:', error.message);
    }
}

// Middleware de autenticação
function checkAdminPassword(req, res, next) {
    const password = req.body.password || req.headers['x-admin-password'];
    
    if (!password) {
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa não fornecida'
        });
    }
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            error: 'Senha administrativa incorreta'
        });
    }
    
    next();
}

// Health Check
app.get('/health', async (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API',
        version: '3.1',
        mongodb: isConnected ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'production'
    });
});

// Obter disponibilidade de produtos
app.get('/api/product-availability', async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(500).json({
                success: false,
                error: 'Database não conectado',
                data: {}
            });
        }
        
        const productData = await db.collection('products').findOne({ type: 'availability' });
        
        res.json({
            success: true,
            productAvailability: productData?.data || {},
            lastUpdated: productData?.lastUpdated || new Date().toISOString()
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
        if (!isConnected) {
            return res.json({
                success: false,
                error: 'Database não conectado',
                data: {}
            });
        }
        
        const flavorData = await db.collection('flavors').findOne({ type: 'availability' });
        
        res.json({
            success: true,
            flavorAvailability: flavorData?.data || {},
            lastUpdated: flavorData?.lastUpdated || new Date().toISOString()
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

// Atualizar produtos (admin)
app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(500).json({
                success: false,
                error: 'Database não conectado'
            });
        }
        
        const { productAvailability } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        await db.collection('products').updateOne(
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
        
        console.log(`📦 Produtos atualizados: ${Object.keys(productAvailability).length} itens`);
        
        res.json({
            success: true,
            message: 'Produtos atualizados com sucesso',
            timestamp: new Date().toISOString(),
            count: Object.keys(productAvailability).length
        });
    } catch (error) {
        console.error('Erro ao salvar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar produtos'
        });
    }
});

// Atualizar sabores (admin)
app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(500).json({
                success: false,
                error: 'Database não conectado'
            });
        }
        
        const { flavorAvailability } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos'
            });
        }
        
        await db.collection('flavors').updateOne(
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
        
        console.log(`🍹 Sabores atualizados: ${Object.keys(flavorAvailability).length} itens`);
        
        res.json({
            success: true,
            message: 'Sabores atualizados com sucesso',
            timestamp: new Date().toISOString(),
            count: Object.keys(flavorAvailability).length
        });
    } catch (error) {
        console.error('Erro ao salvar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar sabores'
        });
    }
});

// Criar pedido
app.post('/api/create-payment', async (req, res) => {
    try {
        const { orderId, customer, items, deliveryType, paymentMethod, totalAmount, deliveryFee } = req.body;
        
        if (!orderId || !customer || !items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Dados do pedido inválidos'
            });
        }
        
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
                createdAt: new Date().toISOString()
            };
            
            await db.collection('orders').insertOne(order);
            console.log(`📝 Pedido salvo: ${orderId}`);
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

// Sincronizar dados
app.get('/api/sync-all', async (req, res) => {
    try {
        if (!isConnected) {
            return res.json({
                success: false,
                error: 'Database não conectado',
                productAvailability: {},
                flavorAvailability: {}
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
            lastSync: new Date().toISOString()
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

// Rota de teste
app.get('/api/test', async (req, res) => {
    try {
        if (!isConnected) {
            throw new Error('MongoDB não conectado');
        }
        
        // Testar escrita
        const testData = {
            test: 'ok',
            timestamp: new Date().toISOString()
        };
        
        await db.collection('test').insertOne(testData);
        
        // Testar leitura
        const lastTest = await db.collection('test')
            .find()
            .sort({ _id: -1 })
            .limit(1)
            .toArray();
        
        res.json({
            success: true,
            message: 'Teste do MongoDB realizado com sucesso',
            write: testData,
            read: lastTest[0],
            isConnected: true
        });
    } catch (error) {
        res.json({
            success: false,
            message: 'Teste do MongoDB falhou',
            error: error.message,
            isConnected: false
        });
    }
});

// Listar pedidos (admin)
app.get('/api/admin/orders', checkAdminPassword, async (req, res) => {
    try {
        if (!isConnected) {
            return res.status(500).json({
                success: false,
                error: 'Database não conectado'
            });
        }
        
        const orders = await db.collection('orders')
            .find()
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
        
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
        }
    });
});

// Rota principal
app.get('/', (req, res) => {
    res.json({
        service: 'BebCom Delivery API',
        version: '3.1',
        status: 'online',
        database: isConnected ? 'connected' : 'disconnected',
        endpoints: [
            '/health',
            '/api/product-availability',
            '/api/flavor-availability',
            '/api/sync-all',
            '/api/config'
        ]
    });
});

// Iniciar servidor
async function startServer() {
    console.log('🚀 Iniciando BebCom Delivery API...');
    
    // Conectar ao MongoDB
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
        console.log('⚠️  Servidor iniciando sem MongoDB (modo fallback)');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Servidor rodando na porta ${PORT}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`🔐 Admin: ${ADMIN_PASSWORD}`);
        console.log(`📊 MongoDB: ${isConnected ? '✅ Conectado' : '❌ Offline'}`);
        console.log('='.repeat(50));
    });
}

// Encerramento gracioso
process.on('SIGTERM', async () => {
    console.log('👋 Encerrando servidor...');
    if (client) {
        await client.close();
        console.log('🔌 MongoDB desconectado');
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('👋 Servidor interrompido');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

// Iniciar
startServer().catch(console.error);
