FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Dépendances Node
COPY package*.json ./
RUN npm ci --omit=dev

# Code de l'app
COPY server.js ./
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
