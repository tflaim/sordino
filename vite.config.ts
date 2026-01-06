import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  rmSync,
  cpSync,
} from 'fs'

// Helper to set up an extension directory
function setupExtensionDir(
  outDir: string,
  manifestFile: string,
  srcDir: string
) {
  // Copy manifest
  copyFileSync(manifestFile, `${outDir}/manifest.json`)

  // Move HTML files to root and rename
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
}

// Plugin to restructure extension files after build
function restructureExtension() {
  return {
    name: 'restructure-extension',
    closeBundle() {
      const chromeDir = 'dist/chrome'
      const firefoxDir = 'dist/firefox'

      // Set up Chrome extension
      setupExtensionDir(chromeDir, 'public/manifest.json', `${chromeDir}/src`)

      // Create Firefox directory and copy Chrome build
      if (!existsSync(firefoxDir)) {
        mkdirSync(firefoxDir, { recursive: true })
      }

      // Copy all files from Chrome to Firefox
      const filesToCopy = [
        'background.js',
        'content.js',
        'popup.html',
        'popup.js',
        'settings.html',
        'settings.js',
      ]

      for (const file of filesToCopy) {
        if (existsSync(`${chromeDir}/${file}`)) {
          copyFileSync(`${chromeDir}/${file}`, `${firefoxDir}/${file}`)
        }
      }

      // Copy directories
      if (existsSync(`${chromeDir}/chunks`)) {
        cpSync(`${chromeDir}/chunks`, `${firefoxDir}/chunks`, {
          recursive: true,
        })
      }
      if (existsSync(`${chromeDir}/assets`)) {
        cpSync(`${chromeDir}/assets`, `${firefoxDir}/assets`, {
          recursive: true,
        })
      }
      if (existsSync(`${chromeDir}/icons`)) {
        cpSync(`${chromeDir}/icons`, `${firefoxDir}/icons`, { recursive: true })
      }

      // Use Firefox manifest
      copyFileSync('public/manifest.firefox.json', `${firefoxDir}/manifest.json`)

      // Clean up: remove Firefox manifest from Chrome dir (Vite copies all public files)
      const firefoxManifestInChrome = `${chromeDir}/manifest.firefox.json`
      if (existsSync(firefoxManifestInChrome)) {
        rmSync(firefoxManifestInChrome)
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
