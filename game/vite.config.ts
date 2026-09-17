/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import electron from 'vite-plugin-electron/simple'
import { devPortForRoot } from './scripts/dev-port.ts'

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
  plugins: [
    vue(),
    vueDevTools(),
    ...(isElectron
      ? [
          electron({
            main: { entry: 'electron/main.ts' },
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
        // Tách vendor (Vue/Pinia/i18n) và các bảng data tĩnh lớn
        // (materials/skill/enemy/stage/equipment/pill/talisman/buff/
        // formation/alchemy/building/progression/quest) ra khỏi chunk
        // entry chính. Các bảng data này vẫn được import tĩnh (đăng ký
        // đồng bộ lúc boot trong App.vue — xem GameManager.register*),
        // nên KHÔNG đổi sang dynamic import; tách riêng ở đây chỉ nhằm
        // cải thiện cache trình duyệt (data tĩnh đổi ít hơn code app) và
        // giảm kích thước 1 chunk index đơn lẻ. Không ảnh hưởng hành vi
        // runtime — chỉ đổi cách Rollup nhóm module vào file.
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
    // tests/lab is assertion-light experiment sweeps (audit T7-61) — it has
    // its own config (vitest.lab.config.mts, `npm run lab`) and is OUT of
    // the default gate so committed experiments can't pass/fail the suite.
    include: ['src/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
  },
})
