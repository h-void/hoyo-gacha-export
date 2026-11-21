import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolve(dir) {
  return join(__dirname, '..', dir)
}

const root = resolve('src/renderer')

export default defineConfig({
  mode: process.env.NODE_ENV,
  root,
  resolve: {
    alias: {
      '@renderer': root,
      '@games': resolve('src/games')
    }
  },
  base: './',
  build: {
    outDir: process.env.BUILD_TARGET === 'web'
      ? resolve('dist/web')
      : resolve('dist/electron/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: Number(process.env.PORT) || 9080
  },
  plugins: [
    vue(),
    tailwindcss()
  ],
  publicDir: resolve('static')
})
