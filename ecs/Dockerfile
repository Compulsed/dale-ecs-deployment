
FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .

ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION

#Install AWS CLI
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    groff \
    less \
    && pip3 install --upgrade --break-system-packages pip \
    && apt-get clean

RUN pip3 --no-cache-dir install --upgrade awscli --break-system-packages

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
RUN aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

RUN npx cdk deploy 