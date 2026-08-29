import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@typings': path.resolve(__dirname, 'src/types'),
      '@i18n': path.resolve(__dirname, 'src/i18n'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WEB_PORT ?? 15173),
    strictPort: true,
  },
})
