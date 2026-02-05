# 🍹 BebCom Delivery - Sistema Completo

Sistema de delivery de bebidas com frontend seguro e backend em tempo real.

## 🚀 Como Implantar

### Frontend (GitHub Pages)
1. Acesse: https://github.com/seu-usuario/bebcom-delivery/settings/pages
2. Source: "Deploy from a branch"
3. Branch: `main` / `frontend/`
4. Salve
5. Seu site estará em: https://seu-usuario.github.io/bebcom-delivery/

### Backend (Render.com)
1. Acesse: https://render.com
2. "New" > "Web Service"
3. Conecte este repositório
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Adicione variáveis de ambiente (veja `.env.example`)
6. Clique em "Create"

## 📁 Estrutura
- `frontend/` - Interface web segura
- `backend/` - API Node.js + MongoDB

## 🔧 Configuração

### 1. MongoDB Atlas
1. Crie conta em https://mongodb.com/atlas
2. Crie cluster gratuito M0
3. Copie string de conexão
4. Cole no Render como `MONGODB_URI`

### 2. Frontend
Após deploy do backend, atualize:
```javascript
// No arquivo frontend/BebComDelivery.html
backendUrl: 'https://seu-backend.onrender.com',
