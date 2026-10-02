# Sordino: build, release and store-compliance review

Reviewed: `main` @ 349f5d8 (2026-05-24), compared against 33f3638 (2026-02-22, before the design sweep), 27a43a5 (2026-01-10) and the published GitHub release `v1.0.0`.
Method: each commit was built in its own scratch `git worktree` (the main checkout was not touched). I also downloaded and unpacked the v1.0.0 release zips, ran `web-ext lint` 10.7.0 and `npm audit`/`npm outdated`, and ran a **Playwright smoke test** that loads the unpacked Chrome build in Chromium 1194, turns blocking on, opens a blocked domain and checks for `#sordino-overlay`.
Script: `scratchpad/build-review/smoke.mjs`.

---

## TL;DR: what users have vs. what HEAD would ship

| Build | content.js | Smoke test (overlay on blocked site) |
|---|---|---|
| GitHub release `v1.0.0` (tag at f8aa93c, published 2026-01-07), `sordino-chrome-v1.0.0.zip` | self-contained, parses as a classic script | **overlay shown, 0 errors** |
| 27a43a5 (Jan 10) | self-contained | overlay shown (built output parses) |
| 33f3638 (Feb 22) | self-contained | **overlay shown, 0 errors** |
| **HEAD 349f5d8** (same bytes as `/home/user/sordino/dist/chrome`, chunk hashes match) | `import{C as K}from"./chunks/types-CrXLUOBJ.js"` | **no overlay. `SyntaxError: Cannot use import statement outside a module`** |

- **Store status.** AMO lists "Sordino - Soft Website Blocker for Focus" at https://addons.mozilla.org/en-US/firefox/addon/sordino/. The search snippet says it was last updated on 2026-01-07, with a size of 1.08 MB. That matches the bloated v1.0.0 Firefox zip (1,115,279 bytes plus signing overhead). The egress proxy blocked direct AMO, API and Chrome Web Store fetches, so I could not confirm user count, rating, reviews or the exact version. They are probably low or zero.
- **Chrome Web Store.** No Sordino listing turned up in two web searches. The README still links to the generic `https://chrome.google.com/webstore` and says "(In Review)" (README.md:15, :45). Two commits from Jan 10 suggest a rejection and resubmission: dd7d9cb "Remove unnecessary tabs permission for Chrome Web Store approval" and 929d069 "rename for discoverability". **Treat it as not live** (I could not verify this).
- **Conclusion.** The broken build has **not shipped**. Users have the January v1.0.0, which works but carries 26 stale files in the Firefox package. The regression came in with **372cc65** (2026-05-24, the "design sweep"). That commit added `import { CONFIRM_RESET_MS } from '../shared/types'` to `src/content/content.ts:3`, and `types.ts` is also imported by background, popup and settings, so Rollup moved it into a shared chunk. **It is a landmine for the next release.** Nothing in the pipeline (no typecheck gate, tests, smoke test or CI) would catch it. Any release cut from `main` today would ship a blocker that never blocks.

---

## Findings

### 1. Content script is emitted as an ES module and dies on load. Severity: **Critical (release blocker)**
- **Evidence:**
  - `dist/chrome/content.js` byte 0 is `import{C as K}from"./chunks/types-CrXLUOBJ.js"`.
  - `new vm.Script(content.js)` gives `SyntaxError: Cannot use import statement outside a module` for both dist/chrome and dist/firefox. The same check passes for the 33f3638, 27a43a5 and v1.0.0 builds.
  - The Playwright smoke test at HEAD reports `overlay:false, errors:["SyntaxError: Cannot use import statement outside a module"]`. At 33f3638 and v1.0.0 it reports `overlay:true, errors:[]`.
  - Cause: `vite.config.ts:119-133` puts all four entries in one Rollup build with shared `chunkFileNames`. Manifest-declared content scripts are classic scripts, so they cannot import. Up to 33f3638, content.ts stayed self-contained only by luck: it imported `quotes` and `snarky-titles`, which no other entry used.
  - Introduced by 372cc65 (`git log -S"CONFIRM_RESET_MS } from '../shared/types'"`).
- **Impact:** The core feature (the overlay) is dead in both browsers. The popup, badge and settings keep working, so the problem looks like "it just doesn't block".
- **Fix:** Short term, build the content script in a separate Vite or esbuild pass with `format: 'iife'` (or `inlineDynamicImports`), or inline the constant. Then add a post-build guard that fails the build when content.js is not a classic script:
  `node -e "new (require('vm').Script)(require('fs').readFileSync('dist/chrome/content.js','utf8'))"`.
  Long term, adopt WXT (see §Recommendation), which bundles content scripts as IIFE by design.

### 2. Shipped Firefox package contains 26 stale, unreferenced bundles (10x bloat; not reproducible from source). Severity: **High (AMO compliance)**
- **Evidence:**
  - `sordino-firefox-v1.0.0.zip` has 53 entries and 3.58 MB uncompressed, versus 22 entries and 354 KB for the Chrome zip from the same release. Its `chunks/` holds 15 `index-*.js` React bundles timestamped from 2026-01-06 17:45 to 2026-01-07 14:57, and `assets/` holds 13 CSS files.
  - Only 4 of those 30 files are referenced: `index-CTDQ28iR.js`, `schedule-CxcgHAI3.js`, `storage-CVlNGzWR.js` and `index-BGDGsBzy.css`.
  - Reproduced at HEAD: building twice with a code change leaves 17 files in dist/chrome and **21** in dist/firefox (the old `types-`, `schedule-`, `index-` and CSS files remain).
  - Cause: `restructureExtension.closeBundle` (`vite.config.ts:60-94`) only `mkdir`s and `cpSync`s into `dist/firefox`. It never empties it. Vite's own default `emptyOutDir` cleans only `outDir` (dist/chrome).
  - `web-ext lint` reports 29 warnings on the shipped package versus 3 on a clean build (each stale React chunk adds 2 `UNSAFE_VAR_ASSIGNMENT` warnings).
- **Impact:** AMO requires the submitted package to be reproducible from the submitted source. A reviewer running BUILD.md gets 4 chunks, not 30, so the next human review may flag the mismatch. It also wastes download size and lint noise.
- **Fix:** `rmSync('dist/firefox', {recursive:true, force:true})` before copying, or better, build each browser into its own clean outDir. Package with `web-ext build` / `wxt zip` from a clean CI checkout, never from a dev machine's dist folder.

### 3. `emptyDirBeforeWrite` is not a Vite option; the config does not typecheck. Severity: **Medium**
- **Evidence:**
  - `vite.config.ts:117`. `npx tsc --noEmit -p tsconfig.node.json` exits 2 with `TS2769 ... 'emptyDirBeforeWrite' does not exist in type 'BuildEnvironmentOptions'`, plus `TS2307 Cannot find module 'path'/'fs'` (no `@types/node`) and `TS2304 Cannot find name '__dirname'` (ESM package; `__dirname` works only because Vite's config loader shims it).
  - dist/chrome **is** cleaned, but only by Vite's default (`emptyOutDir` defaults to true when outDir is inside root). The intended behaviour silently does nothing.
- **Impact:** This is misleading config, and it shows nobody ever typechecked the config.
- **Fix:** Use `build.emptyOutDir: true`. Add `@types/node`. Use `fileURLToPath(new URL('.', import.meta.url))` instead of `__dirname`. Include tsconfig.node.json in the typecheck (`tsc -b`).

### 4. Hand-rolled Chrome-to-Firefox copy plugin is fragile and fails open. Severity: **Medium**
- **Evidence:**
  - `vite.config.ts:66-73`: a hard-coded `filesToCopy` list with `existsSync` guards (`:76`, `:82-94`). Any new entry (offscreen document, options page, new HTML) is silently left out of Firefox.
  - HTML is moved by `renameSync` from `dist/chrome/src/popup/index.html` (`:24-29`). If that path changes, `popup.html` silently goes missing.
  - Icons are copied twice: Vite already copies `public/`, then `:40-46` copies again.
  - `public/manifest.firefox.json` is copied into the Chrome build and then deleted (`:99-103`). Every other stray file in `public/` is shipped; the v1.0.0 Chrome zip contains `CLAUDE.md` and `icons/CLAUDE.md` (claude-mem stubs).
  - `package.json:10` `build:firefox` sets `BROWSER=firefox`, but `vite.config.ts` never reads it (`grep BROWSER` finds no match). `build`, `build:chrome` and `build:firefox` are the same command and all build both targets.
  - README.md:116-119 describes `npm run dev` as "dev server with HMR" (it is `vite build --watch`, with no HMR) and `build:chrome` as "Chrome only". Both descriptions are false.
  - BUILD.md:183-189 tells AMO reviewers that `build:firefox` "copies the Firefox-specific manifest" as if it were Firefox-specific. It is not.
- **Impact:** Silent cross-browser drift, junk files in store packages, and inaccurate reviewer instructions.
- **Fix:** Replace the plugin with a framework (WXT), or with two explicit builds, `vite build --mode chrome|firefox`, each with its own clean outDir and a manifest generated from one template. Remove the dead scripts or make them real.

### 5. No typecheck gate; the type error has existed since February. Severity: **Medium**
- **Evidence:**
  - `npx tsc --noEmit -p .` gives `src/background/service-worker.ts(4,50): error TS6133: 'BYPASS_DURATION_MS' is declared but its value is never read` and exits 2 at HEAD **and at 33f3638**. It exits 0 at 27a43a5, so the error was introduced in the February bypass work (b5acf46 era).
  - `package.json:7` `"build": "vite build"`. esbuild strips types without checking them.
- **Impact:** Type errors never block a build, and real ones will slip through the same way.
- **Fix:** Use `"typecheck": "tsc -b"` and `"build": "npm run typecheck && vite build"`, or run typecheck in CI. Fix the unused import.

### 6. No tests, lint, formatter, CI, changelog or release automation. Severity: **High (process)**
- **Evidence:**
  - No `*.test.*`, no eslint or prettier config, and no `.github/` directory (`gh api repos/tflaim/sordino/contents/.github` returns 404).
  - No CHANGELOG.
  - Version `1.0.0` appears in three hand-maintained places (`package.json:3`, `public/manifest.json:4`, `public/manifest.firefox.json:4`). It has not changed across 15 commits, +2251/-675 lines in 34 files since 33f3638, and new features (configurable bypass, scaffolding mode, onboarding).
  - The only tag on the remote is `v1.0.0` → f8aa93c (a README commit). The local clone has no tags at all.
  - Release zips were hand-built (the gitignored `sordino-chrome.zip`, `.gitignore:8`).
  - `src/shared/schedule.ts` and `isUrlBlocked`/`getBlockKey` are pure functions with overnight-span logic and no unit tests.
- **Impact:** Nothing stands between a commit and a broken release (see #1). Releases cannot be reproduced, and the stores reject re-uploads that keep the same version.
- **Fix:** See §Recommendation. Make the manifest version come from `package.json` at build time, and tag every store submission.

### 7. Lockfile pointed at a private corporate Artifactory until 2026-05-24. Severity: **Medium (historical; fixed at HEAD)**
- **Evidence:**
  - `git show 33f3638:package-lock.json` has 14 `"resolved": "https://gdartifactory1.jfrog.io/artifactory/api/npm/node-virt/..."` entries (react, react-dom, @types/react...). The same is true at 27a43a5, i.e. the lockfile in the AMO source-submission era.
  - `npm ci` in those worktrees fails with `E403 Forbidden ... gdartifactory1.jfrog.io/.../react-dom-19.2.3.tgz`.
  - HEAD (349f5d8) resolves all 164 entries against registry.npmjs.org.
- **Impact:** Anyone outside that network, including an **AMO source reviewer** following BUILD.md, could not install the January source. It also leaks an internal registry hostname.
- **Fix:** Done at HEAD. Add a CI `npm ci` (with a lockfile-lint `--allowed-hosts npm` check) so it cannot regress.

### 8. Universal `<all_urls>` content script at document_start. Severity: **Medium (Chrome Web Store review friction)**
- **Evidence:**
  - `public/manifest.json:20-41`: `host_permissions: ["<all_urls>"]` and a content script with `matches: ["<all_urls>"]`, `run_at: document_start`, injecting 23 KB (quotes, titles and CSS) into every page.
  - The Chrome Web Store sends broad host permissions to in-depth review, which fits the 9-month "In Review" status and the permission-trimming commits.
- **Impact:** Slow or rejected Chrome Web Store review, a scary install prompt for a "privacy-first" product, and per-page cost on every site.
- **Fix (optional, real trade-off):**
  - Declare `optional_host_permissions: ["<all_urls>"]`. Request the preset domains (about 15) at onboarding and each custom domain when it is added (`chrome.permissions.request`).
  - Inject with `chrome.scripting.registerContentScripts({id, matches: blockedPatterns, runAt: 'document_start', persistAcrossSessions: true})`, updated whenever the site list changes. This needs the `scripting` permission and works in Firefox MV3 too.
  - Cheaper alternative: keep `<all_urls>`, but make content.js a tiny stub that asks the service worker and lazily injects the overlay code via `scripting.executeScript` only on blocked sites.
  - At minimum, write a clear permission justification in the CWS dashboard.

### 9. Unneeded permissions and Chrome/Firefox drift. Severity: **Low-Medium**
- **Evidence:**
  - Firefox keeps `"tabs"` (`public/manifest.firefox.json:72`). Chrome dropped it in dd7d9cb.
  - The only tabs APIs used are `chrome.tabs.query({})` reading only `tab.id` (`service-worker.ts:9-12`) and `chrome.tabs.create` (`popup/App.tsx:120`). Neither needs `tabs`, which only gates `url/title/favIconUrl`. The URL reaches the service worker in the message body instead (`service-worker.ts:276`).
  - `activeTab` is in both manifests but unused: no `scripting`, no `action.onClicked`, and `<all_urls>` already grants host access.
  - Other drift:
    - The name differs: Chrome is "Sordino - Soft Website Blocker for Focus", Firefox is "Sordino".
    - CSP is declared only for Chrome.
    - The two manifests are fully duplicated.
  - PRIVACY.md:252-258 still justifies `tabs` and `activeTab` for both browsers.
- **Impact:** Larger install-prompt surface on Firefox ("Access browser tabs"), review questions, and a privacy policy that does not match the code.
- **Fix:** Remove `tabs` and `activeTab` from both manifests. Generate both from one template; one manifest can carry both `background.service_worker` and `background.scripts` (Chrome 121+ and Firefox 121+ each ignore the other key). Update PRIVACY.md.

### 10. `web_accessible_resources` exposes logo.png to every site (extension fingerprinting). Severity: **Low**
- **Evidence:** `public/manifest.json:42-47` exposes `icons/logo.png` to `<all_urls>` without `use_dynamic_url`. Any page can probe `chrome-extension://<fixed CWS id>/icons/logo.png` to detect Sordino users. In Firefox the moz-extension UUID is random per install, so the risk there is much smaller. The file is used only by `content.ts:157`.
- **Impact:** A privacy and fingerprinting vector, which conflicts with "privacy-first" positioning.
- **Fix:** Inline the 6 KB logo as a `data:` URI or SVG in the content script and drop WAR entirely, or add `"use_dynamic_url": true` (Chrome).

### 11. Google Fonts loaded remotely from popup and settings; the privacy policy says otherwise. Severity: **Medium (accuracy / store policy)**
- **Evidence:**
  - `src/index.css:1` contains `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond...&family=DM+Sans...')`. It survives into `dist/chrome/assets/index-RmmAC4nA.css` and into the shipped v1.0.0 CSS.
  - The extension-page CSP (`manifest.json:7`) restricts only `script-src`, so the request is allowed.
  - README.md:36 says "No external API calls"; PRIVACY.md:243-245 says "No external API calls / No third-party services".
  - The content overlay uses only system fonts (`content.ts:362...`), so page-side is clean.
- **Impact:** Every popup or settings open sends the user's IP, UA and timing to Google. The privacy policy is factually inaccurate, which AMO and CWS can act on. The fonts also fail offline.
- **Fix:** Self-host the woff2 files (for example `@fontsource/dm-sans` and `@fontsource/cormorant-garamond`) and add `style-src 'self'; font-src 'self'` to the CSP.

### 12. `options_ui` missing. Severity: **Low**
- **Evidence:** Neither manifest declares `options_ui`/`options_page`. Settings opens through `chrome.tabs.create({url: getURL('settings.html')})` (`popup/App.tsx:120`).
- **Impact:** There is no "Options" entry in chrome://extensions, about:addons or the toolbar context menu, which users and reviewers expect.
- **Fix:** Add `"options_ui": {"page": "settings.html", "open_in_tab": true}` and call `chrome.runtime.openOptionsPage()`.

### 13. Firefox `strict_min_version` 140 and Android mismatch. Severity: **Low (OK on desktop)**
- **Evidence:**
  - `manifest.firefox.json:63`. As of 2026-10-02, ESR 128 reached EOL (Sept 2025) and ESR 140 reached EOL (~2026-09-29). The current ESR is 153 (released 2026-07-21). So 140 excludes only the legacy ESR 115 branch (Win7-8.1 and old macOS extended support), which is a negligible share.
  - 140 is justified: `data_collection_permissions` needs desktop 140.
  - `web-ext lint` warns `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION: ... Firefox for Android 140 ... version 142 introduced support for data_collection_permissions`.
  - `background.scripts` with `type: module` is fine on Firefox 140.
  - Firefox MV3 host permissions can be revoked by the user per site, and the code never calls `permissions.contains`.
- **Fix:** Add `"gecko_android": {"strict_min_version": "142.0"}` (or drop Android). Optionally detect revoked host permission and prompt for it in the popup.

### 14. Dependencies: dev-only vulnerabilities, a stale Node floor, unused packages. Severity: **Low**
- **Evidence:**
  - `npm audit --omit=dev` finds 0 vulnerabilities.
  - Full `npm audit` finds 8 (2 low, 1 moderate, 5 high): vite 7.0.0-7.3.3 dev-server path traversal and fs.deny bypass, plus postcss, nanoid, picomatch, browserslist, esbuild and @babel/core. All are build-time or dev-server only and **not shipped**.
  - `npm outdated` shows vite 7.3.1 (7.3.6 wanted, 8.3.2 latest), `@types/chrome` 0.0.315 (latest 0.3.4), lucide-react 0.562 (1.50), TypeScript 5.9.3 (7.0.2), plugin-react 5.1.4 (6.1.1).
  - `autoprefixer` and `class-variance-authority` are installed but unused: autoprefixer is not in `postcss.config.js` and cva is never imported.
  - Runtime-bundled libraries (lucide-react, clsx, tailwind-merge) sit in devDependencies. That works for a bundled extension, but `--omit=dev` audits then miss them.
  - BUILD.md:137 says "Node v18.0.0 or higher", but vite 7 requires `^20.19.0 || >=22.12.0`. An AMO reviewer on Node 18 will fail.
- **Fix:** `npm audit fix` (in-range vite and postcss bumps). Remove the unused dependencies. Add `"engines": {"node": ">=20.19"}` and `.nvmrc`. Fix BUILD.md. Add Renovate or Dependabot.

### 15. Repo hygiene. Severity: **Low**
- **Evidence:**
  - 22 PNGs (11 MB) are committed under `sordino-qe-screenshots/`. The pack is 10.3 MiB, mostly these screenshots.
  - `sordino-qe-screenshots/DESIGN-CRITIQUE-PROMPT.md` is an AI prompt filed under screenshots.
  - `sordino.md` duplicates the README and leaks a local path (`/Users/taco/Documents/sordino`).
  - DESIGN.md (34 KB), PRODUCT.md and `docs/plans/*` are AI planning artifacts at the root.
  - `.gitignore` covers node_modules, dist, .DS_Store, *.log, .env, CLAUDE.md and sordino-chrome.zip, but not `*.zip`/`web-ext-artifacts/`/`.wxt/`/`.output/`. CLAUDE.md still reached the release zip through `public/`.
- **Impact:** Clone bloat, confusing docs, and personal or AI-tooling artifacts that may leak into store packages.
- **Fix:** Move screenshots to Git LFS, a release asset or a `docs/` image folder at reduced size. Move prompts and plans under `docs/`, or delete them. Ignore `*.zip`, `web-ext-artifacts/` and `.output/`. Never ship from `public/` without an allow-list, which WXT handles.

---

## Recommendation: minimal "proper build"

**Option A, recommended: migrate to [WXT](https://wxt.dev)** (Vite-based, React supported, actively maintained):
- Content scripts are bundled as IIFE automatically, which makes Finding 1 impossible.
- `wxt build -b chrome|firefox` produces per-browser clean output, with one manifest config in `wxt.config.ts` and per-browser overrides. That removes Findings 2, 4 and 9 (drift).
- `wxt zip -b firefox` also produces the **sources zip AMO needs**, and the version comes from package.json.
- Migration is roughly a day: move to `entrypoints/{background,content,popup,options}`.
- CRXJS is Chrome-first; vite-plugin-web-extension is a reasonable second choice.

**Option B, keep Vite (stopgap, about an hour):**
1. Run two builds: the existing config for popup, settings and background, plus `vite.content.config.ts` with `build.lib = {entry, formats: ['iife'], name: 'sordino'}`, `emptyOutDir: false`.
2. `emptyOutDir: true`. Delete `dist/firefox` before copying, and `cpSync` the whole chrome dir instead of a file list.
3. Post-build assertion: content.js must parse as a classic script (the `vm.Script` one-liner above).

**Tests:**
- **Vitest** for `schedule.ts` (overnight spans, day boundaries, `pausedUntil`, manual override) and the URL and domain matching (`isUrlBlocked`, `getBlockKey`, subdomain rules), with `chrome.*` mocked or kept out.
- A **Playwright extension smoke test** (Chromium, `--load-extension`). It sets `manualOverride:'on'` in `chrome.storage.local` from the extension popup page, routes `https://www.reddit.com/` to a stub, and asserts `#sordino-overlay`. The working script is at `scratchpad/build-review/smoke.mjs`. **It catches Finding 1**: it fails at HEAD and passes at 33f3638 and v1.0.0.
- `web-ext lint` does **not** catch Finding 1 (0 errors at HEAD), so the smoke test is the essential gate.

**CI (`.github/workflows/ci.yml`)** on push and PR, Node 22:
`npm ci` → `npx lockfile-lint --type npm --path package-lock.json --allowed-hosts npm` → `tsc -b` → `eslint .` (typescript-eslint and react-hooks; plus `prettier --check`) → `vitest run` → build both browsers → classic-script assertion → `npx playwright install chromium && npm run test:e2e` → `npx web-ext lint -s dist/firefox --warnings-as-errors` (after fixing the Android min version) → upload `dist` as an artifact.

**Release workflow** on tag `v*`:
- Verify the tag equals the package.json and manifest version.
- Build and zip both browsers plus the AMO sources zip, and attach them to a GitHub Release with notes from CHANGELOG.md (or Changesets).
- Optionally `web-ext sign --channel listed` (AMO API key secret) and `chrome-webstore-upload-cli` (CWS OAuth secrets) to publish.

**Immediately, before any release:** fix Finding 1, bump the version (1.1.0), clean dist/firefox, self-host fonts or correct PRIVACY.md, and drop `tabs` and `activeTab`.
