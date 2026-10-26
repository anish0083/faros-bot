FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV NODE_OPTIONS=--dns-result-order=ipv4first
CMD ["node", "--dns-result-order=ipv4first", "index.js"]
