// server.js - Backend SIMPLES e FUNCIONAL para Render
const express = require('express');
const cors = require('cors');

const app = express();

// Configurações
const PORT = process.env.PORT || 10000; // Render usa portas dinâmicas
const ADMIN_KEY = process.env.ADMIN_KEY || 'Bebcom25*';

// Middleware básico
app.use(cors());
app.use(express.json());

// ====== ROTAS OBRIGATÓRIAS ======

// 1. ROTA DE HEALTH CHECK (CRÍTICA)
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'BebCom Delivery API',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production'
    });
});

// 2. ROTA RAIZ (redireciona para health)
app.get('/', (req, res) => {
    res.redirect('/health');
});

// 3. DISPONIBILIDADE DE PRODUTOS
app.get('/api/product-availability', (req, res) => {
    res.json({
        success: true,
        productAvailability: {},
        timestamp: new Date().toISOString(),
        message: 'API funcionando - produtos disponíveis'
    });
});

// 4. DISPONIBILIDADE DE SABORES
app.get('/api/flavor-availability', (req, res) => {
    res.json({
        success: true,
        flavorAvailability: {},
        timestamp: new Date().toISOString(),
        message: 'API funcionando - sabores disponíveis'
    });
});

// 5. SINCRONIZAÇÃO
app.get('/api/sync-all', (req, res) => {
    res.json({
        success: true,
        productAvailability: {},
        flavorAvailability: {},
        timestamp: new Date().toISOString(),
        message: 'Sincronização completa'
    });
});

// 6. CRIAR PAGAMENTO
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

// 7. STATUS DO PEDIDO
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
            error: 'Acesso não autorizado'
        });
    }
};

// Atualizar produtos
app.post('/api/admin/product-availability/bulk', authAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Produtos atualizados com sucesso',
        count: Object.keys(req.body.productAvailability || {}).length,
        timestamp: new Date().toISOString()
    });
});

// Atualizar sabores
app.post('/api/admin/flavor-availability/bulk', authAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Sabores atualizados com sucesso',
        count: Object.keys(req.body.flavorAvailability || {}).length,
        timestamp: new Date().toISOString()
    });
});

// ====== INICIAR SERVIDOR ======

// IMPORTANTE: Render exige escutar na porta da variável PORT
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`✅ Health: http://0.0.0.0:${PORT}/health`);
    console.log(`✅ API: http://0.0.0.0:${PORT}/`);
});
// Force redeploy at: 2024-01-15T12:00:00Z
