# 🍹 BebCom Delivery - Sistema Seguro

## 🚀 Instalação Rápida

### 1. Frontend
1. Copie o arquivo `BebComDelivery.html` para seu servidor web
2. Acesse pelo navegador

### 2. Backend (Render.com)
1. Faça upload dos arquivos do backend para um repositório GitHub
2. No Render.com, crie um novo Web Service
3. Conecte ao seu repositório
4. Configure as variáveis de ambiente:
   - `MONGODB_URI` - Sua string de conexão do MongoDB Atlas
   - `ADMIN_SECRET_KEY` - Senha forte para acesso admin
   - `PORT` - 3000
   - `NODE_ENV` - production

5. No frontend, atualize `backendUrl` no CONFIG para a URL do seu backend no Render

## 🔧 Configuração do MongoDB Atlas
1. Acesse https://mongodb.com/atlas
2. Crie conta gratuita
3. Crie cluster M0 (gratuito)
4. Crie usuário de banco de dados
5. Adicione seu IP (0.0.0.0/0 para todos)
6. Copie a string de conexão
7. Cole no Render como `MONGODB_URI`

## 🔐 Segurança
- ✅ Nenhuma chave sensível no frontend
- ✅ Autenticação admin no backend
- ✅ HTTPS automático no Render
- ✅ Dados sincronizados em tempo real
- ✅ Sistema de fallback para offline

## 📞 Suporte
Para dúvidas: (14) 99613-0369
