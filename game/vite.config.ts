/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import electron from 'vite-plugin-electron/simple'
import { devPortForRoot } from './scripts/dev-port.ts'
import type { BuildIdentity } from './src/shared/build/BuildIdentity.ts'

// Uncommitted audit followup plan, Ưu tiên 2 (Electron packaging,
// 2026-08-24) — plugin electron() chỉ đăng ký khi biến env ELECTRON được
// set (script "electron:dev"/"dist:win" trong package.json), để `npm run
// dev`/`npm run build` (target web thuần) tuyệt đối không đổi hành vi.
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
  // Asset URL tương đối — bắt buộc để index.html load đúng qua file://
  // khi Electron đóng gói (electron-builder). Không ảnh hưởng dev server/
  // vite preview, cả 2 vẫn phục vụ qua http bình thường.
  base: './',
  // Renderer bundle + Vitest both read the identity through this define.
  define: {
    __BUILD_IDENTITY__: buildIdentityDefine,
  },
  plugins: [
    vue(),
    vueDevTools(),
    buildIdentityManifestPlugin(),
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
            return undefined
          }
          if (/[\\/]src[\\/]data[\\/]/.test(id)) {
            return 'game-data'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    // Architecture/meta guards live under tests/ (kept out of app source);
    // e2e specs (*.spec.ts, Playwright) are unaffected.
    // tests/lab is assertion-light experiment sweeps (audit T7-61) - it has
    // its own config (vitest.lab.config.mts, `npm run lab`) and is OUT of
    // the default gate so committed experiments can't pass/fail the suite.
    include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
  },
})
