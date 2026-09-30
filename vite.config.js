import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves the site from /<repo>/; Vercel (which sets VERCEL=1 while building) serves
// it from the domain root. BASE_PATH overrides both (e.g. "/" for a custom domain).
const base = process.env.BASE_PATH || (process.env.VERCEL ? '/' : '/pespect/')

export default defineConfig(({ command, isPreview }) => ({
  // The dev server stays at "/"; the build and `vite preview` use the GitHub Pages path.
  base: command === 'build' || isPreview ? base : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    chunkSizeWarningLimit: 1600
  }
}))
