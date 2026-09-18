FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Dépendances Node
COPY package*.json ./
RUN npm install --omit=dev

# Code de l'app (les scripts login-once.js / encode-session.js sont
# à usage local uniquement et n'ont pas besoin d'être dans l'image)
COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
