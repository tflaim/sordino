# Build Instructions for Mozilla Reviewers

## System Requirements

- **Operating System**: macOS, Linux, or Windows
- **Node.js**: v18.0.0 or higher (tested with v22.x)
- **npm**: v9.0.0 or higher (comes with Node.js)

## Installing Node.js

If you don't have Node.js installed:

1. Download from https://nodejs.org/ (LTS version recommended)
2. Or use a version manager like nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

## Build Steps

1. **Extract the source code**
   ```bash
   unzip sordino-source.zip -d sordino
   cd sordino
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the Firefox extension**
   ```bash
   npm run build:firefox
   ```

4. **Locate the output**

   The built extension files are in `dist/firefox/`

## Build Script Details

The build process uses:
- **Vite** (v7.x) - Module bundler and build tool
- **TypeScript** (v5.x) - Compiles to JavaScript
- **React** (v19.x) - UI framework, JSX transforms to JS
- **Tailwind CSS** (v4.x) - Utility CSS framework
- **PostCSS** - CSS processing

The `npm run build:firefox` command runs `vite build` which:
1. Compiles TypeScript to JavaScript
2. Transforms React JSX to JavaScript
3. Processes Tailwind CSS
4. Bundles all modules
5. Copies the Firefox-specific manifest
6. Outputs to `dist/firefox/`

## Verifying the Build

After building, the `dist/firefox/` directory should contain:
- `manifest.json` - Extension manifest
- `background.js` - Service worker
- `content.js` - Content script
- `popup.html` / `popup.js` - Popup UI
- `settings.html` / `settings.js` - Settings page
- `chunks/` - Shared code chunks
- `assets/` - CSS files
- `icons/` - Extension icons

## Questions?

Source code is also available at: https://github.com/tflaim/sordino
