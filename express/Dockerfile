
FROM --platform= node:20

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 80

CMD ["npm", "run", "dev"]