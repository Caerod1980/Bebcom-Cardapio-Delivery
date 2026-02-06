// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS - CORRIGIDO!
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(bodyParser.json());

// Diretório para armazenar dados
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const FLAVORS_FILE = path.join(DATA_DIR, 'flavors.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Senha administrativa (mude esta senha para produção)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// Inicializar arquivos de dados
async function initializeData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Inicializar produtos se não existir
        try {
            await fs.access(PRODUCTS_FILE);
        } catch {
            const initialProducts = {
                success: true,
                productAvailability: {},
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(PRODUCTS_FILE, JSON.stringify(initialProducts, null, 2));
        }
        
        // Inicializar sabores se não existir
        try {
            await fs.access(FLAVORS_FILE);
        } catch {
            const initialFlavors = {
                success: true,
                flavorAvailability: {},
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(FLAVORS_FILE, JSON.stringify(initialFlavors, null, 2));
        }
        
        // Inicializar pedidos se não existir
        try {
            await fs.access(ORDERS_FILE);
        } catch {
            const initialOrders = {
                success: true,
                orders: [],
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(ORDERS_FILE, JSON.stringify(initialOrders, null, 2));
        }
        
        console.log('✅ Dados inicializados com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar dados:', error);
    }
}

// Middleware para verificar senha administrativa
function checkAdminPassword(req, res, next) {
    const password = req.body.password;
    
    if (!password) {
        return res.status(401).json({
            success: false,
            error: 'Senha não fornecida'
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

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'BebCom Delivery API',
        version: '3.0'
    });
});

// Obter disponibilidade de produtos
app.get('/api/product-availability', async (req, res) => {
    try {
        const data = await fs.readFile(PRODUCTS_FILE, 'utf8');
        const products = JSON.parse(data);
        
        res.json({
            success: true,
            productAvailability: products.productAvailability || {},
            lastUpdated: products.lastUpdated || new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao ler produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar disponibilidade de produtos'
        });
    }
});

// Obter disponibilidade de sabores
app.get('/api/flavor-availability', async (req, res) => {
    try {
        const data = await fs.readFile(FLAVORS_FILE, 'utf8');
        const flavors = JSON.parse(data);
        
        res.json({
            success: true,
            flavorAvailability: flavors.flavorAvailability || {},
            lastUpdated: flavors.lastUpdated || new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao ler sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar disponibilidade de sabores'
        });
    }
});

// Atualizar disponibilidade de produtos (admin)
app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        const { productAvailability, adminName } = req.body;
        
        if (!productAvailability || typeof productAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados de produtos inválidos'
            });
        }
        
        const data = {
            success: true,
            productAvailability,
            lastUpdated: new Date().toISOString(),
            updatedBy: adminName || 'Admin BebCom'
        };
        
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Disponibilidade de produtos atualizada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar disponibilidade de produtos'
        });
    }
});

// Atualizar disponibilidade de sabores (admin)
app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
    try {
        const { flavorAvailability, adminName } = req.body;
        
        if (!flavorAvailability || typeof flavorAvailability !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Dados de sabores inválidos'
            });
        }
        
        const data = {
            success: true,
            flavorAvailability,
            lastUpdated: new Date().toISOString(),
            updatedBy: adminName || 'Admin BebCom'
        };
        
        await fs.writeFile(FLAVORS_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Disponibilidade de sabores atualizada com sucesso',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao salvar sabores:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar disponibilidade de sabores'
        });
    }
});

// Criar pagamento (simulação)
app.post('/api/create-payment', async (req, res) => {
    try {
        const { orderId, customer, items, deliveryType, paymentMethod, totalAmount, deliveryFee } = req.body;
        
        // Validar dados básicos
        if (!orderId || !customer || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Dados do pedido inválidos'
            });
        }
        
        // Simular criação de pedido
        const order = {
            id: orderId,
            customer,
            items,
            deliveryType,
            paymentMethod,
            totalAmount,
            deliveryFee,
            status: 'pending',
            createdAt: new Date().toISOString(),
            paid: false
        };
        
        // Salvar pedido
        try {
            const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
            const orders = JSON.parse(ordersData);
            orders.orders.push(order);
            await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar pedido:', error);
        }
        
        // Simular resposta de pagamento
        if (paymentMethod === 'pix') {
            // Gerar QR Code PIX simulado
            const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PIX:${orderId}:${totalAmount}`)}`;
            
            res.json({
                success: true,
                orderId,
                qrCode,
                copyPasteKey: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053039865406' + 
                              Math.floor(totalAmount * 100).toString().padStart(10, '0') + 
                              '5802BR5925BEBCOM DELIVERY LTDA6008BAURU-SP62070503***6304' + 
                              Math.random().toString(36).substring(2, 6).toUpperCase(),
                message: 'QR Code PIX gerado com sucesso'
            });
        } else if (paymentMethod === 'card_online') {
            // Simular URL de pagamento com cartão
            res.json({
                success: true,
                orderId,
                paymentUrl: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=simulated_${orderId}`,
                message: 'Redirecionando para pagamento com cartão'
            });
        } else {
            res.json({
                success: true,
                orderId,
                message: 'Pedido criado com sucesso'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao criar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar pagamento'
        });
    }
});

// Verificar status do pedido
app.get('/api/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Simular verificação de status
        // Em produção, aqui você integraria com a API do seu gateway de pagamento
        
        const status = Math.random() > 0.3 ? 'paid' : 'pending'; // 70% de chance de estar pago (para teste)
        
        res.json({
            success: true,
            orderId,
            paid: status === 'paid',
            status: status
        });
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status do pedido'
        });
    }
});

// Sincronizar todos os dados
app.get('/api/sync-all', async (req, res) => {
    try {
        const [productsData, flavorsData] = await Promise.all([
            fs.readFile(PRODUCTS_FILE, 'utf8'),
            fs.readFile(FLAVORS_FILE, 'utf8')
        ]);
        
        const products = JSON.parse(productsData);
        const flavors = JSON.parse(flavorsData);
        
        res.json({
            success: true,
            productAvailability: products.productAvailability || {},
            flavorAvailability: flavors.flavorAvailability || {},
            lastSync: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao sincronizar dados'
        });
    }
});

// Listar pedidos (admin)
app.get('/api/admin/orders', checkAdminPassword, async (req, res) => {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(data);
        
        res.json({
            success: true,
            orders: orders.orders || [],
            count: (orders.orders || []).length,
            lastUpdated: orders.lastUpdated
        });
    } catch (error) {
        console.error('❌ Erro ao listar pedidos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar pedidos'
        });
    }
});

// Exportar pedidos (admin)
app.get('/api/admin/orders/export', checkAdminPassword, async (req, res) => {
    try {
        const data = await fs.readFile(ORDERS_FILE, 'utf8');
        const orders = JSON.parse(data);
        
        res.setHeader('Content-Disposition', 'attachment; filename=pedidos_bebcom.json');
        res.setHeader('Content-Type', 'application/json');
        
        res.json({
            success: true,
            orders: orders.orders || [],
            exportDate: new Date().toISOString(),
            totalOrders: (orders.orders || []).length
        });
    } catch (error) {
        console.error('❌ Erro ao exportar pedidos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao exportar pedidos'
        });
    }
});

// Rota padrão
app.get('/', (req, res) => {
    res.json({
        service: 'BebCom Delivery API',
        version: '3.0',
        status: 'operational',
        endpoints: {
            health: '/health',
            productAvailability: '/api/product-availability',
            flavorAvailability: '/api/flavor-availability',
            createPayment: '/api/create-payment',
            orderStatus: '/api/order-status/:orderId',
            sync: '/api/sync-all'
        },
        documentation: 'Consulte a documentação para mais informações'
    });
});

// Rota 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado'
    });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
    });
});

// Inicializar servidor
async function startServer() {
    await initializeData();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor BebCom Delivery rodando na porta ${PORT}`);
        console.log(`📁 Dados armazenados em: ${DATA_DIR}`);
        console.log(`🔐 Senha admin: ${ADMIN_PASSWORD}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`✅ Health check: http://localhost:${PORT}/health`);
    });
}

// Tratar encerramento gracioso
process.on('SIGTERM', () => {
    console.log('👋 Encerrando servidor graciosamente...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 Servidor interrompido pelo usuário');
    process.exit(0);
});

// Iniciar servidor
startServer().catch(error => {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
});
