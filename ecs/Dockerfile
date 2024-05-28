
FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
RUN aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

RUN npx cdk deploy 