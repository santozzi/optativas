import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = process.env.VITE_API_PORT || '3001';
const API_HOST = process.env.VITE_API_HOST || 'proyecto-pdf-api';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: `http://${API_HOST}:${API_PORT}`,
        changeOrigin: true,
      }
    }
  }
})