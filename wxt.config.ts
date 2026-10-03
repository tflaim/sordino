import { defineConfig } from 'wxt'

const icons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
}

// One source for Chrome and Firefox (ADR-0001). Name, version and entrypoint
// keys (background, content_scripts, action popup, options_ui) are generated.
export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: ({ browser }) => ({
    name: browser === 'firefox' ? 'Sordino' : 'Sordino - Soft Website Blocker for Focus',
    description: 'Soft-block distracting websites with psychological friction, not force.',
    icons,
    action: {
      default_icon: { 16: icons[16], 32: icons[32], 48: icons[48] },
    },
    permissions: ['storage', 'alarms'],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none'",
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'sordino@tflaim.com',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'], optional: [] },
        },
        // data_collection_permissions needs Firefox for Android 142+ (web-ext lint).
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
  hooks: {
    // Toolbar tooltip stays the extension name, as in 1.x (WXT would use the popup <title>).
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.action) manifest.action.default_title = manifest.name
    },
  },
})
