# =========================
# 1️⃣ Stage de build dk
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Copia package.json
COPY package*.json ./

RUN npm install

# Copia do projeto
COPY . .

# URL da API, obrigatória no build (vite.config.ts). No Railway, a variável do serviço chega aqui como build arg.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Gera build de produção
RUN npm run build


# =========================
# 2️⃣ Stage de produção
# =========================
FROM nginx:alpine

# Remove config padrão
RUN rm -rf /usr/share/nginx/html/*

# Copia build gerado pelo Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia config custom
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
