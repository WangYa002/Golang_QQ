import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 相对资源路径：Electron 以 file:// 加载 dist 时 /assets 绝对路径会 404 黑屏
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // 监听 0.0.0.0，允许手机/局域网设备通过本机 IP 访问
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
      '/uploads': 'http://localhost:8080',
    },
  },
})
