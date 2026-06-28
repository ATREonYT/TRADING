# Pump Scanner Bot — runs the scanner + Telegram command bot 24/7.
FROM node:20-slim

WORKDIR /app

# Install deps (includes tsx, which runs the TypeScript at runtime)
COPY package.json package-lock.json ./
RUN npm ci

# App source
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

# Token + chat id are supplied at runtime via env vars (never baked into the image)
CMD ["npm", "start"]
