# Imazh i thjeshtë për ta ngritur IntexFin lokalisht me një komandë.
# Për prodhim rekomandohet ndërtim shumë-fazësh me output "standalone".
FROM node:22-alpine

# Prisma ka nevojë për OpenSSL në Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

# Në nisje: krijon tabelat, mbush të dhënat fillestare (vetëm herën e parë)
# dhe ndez serverin.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && npm run start"]
