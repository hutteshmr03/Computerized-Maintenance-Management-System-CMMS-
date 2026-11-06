import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs on port 8000 and Vite proxies to it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
