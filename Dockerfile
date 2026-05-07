# Stage 1: Base & Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
# Install only production dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Stage 2: Builder (Full environment)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
# Install ALL dependencies (including devDependencies)
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn prisma:generate && yarn build

# Stage 3: Production
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy generated Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copy built dist and prisma from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package.json ./

EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
