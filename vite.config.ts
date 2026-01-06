import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'fs'

// Plugin to restructure extension files after build
function restructureExtension() {
  return {
    name: 'restructure-extension',
    closeBundle() {
      const outDir = 'dist/chrome'

      // Copy manifest
      copyFileSync('public/manifest.json', `${outDir}/manifest.json`)

      // Move HTML files to root and rename
      const srcDir = `${outDir}/src`
      if (existsSync(srcDir)) {
        if (existsSync(`${srcDir}/popup/index.html`)) {
          renameSync(`${srcDir}/popup/index.html`, `${outDir}/popup.html`)
        }
        if (existsSync(`${srcDir}/settings/index.html`)) {
          renameSync(`${srcDir}/settings/index.html`, `${outDir}/settings.html`)
        }
        // Remove empty src directory
        rmSync(srcDir, { recursive: true, force: true })
      }

      // Copy icons if they exist
      const iconsDir = `${outDir}/icons`
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }

      const iconSizes = ['16', '32', '48', '128']
      for (const size of iconSizes) {
        const src = `public/icons/icon-${size}.png`
        if (existsSync(src)) {
          copyFileSync(src, `${iconsDir}/icon-${size}.png`)
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), restructureExtension()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist/chrome',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        settings: resolve(__dirname, 'src/settings/index.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'content') return 'content.js'
          return '[name].js'
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
