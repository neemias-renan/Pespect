import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves the site from /<repo>/. BASE_PATH overrides it (e.g. "/" for a custom domain).
const base = process.env.BASE_PATH || '/Pespect/'

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
