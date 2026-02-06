// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS
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

// Senha administrativa
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// Inicializar arquivos de dados
async function initializeData() {
    try {
        console.log('📂 Inicializando dados...');
        
        // Criar diretório data se não existir
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('✅ Diretório data criado');
        
        // Inicializar produtos.json se não existir
        try {
            await fs.access(PRODUCTS_FILE);
            console.log('✅ products.json já existe');
        } catch {
            const initialProducts = {
                success: true,
                productAvailability: {},
                lastUpdated: new Date().toISOString(),
                message: 'Arquivo criado automaticamente'
            };
            await fs.writeFile(PRODUCTS_FILE, JSON.stringify(initialProducts, null, 2));
            console.log('✅ products.json criado');
        }
        
        // Inicializar flavors.json se não existir
        try {
            await fs.access(FLAVORS_FILE);
            console.log('✅ flavors.json já existe');
        } catch {
            const initialFlavors = {
                success: true,
                flavorAvailability: {},
                lastUpdated: new Date().toISOString(),
                message: 'Arquivo criado automaticamente'
            };
            await fs.writeFile(FLAVORS_FILE, JSON.stringify(initialFlavors, null, 2));
            console.log('✅ flavors.json criado');
        }
        
        // Inicializar orders.json se não existir
        try {
            await fs.access(ORDERS_FILE);
            console.log('✅ orders.json já existe');
        } catch {
            const initialOrders = {
                success: true,
                orders: [],
                lastUpdated: new Date().toISOString(),
                message: 'Arquivo criado automaticamente'
            };
            await fs.writeFile(ORDERS_FILE, JSON.stringify(initialOrders, null, 2));
            console.log('✅ orders.json criado');
        }
        
        console.log('🎉 Todos os arquivos de dados foram inicializados');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar dados:', error);
        return false;
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
        version: '3.0',
        dataDirectory: DATA_DIR
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
        
        console.log(`📦 Produtos atualizados por: ${adminName || 'Admin BebCom'}`);
        
        res.json({
            success: true,
            message: 'Disponibilidade de produtos atualizada com sucesso',
            timestamp: new Date().toISOString(),
            totalProducts: Object.keys(productAvailability).length
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
        
        console.log(`🍹 Sabores atualizados por: ${adminName || 'Admin BebCom'}`);
        
        res.json({
            success: true,
            message: 'Disponibilidade de sabores atualizada com sucesso',
            timestamp: new Date().toISOString(),
            totalFlavors: Object.keys(flavorAvailability).length
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
            console.log(`📝 Pedido salvo: ${orderId}`);
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
        
        console.log('🔄 Sincronização solicitada');
        
        res.json({
            success: true,
            productAvailability: products.productAvailability || {},
            flavorAvailability: flavors.flavorAvailability || {},
            lastSync: new Date().toISOString(),
            message: 'Dados sincronizados com sucesso'
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

// Rota para obter configurações do sistema
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        backendUrl: 'https://bebcom-cardapio-delivery.onrender.com',
        whatsappNumber: '5514996130369',
        deliveryRates: {
            baseFee: 5.00,
            freeDeliveryMin: 100.00,
            maxDistance: 15
        },
        storeLocation: {
            address: "R. José Henrique Ferraz, 18-10 - Centro, Bauru - SP",
            city: "Bauru",
            state: "SP"
        }
    });
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
            sync: '/api/sync-all',
            config: '/api/config'
        },
        documentation: 'API para o sistema BebCom Delivery'
    });
});

// Rota 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado',
        requestedUrl: req.url,
        method: req.method,
        availableEndpoints: ['/health', '/api/product-availability', '/api/flavor-availability', '/api/create-payment']
    });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Entre em contato com o suporte'
    });
});

// Inicializar servidor
async function startServer() {
    console.log('🚀 Iniciando servidor BebCom Delivery...');
    
    // Inicializar dados
    const dataInitialized = await initializeData();
    if (!dataInitialized) {
        console.error('❌ Falha ao inicializar dados. Encerrando...');
        process.exit(1);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
        console.log(`🎉 Servidor BebCom Delivery rodando na porta ${PORT}`);
        console.log(`📁 Dados armazenados em: ${DATA_DIR}`);
        console.log(`🔐 Senha admin: ${ADMIN_PASSWORD}`);
        console.log(`🌐 URL local: http://localhost:${PORT}`);
        console.log(`✅ Health check: http://localhost:${PORT}/health`);
        console.log(`📦 Produtos: http://localhost:${PORT}/api/product-availability`);
        console.log(`🍹 Sabores: http://localhost:${PORT}/api/flavor-availability`);
        console.log('='.repeat(50));
        console.log('✅ Sistema pronto para uso!');
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
    console.error('❌ Falha crítica ao iniciar servidor:', error);
    process.exit(1);
});
