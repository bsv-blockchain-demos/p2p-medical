FROM node:24.22.3-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3002
CMD ["npx", "tsx", "src/index.ts"]
