FROM node:20-alpine

WORKDIR /app

# npm 캐시를 최대한 활용하기 위해 먼저 복사
COPY package*.json ./

# 필요한 경우 devDependencies까지 설치
RUN npm install

# .dockerignore 로 node_modules 제외되는 것 확인
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
