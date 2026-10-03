// PROTOTYPE — throwaway. Serves the Sordino 2.0 UI prototype (src/prototype-overhaul).
// Kept separate so the extension's vite.config.ts is untouched.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/prototype-overhaul'),
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  build: {
    outDir: resolve(__dirname, 'dist-proto'),
    emptyOutDir: true,
  },
})
