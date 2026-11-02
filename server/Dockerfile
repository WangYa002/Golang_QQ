# Go 后端：golang 镜像构建 → alpine 运行
FROM golang:alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOPROXY=https://goproxy.cn,direct
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/golang-qq .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/golang-qq .
RUN mkdir -p /app/uploads
ENV TZ=Asia/Shanghai
EXPOSE 8080
ENTRYPOINT ["./golang-qq"]
