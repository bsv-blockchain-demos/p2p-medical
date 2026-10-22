FROM node:24.22.1-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3002
CMD ["npx", "tsx", "src/index.ts"]
