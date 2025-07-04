import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 8000,
  },
  build: {
    outDir: '../backend/public', // Путь, куда будет билдиться фронтенд
  },
})