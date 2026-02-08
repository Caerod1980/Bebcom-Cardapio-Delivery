// backend/server.js - COMPATÍVEL COM NODE ANTIGO (GITHUB) + RENDER
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

// ===== Config =====
const MONGODB_URI = process.env.MONGODB_URI; // no Render, configure essa env
const DB_NAME = process.env.DB_NAME || 'bebcom_delivery';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ===== State =====
let db = null;
let client = null;
let isConnected = false;
let connectionRetryCount = 0;
const MAX_RETRIES = 5;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-admin-password',
    'X-Admin-Password',
    'x-admin-key',
    'X-Admin-Key'
  ]
}));
app.use(express.json());

// ===== Root / Health =====
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

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BebCom Delivery API',
    db: isConnected ? 'connected' : 'disconnected'
  });
});

// ⚠️ (Opcional) - NÃO recomendo expor isso em produção, mas deixei compatível com o seu fluxo
app.get('/api/admin-password', (req, res) => {
  const passwordHash = crypto
    .createHash('sha256')
    .update(String(ADMIN_PASSWORD || ''))
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
console.log('📅', new Date().toISOString());
console.log('🌐 Porta:', PORT);
console.log('🔐 Senha Admin:', ADMIN_PASSWORD ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA');
console.log('🗄️ MongoDB URI:', MONGODB_URI ? '✅ CONFIGURADA' : '❌ NÃO CONFIGURADA');
console.log('─'.repeat(60));

// ===== Mongo =====
async function connectDB() {
  try {
    if (!MONGODB_URI) {
      console.error('❌ CRÍTICO: MONGODB_URI não configurada!');
      console.log('⚠️ Servidor rodará em modo offline (sem salvar)');
      isConnected = false;
      return false;
    }

    console.log('🔌 Conectando ao MongoDB Atlas...');

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

    return await connectWithRetry();
  } catch (error) {
    console.error('❌ Erro na configuração MongoDB:', error.message);
    isConnected = false;
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
    console.log('📊 Banco:', DB_NAME);

    // keep-alive
    setInterval(async () => {
      try {
        if (client && isConnected) {
          await client.db('admin').command({ ping: 1 });
        }
      } catch (err) {
        console.log('⚠️ Mongo keep-alive falhou:', err.message);
        isConnected = false;
        await reconnectDB();
      }
    }, 30000);

    // init collections
    setTimeout(initializeCollections, 1500);

    return true;
  } catch (error) {
    connectionRetryCount += 1;
    console.error('❌ MongoDB offline (tentativa ' + connectionRetryCount + '/' + MAX_RETRIES + '):', error.message);

    if (connectionRetryCount < MAX_RETRIES) {
      const wait = connectionRetryCount * 2000;
      console.log('🔄 Tentando reconectar em', wait / 1000, 'segundos...');
      setTimeout(connectWithRetry, wait);
    } else {
      console.log('⚠️ MongoDB permanece offline, servidor em modo local');
      isConnected = false;
    }
    return false;
  }
}

async function reconnectDB() {
  if (!client) return;
  if (connectionRetryCount >= MAX_RETRIES) return;

  try {
    console.log('🔄 Tentando reconectar ao MongoDB...');
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    db = client.db(DB_NAME);
    isConnected = true;
    connectionRetryCount = 0;
    console.log('✅ MongoDB reconectado!');
  } catch (error) {
    console.error('❌ Falha na reconexão:', error.message);
    isConnected = false;
  }
}

async function initializeCollections() {
  try {
    if (!isConnected || !db) {
      console.log('⚠️ MongoDB offline, pulando inicialização de collections');
      return;
    }

    console.log('📋 Inicializando collections...');

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    const required = ['products', 'flavors', 'orders', 'admin_logs'];

    for (let i = 0; i < required.length; i++) {
      const name = required[i];
      if (collectionNames.indexOf(name) === -1) {
        await db.createCollection(name);
        console.log('   ✅ Collection "' + name + '" criada');

        if (name === 'products') {
          await db.collection(name).insertOne({
            type: 'availability',
            data: {},
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            version: '3.1'
          });
          console.log('   📦 Produtos padrão inicializados');
        }

        if (name === 'flavors') {
          await db.collection(name).insertOne({
            type: 'availability',
            data: {},
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            version: '3.1'
          });
          console.log('   🍹 Sabores padrão inicializados');
        }
      }
    }

    console.log('✅ Collections OK!');
  } catch (error) {
    console.error('❌ Erro nas collections:', error.message);
  }
}

// ===== Admin middleware =====
function checkAdminPassword(req, res, next) {
  // aceita pelos 2 nomes (pra não quebrar front antigo)
  const password =
    (req.body && req.body.password) ||
    req.headers['x-admin-password'] ||
    req.headers['x-admin-key'];

  if (!password) {
    return res.status(401).json({ success: false, error: 'Senha administrativa não fornecida' });
  }
  if (String(password) !== String(ADMIN_PASSWORD)) {
    return res.status(401).json({ success: false, error: 'Senha administrativa incorreta' });
  }
  return next();
}

// ===== Availability GET =====
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
    const data = (productData && productData.data) ? productData.data : {};
    const lastUpdated = (productData && productData.lastUpdated) ? productData.lastUpdated : new Date().toISOString();

    return res.json({
      success: true,
      productAvailability: data,
      lastUpdated: lastUpdated,
      offline: false,
      message: 'Dados carregados do MongoDB'
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error.message);
    return res.status(500).json({ success: false, error: 'Erro ao buscar produtos', productAvailability: {}, offline: true });
  }
});

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
    const data = (flavorData && flavorData.data) ? flavorData.data : {};
    const lastUpdated = (flavorData && flavorData.lastUpdated) ? flavorData.lastUpdated : new Date().toISOString();

    return res.json({
      success: true,
      flavorAvailability: data,
      lastUpdated: lastUpdated,
      offline: false,
      message: 'Dados carregados do MongoDB'
    });
  } catch (error) {
    console.error('Erro ao buscar sabores:', error.message);
    return res.status(500).json({ success: false, error: 'Erro ao buscar sabores', flavorAvailability: {}, offline: true });
  }
});

// ===== Availability BULK (admin) =====
app.post('/api/admin/product-availability/bulk', checkAdminPassword, async (req, res) => {
  try {
    console.log('📦 Recebendo atualização de produtos...');

    const productAvailability = req.body ? req.body.productAvailability : null;

    if (!productAvailability || typeof productAvailability !== 'object') {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }

    if (!isConnected || !db) {
      return res.status(503).json({ success: false, error: 'MongoDB offline. Não é possível salvar.', offline: true });
    }

    await db.collection('admin_logs').insertOne({
      action: 'update_product_availability',
      itemsCount: Object.keys(productAvailability).length,
      timestamp: new Date().toISOString(),
      source: req.headers['x-forwarded-for'] || req.ip
    });

    const result = await db.collection('products').updateOne(
      { type: 'availability' },
      { $set: { data: productAvailability, lastUpdated: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    console.log('✅ Produtos salvos! Itens:', Object.keys(productAvailability).length);

    return res.json({
      success: true,
      message: 'Produtos atualizados com sucesso no MongoDB',
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
    return res.status(500).json({ success: false, error: 'Erro ao salvar produtos: ' + error.message });
  }
});

app.post('/api/admin/flavor-availability/bulk', checkAdminPassword, async (req, res) => {
  try {
    console.log('🍹 Recebendo atualização de sabores...');

    const flavorAvailability = req.body ? req.body.flavorAvailability : null;

    if (!flavorAvailability || typeof flavorAvailability !== 'object') {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }

    if (!isConnected || !db) {
      return res.status(503).json({ success: false, error: 'MongoDB offline. Não é possível salvar.', offline: true });
    }

    await db.collection('admin_logs').insertOne({
      action: 'update_flavor_availability',
      itemsCount: Object.keys(flavorAvailability).length,
      timestamp: new Date().toISOString(),
      source: req.headers['x-forwarded-for'] || req.ip
    });

    const result = await db.collection('flavors').updateOne(
      { type: 'availability' },
      { $set: { data: flavorAvailability, lastUpdated: new Date().toISOString(), updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    console.log('✅ Sabores salvos! Itens:', Object.keys(flavorAvailability).length);

    return res.json({
      success: true,
      message: 'Sabores atualizados com sucesso no MongoDB',
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
    return res.status(500).json({ success: false, error: 'Erro ao salvar sabores: ' + error.message });
  }
});

// ===== Sync-all =====
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

    const productsDoc = await db.collection('products').findOne({ type: 'availability' });
    const flavorsDoc = await db.collection('flavors').findOne({ type: 'availability' });

    return res.json({
      success: true,
      productAvailability: (productsDoc && productsDoc.data) ? productsDoc.data : {},
      flavorAvailability: (flavorsDoc && flavorsDoc.data) ? flavorsDoc.data : {},
      lastSync: new Date().toISOString(),
      offline: false,
      dbStatus: 'connected'
    });
  } catch (error) {
    console.error('Erro na sincronização:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro na sincronização',
      productAvailability: {},
      flavorAvailability: {},
      offline: true
    });
  }
});

// ===== Orders (simples) =====
app.post('/api/create-payment', async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId;
    const customer = body.customer || {};
    const items = body.items || [];
    const deliveryType = body.deliveryType || 'pickup';
    const paymentMethod = body.paymentMethod || 'pix';
    const deliveryFee = body.deliveryFee || 0;

    const totalAmount = body.totalAmount || items.reduce((sum, it) => {
      const q = it.quantity || 0;
      const p = it.price || 0;
      return sum + (q * p);
    }, 0) + deliveryFee;

    if (isConnected && db) {
      await db.collection('orders').insertOne({
        orderId,
        customer,
        items,
        deliveryType,
        paymentMethod,
        totalAmount,
        deliveryFee,
        status: 'pending',
        paid: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('📝 Pedido', orderId, 'salvo no MongoDB');
    }

    const total = totalAmount;

    return res.json({
      success: true,
      orderId,
      qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent('PIX:' + orderId + ':' + total),
      copyPasteKey: 'PIX-DEMO-' + orderId + '-' + Math.round(total * 100),
      message: 'QR Code PIX gerado (demo)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error.message);
    return res.status(500).json({ success: false, error: 'Erro ao processar pedido', message: error.message });
  }
});

app.get('/api/order-status/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!isConnected || !db) {
      return res.json({ success: true, orderId, paid: false, status: 'pending', offline: true });
    }

    const order = await db.collection('orders').findOne({ orderId: orderId });

    return res.json({
      success: true,
      orderId: orderId,
      paid: order && order.paid ? true : false,
      status: order && order.status ? order.status : 'pending',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao verificar status' });
  }
});

// ===== Start =====
async function startServer() {
  // conecta mongo sem travar o HTTP
  connectDB().catch(err => console.error('❌ Mongo connect falhou:', err.message));

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('─'.repeat(60));
    console.log('✅ SERVIDOR HTTP INICIADO!');
    console.log('🌐 Porta:', PORT);
    console.log('🗄️ MongoDB:', isConnected ? '✅ CONECTADO' : '⚠️ OFFLINE');
    console.log('='.repeat(60));
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  const gracefulShutdown = (signal) => {
    console.log('👋 Recebido', signal, 'encerrando...');
    server.close(() => {
      console.log('✅ HTTP fechado');
      if (client) client.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
