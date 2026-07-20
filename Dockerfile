FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Same-origin in production: the backend serves both the API and these static
# files, so the frontend can call /api/news with no base URL.
ENV VITE_API_BASE_URL=""
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Prisma's engine needs OpenSSL present at generate-time; node:20-alpine (Alpine 3.23+) no longer bundles it
RUN apk add --no-cache openssl

COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install
COPY backend/ ./
RUN npm run build
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
