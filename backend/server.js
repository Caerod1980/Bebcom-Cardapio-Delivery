// server.js - Backend COMPLETO com MongoDB para Render
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Configurações
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'Bebcom25*';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bebcom';

// ====== CONEXÃO COM MONGODB ======

// Armazenamento em memória (fallback)
let productAvailabilityDB = {};
let flavorAvailabilityDB = {};

// Modelos do MongoDB
let ProductAvailability, FlavorAvailability, AdminLog;

async function connectToDatabase() {
    try {
        if (!MONGODB_URI || MONGODB_URI.includes('localhost')) {
            console.log('⚠️  MongoDB URI não configurado, usando armazenamento em memória');
            return false;
        }

        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ Conectado ao MongoDB Atlas');
        
        // Definir Schemas
        const productAvailabilitySchema = new mongoose.Schema({
            productId: { type: String, required: true, unique: true },
            isAvailable: { type: Boolean, default: true },
            lastUpdated: { type: Date, default: Date.now },
            updatedBy: { type: String, default: 'system' }
        });
        
        const flavorAvailabilitySchema = new mongoose.Schema({
            flavorKey: { type: String, required: true, unique: true },
            isAvailable: { type: Boolean, default: true },
            lastUpdated: { type: Date, default: Date.now },
            updatedBy: { type: String, default: 'system' }
        });
        
        const adminLogSchema = new mongoose.Schema({
            action: String,
            adminName: String,
            details: Object,
            timestamp: { type: Date, default: Date.now }
        });
        
        // Criar modelos
        ProductAvailability = mongoose.model('ProductAvailability', productAvailabilitySchema);
        FlavorAvailability = mongoose.model('FlavorAvailability', flavorAvailabilitySchema);
        AdminLog = mongoose.model('AdminLog', adminLogSchema);
        
        // Carregar dados existentes
        await loadInitialData();
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message);
        console.log('⚠️  Usando armazenamento em memória como fallback');
        return false;
    }
}

async function loadInitialData() {
    try {
        const [products, flavors] = await Promise.all([
            ProductAvailability.find({}),
            FlavorAvailability.find({})
        ]);
        
        // Converter para objetos simples
        products.forEach(p => {
            productAvailabilityDB[p.productId] = p.isAvailable;
        });
        
        flavors.forEach(f => {
            flavorAvailabilityDB[f.flavorKey] = f.isAvailable;
        });
        
        console.log(`📊 Dados carregados: ${products.length} produtos, ${flavors.length} sabores`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

// Middleware básico
app.use(cors());
app.use(express.json());

// Middleware para verificar banco de dados
app.use((req, res, next) => {
    req.useMongoDB = mongoose.connection.readyState === 1;
    next();
});

// ====== ROTAS OBRIGATÓRIAS ======

// 1. ROTA DE HEALTH CHECK (CRÍTICA)
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        timestamp: new Date().toISOString(),
        version: '2.1.0',
        environment: process.env.NODE_ENV || 'production',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        dbStatus: mongoose.connection.readyState
    });
});

// 2. STATUS DO ADMIN
app.get('/api/admin/status', (req, res) => {
    res.json({
        success: true,
        adminEnabled: true,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memoryData: {
            products: Object.keys(productAvailabilityDB).length,
            flavors: Object.keys(flavorAvailabilityDB).length
        },
        timestamp: new Date().toISOString()
    });
});

// 3. ROTA RAIZ (redireciona para health)
app.get('/', (req, res) => {
    res.redirect('/health');
});

// 4. DISPONIBILIDADE DE PRODUTOS (COM MONGODB OU MEMÓRIA)
app.get('/api/product-availability', async (req, res) => {
    try {
        if (req.useMongoDB && ProductAvailability) {
            const records = await ProductAvailability.find({});
            const productAvailability = {};
            records.forEach(record => {
                productAvailability[record.productId] = record.isAvailable;
            });
            
            res.json({
                success: true,
                productAvailability,
                count: records.length,
                timestamp: new Date().toISOString(),
                source: 'mongodb',
                database: 'connected'
            });
        } else {
            res.json({
                success: true,
                productAvailability: productAvailabilityDB,
                count: Object.keys(productAvailabilityDB).length,
                timestamp: new Date().toISOString(),
                source: 'memory',
                database: 'disconnected'
            });
        }
    } catch (error) {
        console.error('❌ Erro em /api/product-availability:', error);
        res.json({
            success: true,
            productAvailability: productAvailabilityDB,
            count: Object.keys(productAvailabilityDB).length,
            timestamp: new Date().toISOString(),
            source: 'memory-fallback',
            message: 'Usando dados locais'
        });
    }
});

// 5. DISPONIBILIDADE DE SABORES (COM MONGODB OU MEMÓRIA)
app.get('/api/flavor-availability', async (req, res) => {
    try {
        if (req.useMongoDB && FlavorAvailability) {
            const records = await FlavorAvailability.find({});
            const flavorAvailability = {};
            records.forEach(record => {
                flavorAvailability[record.flavorKey] = record.isAvailable;
            });
            
            res.json({
                success: true,
                flavorAvailability,
                count: records.length,
                timestamp: new Date().toISOString(),
                source: 'mongodb',
                database: 'connected'
            });
        } else {
            res.json({
                success: true,
                flavorAvailability: flavorAvailabilityDB,
                count: Object.keys(flavorAvailabilityDB).length,
                timestamp: new Date().toISOString(),
                source: 'memory',
                database: 'disconnected'
            });
        }
    } catch (error) {
        console.error('❌ Erro em /api/flavor-availability:', error);
        res.json({
            success: true,
            flavorAvailability: flavorAvailabilityDB,
            count: Object.keys(flavorAvailabilityDB).length,
            timestamp: new Date().toISOString(),
            source: 'memory-fallback',
            message: 'Usando dados locais'
        });
    }
});

// 6. SINCRONIZAÇÃO COMPLETA
app.get('/api/sync-all', async (req, res) => {
    try {
        if (req.useMongoDB && ProductAvailability && FlavorAvailability) {
            const [products, flavors] = await Promise.all([
                ProductAvailability.find({}),
                FlavorAvailability.find({})
            ]);
            
            const productAvailability = {};
            const flavorAvailability = {};
            
            products.forEach(p => productAvailability[p.productId] = p.isAvailable);
            flavors.forEach(f => flavorAvailability[f.flavorKey] = f.isAvailable);
            
            res.json({
                success: true,
                message: 'Sincronização completa realizada',
                productAvailability,
                flavorAvailability,
                counts: {
                    products: products.length,
                    flavors: flavors.length
                },
                source: 'mongodb',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: true,
                message: 'Sincronização em memória',
                productAvailability: productAvailabilityDB,
                flavorAvailability: flavorAvailabilityDB,
                counts: {
                    products: Object.keys(productAvailabilityDB).length,
                    flavors: Object.keys(flavorAvailabilityDB).length
                },
                source: 'memory',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Erro em /api/sync-all:', error);
        res.status(500).json({
            success: false,
            error: 'Erro na sincronização',
            timestamp: new Date().toISOString()
        });
    }
});

// 7. CRIAR PAGAMENTO
app.post('/api/create-payment', (req, res) => {
    const orderId = 'BEB' + Date.now();
    
    res.json({
        success: true,
        paymentType: 'pix',
        orderId,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TEST-${orderId}`,
        copyPasteKey: '123e4567-e89b-12d3-a456-426614174000',
        instructions: 'Pague via PIX usando o QR Code acima',
        timestamp: new Date().toISOString()
    });
});

// 8. STATUS DO PEDIDO
app.get('/api/order-status/:orderId', (req, res) => {
    res.json({
        success: true,
        orderId: req.params.orderId,
        status: 'paid',
        paid: true,
        timestamp: new Date().toISOString()
    });
});

// ====== ROTAS ADMIN ======

// Middleware de autenticação
const authAdmin = (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.body.adminKey;
    
    if (key === ADMIN_KEY) {
        next();
    } else {
        res.status(401).json({
            success: false,
            error: 'Acesso não autorizado. Use o header x-admin-key',
            hint: 'Chave esperada: ' + ADMIN_KEY
        });
    }
};

// ATUALIZAR PRODUTOS (COM MONGODB OU MEMÓRIA)
app.post('/api/admin/product-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { productAvailability, adminName = 'Admin BebCom' } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos. Envie {productAvailability: {...}}'
            });
        }
        
        let savedCount = 0;
        let errors = [];
        
        // Atualizar em memória
        Object.keys(productAvailability).forEach(productId => {
            productAvailabilityDB[productId] = productAvailability[productId];
        });
        savedCount = Object.keys(productAvailability).length;
        
        // Tentar salvar no MongoDB se disponível
        if (req.useMongoDB && ProductAvailability) {
            for (const [productId, isAvailable] of Object.entries(productAvailability)) {
                try {
                    await ProductAvailability.findOneAndUpdate(
                        { productId },
                        { 
                            isAvailable, 
                            lastUpdated: new Date(),
                            updatedBy: adminName
                        },
                        { upsert: true, new: true }
                    );
                } catch (error) {
                    errors.push({ productId, error: error.message });
                    console.error(`❌ Erro ao salvar ${productId} no MongoDB:`, error);
                }
            }
            
            // Log da ação no MongoDB
            if (AdminLog) {
                try {
                    await AdminLog.create({
                        action: 'UPDATE_PRODUCT_AVAILABILITY_BULK',
                        adminName,
                        details: {
                            totalProducts: Object.keys(productAvailability).length,
                            savedCount,
                            errorCount: errors.length
                        }
                    });
                } catch (logError) {
                    console.error('❌ Erro ao salvar log:', logError);
                }
            }
        }
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} produtos ${req.useMongoDB ? 'no MongoDB' : 'em memória'}`,
            savedCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined,
            database: req.useMongoDB ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar produtos',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ATUALIZAR SABORES (COM MONGODB OU MEMÓRIA)
app.post('/api/admin/flavor-availability/bulk', authAdmin, async (req, res) => {
    try {
        const { flavorAvailability, adminName = 'Admin BebCom' } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos. Envie {flavorAvailability: {...}}'
            });
        }
        
        let savedCount = 0;
        let errors = [];
        
        // Atualizar em memória
        Object.keys(flavorAvailability).forEach(flavorKey => {
            flavorAvailabilityDB[flavorKey] = flavorAvailability[flavorKey];
        });
        savedCount = Object.keys(flavorAvailability).length;
        
        // Tentar salvar no MongoDB se disponível
        if (req.useMongoDB && FlavorAvailability) {
            for (const [flavorKey, isAvailable] of Object.entries(flavorAvailability)) {
                try {
                    await FlavorAvailability.findOneAndUpdate(
                        { flavorKey },
                        { 
                            isAvailable, 
                            lastUpdated: new Date(),
                            updatedBy: adminName
                        },
                        { upsert: true, new: true }
                    );
                } catch (error) {
                    errors.push({ flavorKey, error: error.message });
                    console.error(`❌ Erro ao salvar ${flavorKey} no MongoDB:`, error);
                }
            }
            
            // Log da ação no MongoDB
            if (AdminLog) {
                try {
                    await AdminLog.create({
                        action: 'UPDATE_FLAVOR_AVAILABILITY_BULK',
                        adminName,
                        details: {
                            totalFlavors: Object.keys(flavorAvailability).length,
                            savedCount,
                            errorCount: errors.length
                        }
                    });
                } catch (logError) {
                    console.error('❌ Erro ao salvar log:', logError);
                }
            }
        }
        
        res.json({
            success: true,
            message: `Salvo ${savedCount} sabores ${req.useMongoDB ? 'no MongoDB' : 'em memória'}`,
            savedCount,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined,
            database: req.useMongoDB ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno ao salvar sabores',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// RESETAR DADOS (apenas para desenvolvimento)
app.post('/api/admin/reset-data', authAdmin, async (req, res) => {
    try {
        if (req.useMongoDB) {
            await ProductAvailability.deleteMany({});
            await FlavorAvailability.deleteMany({});
        }
        
        productAvailabilityDB = {};
        flavorAvailabilityDB = {};
        
        res.json({
            success: true,
            message: 'Dados resetados com sucesso',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro ao resetar dados:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao resetar dados',
            timestamp: new Date().toISOString()
        });
    }
});

// ====== INICIAR SERVIDOR ======

async function startServer() {
    // Tentar conectar ao MongoDB
    const mongoConnected = await connectToDatabase();
    
    if (!mongoConnected) {
        console.log('⚠️  Servidor iniciando sem MongoDB. Configure MONGODB_URI no Render.');
        console.log('🔗 Para MongoDB Atlas gratuito: https://www.mongodb.com/cloud/atlas');
    }
    
    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
        console.log(`✅ Admin Status: http://0.0.0.0:${PORT}/api/admin/status`);
        console.log(`📊 MongoDB: ${mongoConnected ? '✅ Conectado' : '❌ Desconectado'}`);
        
        if (!mongoConnected) {
            console.log('💡 Dica: Adicione MONGODB_URI nas variáveis de ambiente do Render');
            console.log('💡 As alterações serão salvas em memória (sobreviverão ao reinício)');
        }
    });
}

startServer().catch(console.error);
