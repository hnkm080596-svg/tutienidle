/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import electron from 'vite-plugin-electron/simple'
import { devPortForRoot } from './scripts/dev-port.ts'
import type { BuildIdentity } from './src/shared/build/BuildIdentity.ts'

// Uncommitted audit followup plan, Uu tien 2 (Electron packaging,
// 2026-08-24) - plugin electron() chi dang ky khi bien env ELECTRON duoc
// set (script "electron:dev"/"dist:win" trong package.json), de `npm run
// dev`/`npm run build` (target web thuan) tuyet doi khong doi hanh vi.
const isElectron = Boolean(process.env.ELECTRON)

// Port per checkout (audit T7-62, 2026-09-16): derived from the checkout
// root path so each worktree owns a distinct port; strictPort makes a
// collision fail loudly instead of silently serving the wrong tree.
// playwright.config.ts derives the same value, so its webServer always
// targets this server. Override: DEV_PORT=5999 npm run dev.
const devPort = Number(process.env.DEV_PORT ?? devPortForRoot(fileURLToPath(new URL('.', import.meta.url))))

const gameRoot = fileURLToPath(new URL('.', import.meta.url))

// BETA-FINAL PR1 / spec B2 - ONE generator invocation feeds the renderer
// define, the Electron main define and the emitted JSON manifest, so the
// three artifacts can never disagree. The generator fails closed on invalid
// release inputs (bad tag/version, dirty tree, missing SHA/build id).
const buildIdentity = JSON.parse(
  execFileSync(
    process.execPath,
    [path.join(gameRoot, 'scripts', 'release', 'build-identity.mjs'), '--json'],
    { cwd: gameRoot, encoding: 'utf8' },
  ),
) as BuildIdentity
const buildIdentityDefine = JSON.stringify(buildIdentity)

// BETA-FINAL PR8 / spec B3 - Content-Security-Policy for the packaged
// file:// renderer. Injected only into the BUILT index.html so the dev
// server keeps an unrestricted page (HMR websockets, devtools). When
// VITE_ASSET_BASE_URL points assets at a CDN, that origin is added to
// img/media/connect - same contract the runtime resolver uses.
const assetBase = (process.env.VITE_ASSET_BASE_URL ?? '').trim().replace(/\/+$/, '')
let assetOrigin = ''
if (assetBase) {
  try {
    const origin = new URL(assetBase).origin
    // 'null' (e.g. a file: or opaque-scheme base) is not a usable CSP origin.
    assetOrigin = origin === 'null' ? '' : origin
  } catch {
    throw new Error(`VITE_ASSET_BASE_URL is not a valid URL: ${assetBase}`)
  }
}
const withAssetOrigin = (directive: string) =>
  assetOrigin ? `${directive} ${assetOrigin}` : directive
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  withAssetOrigin("img-src 'self' data: blob:"),
  withAssetOrigin("media-src 'self' data: blob:"),
  withAssetOrigin("font-src 'self' data:"),
  withAssetOrigin("connect-src 'self' https://*.supabase.co wss://*.supabase.co"),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function productionCspPlugin(): Plugin {
  return {
    name: 'tutien-production-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Fail the build rather than silently ship a page without CSP.
        if (!html.includes('</title>')) {
          throw new Error(
            'production CSP: index.html has no </title> anchor to inject after',
          )
        }
        return html.replace(
          '</title>',
          `</title>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}">`,
        )
      },
    },
  }
}

// Emits dist/build-identity.json (and dist-electron/build-identity.json when
// attached to the main build) - the release manifest for later artifact
// verification (`node scripts/release/build-identity.mjs check`).
function buildIdentityManifestPlugin(): Plugin {
  return {
    name: 'tutien-build-identity-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-identity.json',
        source: JSON.stringify(buildIdentity, null, 2) + '\n',
      })
    },
  }
}

const USED_VFX_SPRITESHEET_FILES = new Set([
  'Slash_21.png',
  'Slash_21.json',
  'SFFXEP 09.png',
  'SFFXEP 09.json',
  '火 (20).png',
  '火 (20).json',
  '火 (9).png',
  '火 (9).json',
  'Lightning_Tribulation.png',
  'Lightning_Tribulation.json',
])

// Prunes raw/staging/preview assets copied from public/ into outDir so web
// and Cloudflare deployments do not carry ~1.65 GB of unreferenced files.
function pruneUnusedPublicAssetsPlugin(): Plugin {
  let resolvedOutDir = path.join(gameRoot, 'dist')
  return {
    name: 'tutien-prune-unused-public-assets',
    apply: 'build',
    configResolved(config) {
      resolvedOutDir = path.resolve(gameRoot, config.build.outDir)
    },
    closeBundle() {
      const dirsToRemove = [
        path.join(resolvedOutDir, 'NEWSPRITE'),
        path.join(resolvedOutDir, 'assets', 'backgrounds', 'thanh-van', 'modular', 'previews'),
        path.join(resolvedOutDir, 'assets', 'backgrounds', 'dong-fu', 'modular', 'previews'),
        path.join(resolvedOutDir, 'assets', 'buildings', 'dong-fu', 'separated-v1', 'preview-cells'),
        path.join(resolvedOutDir, 'assets', 'buildings', 'dong-fu', 'v2', 'previews'),
        path.join(resolvedOutDir, 'assets', 'buildings', 'dong-fu', 'master-v1-crops'),
        path.join(resolvedOutDir, 'assets', 'buildings', 'dong-fu', 'master-v1-masks'),
        path.join(resolvedOutDir, 'assets', 'ui', 'huyen-kim', '_source'),
        path.join(resolvedOutDir, 'assets', 'ui', 'huyen-kim', 'preview'),
        path.join(resolvedOutDir, 'assets', 'ui', 'tien-hiep-2026-10', 'drafts'),
      ]
      for (const dir of dirsToRemove) {
        if (existsSync(dir)) {
          rmSync(dir, { recursive: true, force: true })
        }
      }
      const vfxSpritesheetsDir = path.join(resolvedOutDir, 'assets', 'vfx', 'spritesheets')
      if (existsSync(vfxSpritesheetsDir)) {
        for (const entry of readdirSync(vfxSpritesheetsDir)) {
          if (!USED_VFX_SPRITESHEET_FILES.has(entry)) {
            rmSync(path.join(vfxSpritesheetsDir, entry), { recursive: true, force: true })
          }
        }
      }
      const cdnAssetsDir = path.join(gameRoot, 'cdn-assets')
      const outAssetsDir = path.join(resolvedOutDir, 'assets')
      if (existsSync(cdnAssetsDir) && existsSync(outAssetsDir)) {
        cpSync(cdnAssetsDir, outAssetsDir, { recursive: true, force: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: devPort,
    strictPort: true,
  },
  preview: {
    port: devPort,
    strictPort: true,
  },
  // Asset URL tuong doi - bat buoc de index.html load dung qua file://
  // khi Electron dong goi (electron-builder). Khong anh huong dev server/
  // vite preview, ca 2 van phuc vu qua http binh thuong.
  base: './',
  // Renderer bundle + Vitest both read the identity through this define.
  define: {
    __BUILD_IDENTITY__: buildIdentityDefine,
  },
  plugins: [
    vue(),
    // vite-plugin-vue-devtools is apply:'serve' internally (dev-only); it is
    // listed here for the dev server only and contributes nothing to builds.
    vueDevTools(),
    buildIdentityManifestPlugin(),
    productionCspPlugin(),
    pruneUnusedPublicAssetsPlugin(),
    ...(isElectron
      ? [
          electron({
            main: {
              entry: 'electron/main.ts',
              // The SAME identity literal reaches the main bundle; the
              // manifest copy lets dist-electron prove agreement offline.
              vite: {
                define: { __BUILD_IDENTITY__: buildIdentityDefine },
                plugins: [buildIdentityManifestPlugin()],
              },
            },
            preload: { input: 'electron/preload.ts' },
            renderer: {},
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor (Vue/Pinia/i18n) and the large static data tables
        // (materials/skill/enemy/stage/equipment/pill/talisman/buff/
        // formation/alchemy/building/progression/quest) out of the main
        // entry chunk. These tables stay statically imported (registered
        // synchronously at boot in App.vue - see GameManager.register*),
        // so do NOT switch to dynamic import; the split here only
        // improves browser caching (static data changes less than app
        // code) and shrinks the single index chunk. Runtime behavior is
        // unchanged - only how Rollup groups modules into files.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              /[\\/]node_modules[\\/](vue|@vue|pinia|vue-i18n|@intlify|@floating-ui)[\\/]/.test(
                id,
              )
            ) {
              return 'vendor'
            }
            if (
              /[\\/]node_modules[\\/](tone|standardized-audio-context|automation-events|tslib)[\\/]/.test(
                id,
              )
            ) {
              return 'audio-vendor'
            }
            return undefined
          }
          if (/[\\/]src[\\/](data|locales)[\\/]/.test(id)) {
            return 'game-data'
          }
          if (/[\\/]src[\\/]core[\\/](battle|skilldef|combat|reaction|buff2)[\\/]/.test(id)) {
            return 'combat-core'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    // BETA SCOPE LOCK v2: every suite starts with the full way catalog
    // admitted (pre-beta defaults); gating suites call
    // lockBetaWaysForTests() to re-pin the canonical set.
    setupFiles: ['./tests/setup.betaScope.ts'],
    // Architecture/meta guards live under tests/ (kept out of app source);
    // e2e specs (*.spec.ts, Playwright) are unaffected.
    // tests/lab is assertion-light experiment sweeps (audit T7-61) - it has
    // its own config (vitest.lab.config.mts, `npm run lab`) and is OUT of
    // the default gate so committed experiments can't pass/fail the suite.
    include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
  },
})
