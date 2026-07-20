FROM node:20-alpine

WORKDIR /app

# Prisma's engine needs OpenSSL present at generate-time; node:20-alpine (Alpine 3.23+) no longer bundles it
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run dev"]
