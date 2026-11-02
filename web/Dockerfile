# React 前端：node 构建 → nginx 托管 + 反向代理
FROM node:22-alpine AS build
WORKDIR /src
RUN npm config set registry https://registry.npmmirror.com
COPY package.json package-lock.json ./
# 跳过 electron 二进制下载（桌面端专用，服务器无 GitHub 访问）
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
