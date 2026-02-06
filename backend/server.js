// server.js - Backend Seguro para BebCom Delivery
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// ====== CONFIGURAÇÕES INICIAIS ======

// Middleware CORS corrigido
app.use(cors({
    origin: '*', // Permite todas origens (em produção restrinja)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-key', 'Authorization']
}));

app.use(express.json());
app.disable('x-powered-by');

// Configurações do ambiente
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bebcom';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'Bebcom25*';
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ====== CONEXÃO COM MONGODB ======

// Conectar ao MongoDB com fallback
async function connectToMongoDB() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        console.log('✅ MongoDB conectado');
    } catch (error) {
        console.log('⚠️ MongoDB não disponível, usando modo fallback');
        // Modo fallback - sistema funciona sem MongoDB
    }
}

connectToMongoDB();

// ====== MODELS EM MEMÓRIA (FALLBACK) ======
let productAvailabilityCache = {};
let flavorAvailabilityCache = {};
let ordersCache = {};

// ====== ROTAS BÁSICAS (SEMPRE FUNCIONAM) ======

// Rota de health check - CRÍTICA
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'BebCom Delivery API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        mode: NODE_ENV,
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Rota raiz - redireciona para health
app.get('/', (req, res) => {
    res.json({
        message: '🍹 BebCom Delivery API',
        endpoints: {
            health: 'GET /health',
            products: 'GET /api/product-availability',
            flavors: 'GET /api/flavor-availability',
            sync: 'GET /api/sync-all',
            createPayment: 'POST /api/create-payment'
        },
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

// ====== ROTAS DA API COM FALLBACK ======

// Obter disponibilidade de produtos
app.get('/api/product-availability', async (req, res) => {
    try {
        // Tentar MongoDB primeiro
        const ProductAvailability = mongoose.models.ProductAvailability;
        if (ProductAvailability) {
            const products = await ProductAvailability.find({}, 'productId isAvailable lastUpdated');
            const availability = {};
            products.forEach(product => {
                availability[product.productId] = product.isAvailable;
            });
            return res.json({ 
                success: true,
                productAvailability: availability,
                timestamp: new Date().toISOString(),
                source: 'mongodb'
            });
        }
    } catch (error) {
        console.log('⚠️ Fallback para cache de produtos');
    }
    
    // Fallback para cache
    res.json({ 
        success: true,
        productAvailability: productAvailabilityCache,
        timestamp: new Date().toISOString(),
        source: 'cache'
    });
});

// Obter disponibilidade de sabores
app.get('/api/flavor-availability', async (req, res) => {
    try {
        // Tentar MongoDB primeiro
        const FlavorAvailability = mongoose.models.FlavorAvailability;
        if (FlavorAvailability) {
            const flavors = await FlavorAvailability.find({}, 'flavorKey isAvailable lastUpdated');
            const availability = {};
            flavors.forEach(flavor => {
                availability[flavor.flavorKey] = flavor.isAvailable;
            });
            return res.json({ 
                success: true,
                flavorAvailability: availability,
                timestamp: new Date().toISOString(),
                source: 'mongodb'
            });
        }
    } catch (error) {
        console.log('⚠️ Fallback para cache de sabores');
    }
    
    // Fallback para cache
    res.json({ 
        success: true,
        flavorAvailability: flavorAvailabilityCache,
        timestamp: new Date().toISOString(),
        source: 'cache'
    });
});

// Sincronização completa
app.get('/api/sync-all', async (req, res) => {
    try {
        let productAvailability = {};
        let flavorAvailability = {};
        let source = 'cache';
        
        // Tentar MongoDB
        if (mongoose.connection.readyState === 1) {
            const ProductAvailability = mongoose.models.ProductAvailability;
            const FlavorAvailability = mongoose.models.FlavorAvailability;
            
            if (ProductAvailability && FlavorAvailability) {
                const products = await ProductAvailability.find({}, 'productId isAvailable');
                const flavors = await FlavorAvailability.find({}, 'flavorKey isAvailable');
                
                products.forEach(p => productAvailability[p.productId] = p.isAvailable);
                flavors.forEach(f => flavorAvailability[f.flavorKey] = f.isAvailable);
                
                source = 'mongodb';
            }
        } else {
            // Usar cache
            productAvailability = productAvailabilityCache;
            flavorAvailability = flavorAvailabilityCache;
        }
        
        res.json({
            success: true,
            productAvailability,
            flavorAvailability,
            timestamp: new Date().toISOString(),
            source
        });
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno',
            timestamp: new Date().toISOString()
        });
    }
});

// ====== ROTAS DE PAGAMENTO ======

// Criar pagamento
app.post('/api/create-payment', async (req, res) => {
    try {
        const { 
            orderId, 
            customer, 
            items, 
            deliveryType, 
            paymentMethod, 
            totalAmount,
            deliveryFee 
        } = req.body;

        // Validar dados mínimos
        if (!orderId || !customer || !items || items.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Dados incompletos' 
            });
        }

        // Gerar resposta PIX simulada
        const pixResponse = {
            success: true,
            paymentType: 'pix',
            orderId: orderId || `BEB${Date.now()}`,
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${totalAmount || 0}:BebComDelivery`)}`,
            copyPasteKey: generatePixKey(),
            instructions: 'Pague via PIX usando o QR Code ou chave acima',
            expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            timestamp: new Date().toISOString()
        };

        // Tentar salvar no MongoDB
        try {
            if (mongoose.connection.readyState === 1) {
                const Order = mongoose.model('Order') || mongoose.model('Order', new mongoose.Schema({
                    orderId: String,
                    customer: Object,
                    items: Array,
                    totalAmount: Number,
                    status: { type: String, default: 'pending' },
                    createdAt: { type: Date, default: Date.now }
                }));
                
                await Order.create({
                    orderId: pixResponse.orderId,
                    customer,
                    items,
                    totalAmount: totalAmount || 0,
                    status: 'pending'
                });
                
                pixResponse.saved = 'mongodb';
            } else {
                // Salvar em cache
                ordersCache[pixResponse.orderId] = {
                    customer,
                    items,
                    totalAmount: totalAmount || 0,
                    createdAt: new Date().toISOString()
                };
                pixResponse.saved = 'cache';
            }
        } catch (saveError) {
            console.log('⚠️ Não foi possível salvar pedido:', saveError.message);
            pixResponse.saved = 'failed';
        }

        res.json(pixResponse);

    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor',
            timestamp: new Date().toISOString()
        });
    }
});

// Verificar status do pedido
app.get('/api/order-status/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        let order = null;
        let source = 'cache';
        
        // Tentar MongoDB
        if (mongoose.connection.readyState === 1) {
            const Order = mongoose.models.Order;
            if (Order) {
                order = await Order.findOne({ orderId });
                if (order) source = 'mongodb';
            }
        }
        
        // Tentar cache
        if (!order && ordersCache[orderId]) {
            order = ordersCache[orderId];
            source = 'cache';
        }
        
        if (!order) {
            return res.status(404).json({ 
                success: false,
                error: 'Pedido não encontrado' 
            });
        }
        
        res.json({
            success: true,
            orderId,
            status: order.status || 'pending',
            paid: (order.status || 'pending') === 'paid',
            totalAmount: order.totalAmount || 0,
            createdAt: order.createdAt,
            source
        });
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno' 
        });
    }
});

// ====== MIDDLEWARE DE AUTENTICAÇÃO ======
const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    
    if (!adminKey) {
        return res.status(401).json({ 
            success: false,
            error: 'Chave administrativa necessária' 
        });
    }
    
    if (adminKey !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ 
            success: false,
            error: 'Chave administrativa inválida' 
        });
    }
    
    next();
};

// ====== ROTAS ADMINISTRATIVAS ======

// Atualizar disponibilidade de produtos
app.post('/api/admin/product-availability/bulk', authenticateAdmin, async (req, res) => {
    try {
        const { productAvailability, adminName = 'Admin' } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({ 
                success: false,
                error: 'Dados inválidos' 
            });
        }
        
        // Atualizar cache
        productAvailabilityCache = { ...productAvailabilityCache, ...productAvailability };
        
        // Tentar salvar no MongoDB
        try {
            if (mongoose.connection.readyState === 1) {
                const ProductAvailability = mongoose.model('ProductAvailability') || 
                    mongoose.model('ProductAvailability', new mongoose.Schema({
                        productId: String,
                        isAvailable: Boolean,
                        lastUpdated: { type: Date, default: Date.now }
                    }));
                
                const bulkOps = Object.entries(productAvailability).map(([productId, isAvailable]) => ({
                    updateOne: {
                        filter: { productId },
                        update: { 
                            $set: { 
                                isAvailable: Boolean(isAvailable),
                                lastUpdated: new Date()
                            }
                        },
                        upsert: true
                    }
                }));
                
                if (bulkOps.length > 0) {
                    await ProductAvailability.bulkWrite(bulkOps);
                }
            }
        } catch (mongoError) {
            console.log('⚠️ Não foi possível salvar no MongoDB:', mongoError.message);
        }
        
        res.json({ 
            success: true, 
            message: `Disponibilidade de ${Object.keys(productAvailability).length} produtos atualizada`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Atualizar disponibilidade de sabores
app.post('/api/admin/flavor-availability/bulk', authenticateAdmin, async (req, res) => {
    try {
        const { flavorAvailability, adminName = 'Admin' } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({ 
                success: false,
                error: 'Dados inválidos' 
            });
        }
        
        // Atualizar cache
        flavorAvailabilityCache = { ...flavorAvailabilityCache, ...flavorAvailability };
        
        // Tentar salvar no MongoDB
        try {
            if (mongoose.connection.readyState === 1) {
                const FlavorAvailability = mongoose.model('FlavorAvailability') || 
                    mongoose.model('FlavorAvailability', new mongoose.Schema({
                        flavorKey: String,
                        isAvailable: Boolean,
                        lastUpdated: { type: Date, default: Date.now }
                    }));
                
                const bulkOps = Object.entries(flavorAvailability).map(([flavorKey, isAvailable]) => ({
                    updateOne: {
                        filter: { flavorKey },
                        update: { 
                            $set: { 
                                isAvailable: Boolean(isAvailable),
                                lastUpdated: new Date()
                            }
                        },
                        upsert: true
                    }
                }));
                
                if (bulkOps.length > 0) {
                    await FlavorAvailability.bulkWrite(bulkOps);
                }
            }
        } catch (mongoError) {
            console.log('⚠️ Não foi possível salvar no MongoDB:', mongoError.message);
        }
        
        res.json({ 
            success: true, 
            message: `Disponibilidade de ${Object.keys(flavorAvailability).length} sabores atualizada`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ====== FUNÇÕES UTILITÁRIAS ======

function generatePixKey() {
    const randomKey = crypto.randomBytes(20).toString('hex').toUpperCase();
    return `${randomKey.substring(0,8)}-${randomKey.substring(8,12)}-${randomKey.substring(12,16)}-${randomKey.substring(16,20)}`;
}

// ====== ROTA DE FALLBACK PARA 404 ======
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        requestedUrl: req.url,
        availableEndpoints: [
            'GET /health',
            'GET /',
            'GET /api/product-availability',
            'GET /api/flavor-availability',
            'GET /api/sync-all',
            'POST /api/create-payment',
            'GET /api/order-status/:orderId'
        ],
        timestamp: new Date().toISOString()
    });
});

// ====== INICIAR SERVIDOR ======

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor BebCom Backend rodando na porta ${PORT}`);
    console.log(`🌐 Modo: ${NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Root: http://localhost:${PORT}/`);
    console.log(`🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Conectado' : '⚠️ Usando cache'}`);
});
