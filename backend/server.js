// backend/server.js - VERSÃO ULTRA-OTIMIZADA PARA RENDER COM SINCRONIZAÇÃO
const express = require('express');
const cors = require('cors');
const http = require('http'); // Usar módulo nativo do Node.js

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware SIMPLES
app.use(cors());
app.use(express.json());

// Configurações
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Bebcom25*';

// ========== LOG DE PORTA (CRÍTICO PARA DEBUG) ==========
console.log('='.repeat(60));
console.log('🔍 VERIFICAÇÃO DE CONFIGURAÇÃO DE PORTA');
console.log('='.repeat(60));
console.log(`process.env.PORT: ${process.env.PORT || 'NÃO DEFINIDO'}`);
console.log(`Porta usada: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log('='.repeat(60));

if (!process.env.PORT) {
    console.log('⚠️  ATENÇÃO: PORT não definida no ambiente. Usando fallback 10000.');
    console.log('✅ Isso é NORMAL no desenvolvimento local.');
} else {
    console.log(`✅ PORT definida pelo ambiente: ${process.env.PORT}`);
}

if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
    console.log('✅ Detectado ambiente Render');
    console.log(`🌐 URL externa provável: ${process.env.RENDER_EXTERNAL_URL || 'Não disponível'}`);
} else {
    console.log('⚠️  Ambiente local detectado');
}

// ========== SISTEMA DE AUTO-PING PARA RENDER FREE ==========
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutos
let pingIntervalId = null;

// Função para fazer auto-ping usando http nativo
function performAutoPing() {
    return new Promise((resolve) => {
        try {
            const url = process.env.RENDER_EXTERNAL_URL 
                ? `${process.env.RENDER_EXTERNAL_URL}/health`
                : `http://localhost:${PORT}/health`;
            
            console.log(`🔄 Auto-ping iniciado para: ${url}`);
            
            const req = http.get(url, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Auto-ping bem-sucedido: ${res.statusCode}`);
                    } else {
                        console.log(`⚠️ Auto-ping com status ${res.statusCode}`);
                    }
                    resolve(true);
                });
            });
            
            req.on('error', (error) => {
                // Não mostrar erro completo para não poluir logs
                console.log('⚠️ Auto-ping falhou (normal se serviço estiver iniciando)');
                resolve(false);
            });
            
            req.setTimeout(10000, () => {
                console.log('⚠️ Auto-ping timeout (10 segundos)');
                req.destroy();
                resolve(false);
            });
            
        } catch (error) {
            console.log('⚠️ Auto-ping erro:', error.message);
            resolve(false);
        }
    });
}

function startAutoPing() {
    if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
        console.log('🚀 Iniciando sistema de auto-ping para Render Free');
        
        // Primeiro ping após 30 segundos
        setTimeout(() => {
            performAutoPing();
        }, 30000);
        
        // Configurar ping periódico
        pingIntervalId = setInterval(performAutoPing, PING_INTERVAL);
        
        console.log(`⏰ Auto-ping configurado a cada ${PING_INTERVAL/60000} minutos`);
    } else {
        console.log('💻 Ambiente local - auto-ping desativado');
    }
}

function stopAutoPing() {
    if (pingIntervalId) {
        clearInterval(pingIntervalId);
        console.log('🛑 Auto-ping parado');
    }
}

// ... o RESTANTE DO CÓDIGO PERMANECE IGUAL ...
// (tudo desde a linha 100 até o final do arquivo anterior)
