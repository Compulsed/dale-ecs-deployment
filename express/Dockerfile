FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# TODO: Lock down node version
RUN dnf install -y nodejs

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 80

CMD ["npm", "run", "dev"]