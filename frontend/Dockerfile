# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=https://p2p-medical-api.bsvblockchain.tech
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
