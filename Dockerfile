# Dockerfile for ALFA PRO + IQ Option — Railway/Docker deployment
# Runs ALL 3 services in one container: web + telegram bot + IQ Option

FROM node:20-slim

# Install OpenSSL (required by Prisma) + bash
RUN apt-get update -y && apt-get install -y openssl bash && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate || echo "prisma skipped"

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose ports
EXPOSE 3000 3001 3002

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start ALL services with the startup script
CMD ["bash", "start.sh"]
