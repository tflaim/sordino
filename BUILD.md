# Build Instructions for Mozilla Reviewers

## System Requirements

- **Operating System**: macOS, Linux, or Windows
- **Node.js**: v20.19.0 or higher (tested with v22.x)
- **npm**: v9.0.0 or higher (comes with Node.js)

## Installing Node.js

If you don't have Node.js installed:

1. Download from https://nodejs.org/ (LTS version recommended)
2. Or use a version manager like nvm:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 22
   nvm use 22
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

   The built extension files are in `.output/firefox-mv3/`

## Build Script Details

The build process uses:
- **WXT** (v0.21.x) - Web extension framework; builds each browser into its own clean output directory and generates the manifest
- **Vite** (v8.x, via WXT) - Module bundler
- **TypeScript** (v5.x) - Compiles to JavaScript
- **React** (v19.x) - UI framework, JSX transforms to JS
- **Tailwind CSS** (v4.x) - Utility CSS framework
- **PostCSS** - CSS processing

The `npm run build:firefox` command runs `wxt build -b firefox`, which:
1. Compiles TypeScript to JavaScript
2. Transforms React JSX to JavaScript
3. Processes Tailwind CSS and bundles the self-hosted fonts
4. Bundles the background, content script, popup and settings page (the content script as a single self-contained file)
5. Generates the Firefox manifest from `wxt.config.ts`
6. Outputs to `.output/firefox-mv3/`

## Verifying the Build

After building, the `.output/firefox-mv3/` directory should contain:
- `manifest.json` - Extension manifest
- `background.js` - Background script
- `content-scripts/content.js` - Content script
- `popup.html` - Popup UI
- `options.html` - Settings page
- `chunks/` - Shared code chunks for the popup and settings page
- `assets/` - CSS, fonts and the logo
- `icons/` - Extension icons

## Questions?

Source code is also available at: https://github.com/tflaim/sordino
