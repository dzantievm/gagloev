FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run generate

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/.output/public ./public

EXPOSE 3000

CMD ["npx", "serve", "public", "-l", "3000"]
