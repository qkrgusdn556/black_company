FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production

# 포트 하드코딩 X
# EXPOSE 도 제거 (Render가 자동 처리)

CMD ["npm", "start"]
