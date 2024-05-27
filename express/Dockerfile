
FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 9000

CMD ["npm", "run", "dev"]