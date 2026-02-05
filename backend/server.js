// server.js - Backend Seguro para BebCom Delivery
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

// Configuração de segurança
app.disable('x-powered-by');

// Variáveis de ambiente (configure no Render)
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'Bebcom25*';
const PORT = process.env.PORT || 3000;

// Conectar ao MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => {
    console.error('❌ Erro MongoDB:', err.message);
    process.exit(1);
});

// ====== SCHEMAS ======

// Schema para disponibilidade de produtos
const ProductAvailabilitySchema = new mongoose.Schema({
    productId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    isAvailable: { 
        type: Boolean, 
        default: true 
    },
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    },
    updatedBy: {
        type: String,
        default: 'system'
    }
});

// Schema para disponibilidade de sabores
const FlavorAvailabilitySchema = new mongoose.Schema({
    flavorKey: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    flavorType: String,
    flavorName: String,
    isAvailable: { 
        type: Boolean, 
        default: true 
    },
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    },
    updatedBy: {
        type: String,
        default: 'system'
    }
});

// Schema para pedidos
const OrderSchema = new mongoose.Schema({
    orderId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    customer: {
        name: String,
        phone: String,
        email: String
    },
    items: [{
        name: String,
        quantity: Number,
        price: Number,
        flavors: Object,
        productId: String
    }],
    deliveryType: String,
    paymentMethod: String,
    status: {
        type: String,
        enum: ['pending', 'paid', 'delivered', 'cancelled'],
        default: 'pending'
    },
    totalAmount: Number,
    deliveryFee: Number,
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    paidAt: Date
});

// Schema para logs administrativos
const ChangeLogSchema = new mongoose.Schema({
    adminIp: String,
    action: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

const ProductAvailability = mongoose.model('ProductAvailability', ProductAvailabilitySchema);
const FlavorAvailability = mongoose.model('FlavorAvailability', FlavorAvailabilitySchema);
const Order = mongoose.model('Order', OrderSchema);
const ChangeLog = mongoose.model('ChangeLog', ChangeLogSchema);

// ====== MIDDLEWARE DE AUTENTICAÇÃO ======
const authenticateAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    
    if (!adminKey) {
        return res.status(401).json({ error: 'Chave administrativa necessária' });
    }
    
    if (adminKey !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Chave administrativa inválida' });
    }
    
    next();
};

// ====== ROTAS PÚBLICAS ======

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date(),
        service: 'BebCom Backend'
    });
});

// Obter disponibilidade de produtos (público)
app.get('/api/product-availability', async (req, res) => {
    try {
        const products = await ProductAvailability.find({}, 'productId isAvailable lastUpdated');
        const availability = {};
        
        products.forEach(product => {
            availability[product.productId] = product.isAvailable;
        });
        
        res.json({ 
            success: true,
            productAvailability: availability,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter disponibilidade de sabores (público)
app.get('/api/flavor-availability', async (req, res) => {
    try {
        const flavors = await FlavorAvailability.find({}, 'flavorKey isAvailable lastUpdated');
        const availability = {};
        
        flavors.forEach(flavor => {
            availability[flavor.flavorKey] = flavor.isAvailable;
        });
        
        res.json({ 
            success: true,
            flavorAvailability: availability,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Erro ao carregar sabores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Sincronização completa (pública)
app.get('/api/sync-all', async (req, res) => {
    try {
        // Carregar produtos
        const products = await ProductAvailability.find({}, 'productId isAvailable');
        const productAvailability = {};
        products.forEach(p => productAvailability[p.productId] = p.isAvailable);
        
        // Carregar sabores
        const flavors = await FlavorAvailability.find({}, 'flavorKey isAvailable');
        const flavorAvailability = {};
        flavors.forEach(f => flavorAvailability[f.flavorKey] = f.isAvailable);
        
        res.json({
            success: true,
            timestamp: new Date(),
            productAvailability,
            flavorAvailability,
            message: 'Dados sincronizados com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ====== ROTAS DE PAGAMENTO ======

// Criar pagamento PIX
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

        // Validar dados
        if (!orderId || !customer || !items || items.length === 0) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        // Salvar pedido no banco
        const order = new Order({
            orderId,
            customer,
            items,
            deliveryType,
            paymentMethod,
            totalAmount,
            deliveryFee,
            status: 'pending'
        });

        await order.save();

        // Gerar dados PIX (simulação)
        const pixData = {
            qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${totalAmount}:BebComDelivery`)}`,
            copyPasteKey: generatePixKey(),
            expiration: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
            transactionId: `PIX${Date.now()}`
        };

        res.json({
            success: true,
            paymentType: 'pix',
            ...pixData,
            instructions: 'Pague via PIX usando o QR Code acima'
        });

    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Verificar status do pedido
app.get('/api/order-status/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        
        res.json({
            orderId: order.orderId,
            status: order.status,
            paid: order.status === 'paid',
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            paidAt: order.paidAt
        });
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ====== ROTAS ADMINISTRATIVAS (PROTEGIDAS) ======

// Salvar disponibilidade de produtos
app.post('/api/admin/product-availability/bulk', authenticateAdmin, async (req, res) => {
    try {
        const { productAvailability, adminName = 'Admin' } = req.body;
        const adminIp = req.ip;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({ error: 'Dados inválidos' });
        }
        
        // Log da ação
        await ChangeLog.create({
            adminIp,
            action: 'product_bulk_update',
            details: { 
                updatedCount: Object.keys(productAvailability).length,
                adminName 
            }
        });
        
        // Atualizar cada produto
        const bulkOps = Object.entries(productAvailability).map(([productId, isAvailable]) => ({
            updateOne: {
                filter: { productId },
                update: { 
                    $set: { 
                        isAvailable: isAvailable === true || isAvailable === 'true',
                        lastUpdated: new Date(),
                        updatedBy: adminName
                    }
                },
                upsert: true
            }
        }));
        
        if (bulkOps.length > 0) {
            await ProductAvailability.bulkWrite(bulkOps);
        }
        
        res.json({ 
            success: true, 
            message: `Disponibilidade de ${bulkOps.length} produtos atualizada`,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Salvar disponibilidade de sabores
app.post('/api/admin/flavor-availability/bulk', authenticateAdmin, async (req, res) => {
    try {
        const { flavorAvailability, adminName = 'Admin' } = req.body;
        const adminIp = req.ip;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({ error: 'Dados inválidos' });
        }
        
        // Log da ação
        await ChangeLog.create({
            adminIp,
            action: 'flavor_bulk_update',
            details: { 
                updatedCount: Object.keys(flavorAvailability).length,
                adminName 
            }
        });
        
        // Atualizar cada sabor
        const bulkOps = Object.entries(flavorAvailability).map(([flavorKey, isAvailable]) => {
            const [flavorType, ...flavorNameParts] = flavorKey.split('_');
            const flavorName = flavorNameParts.join('_');
            
            return {
                updateOne: {
                    filter: { flavorKey },
                    update: { 
                        $set: { 
                            flavorType,
                            flavorName,
                            isAvailable: isAvailable === true || isAvailable === 'true',
                            lastUpdated: new Date(),
                            updatedBy: adminName
                        }
                    },
                    upsert: true
                }
            };
        });
        
        if (bulkOps.length > 0) {
            await FlavorAvailability.bulkWrite(bulkOps);
        }
        
        res.json({ 
            success: true, 
            message: `Disponibilidade de ${bulkOps.length} sabores atualizada`,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obter logs administrativos
app.get('/api/admin/changelogs', authenticateAdmin, async (req, res) => {
    try {
        const logs = await ChangeLog.find({})
            .sort({ timestamp: -1 })
            .limit(100);
        res.json({ 
            success: true,
            logs,
            count: logs.length 
        });
    } catch (error) {
        console.error('❌ Erro ao carregar logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obter relatório de pedidos
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        
        const filter = {};
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        if (status) filter.status = status;
        
        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .limit(100);
        
        const totalRevenue = orders
            .filter(o => o.status === 'paid')
            .reduce((sum, o) => sum + o.totalAmount, 0);
        
        res.json({
            success: true,
            orders,
            stats: {
                totalOrders: orders.length,
                totalRevenue,
                pending: orders.filter(o => o.status === 'pending').length,
                paid: orders.filter(o => o.status === 'paid').length,
                delivered: orders.filter(o => o.status === 'delivered').length
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar pedidos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ====== FUNÇÕES UTILITÁRIAS ======

function generatePixKey() {
    const randomKey = crypto.randomBytes(20).toString('hex').toUpperCase();
    return `${randomKey.substring(0,8)}-${randomKey.substring(8,12)}-${randomKey.substring(12,16)}-${randomKey.substring(16,20)}`;
}

// ====== INICIAR SERVIDOR ======

app.listen(PORT, () => {
    console.log(`🚀 Servidor BebCom Backend rodando na porta ${PORT}`);
    console.log(`🌐 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  MongoDB: ${MONGODB_URI ? 'Conectado' : 'Não configurado'}`);
});
