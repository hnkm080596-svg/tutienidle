/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import electron from 'vite-plugin-electron/simple'

// Uncommitted audit followup plan, Ưu tiên 2 (Electron packaging,
// 2026-08-24) — plugin electron() chỉ đăng ký khi biến env ELECTRON được
// set (script "electron:dev"/"dist:win" trong package.json), để `npm run
// dev`/`npm run build` (target web thuần) tuyệt đối không đổi hành vi.
const isElectron = Boolean(process.env.ELECTRON)

// https://vite.dev/config/
export default defineConfig({
  // Port per-checkout (2026-09-07) — standing-slot worktree dùng 5175
  // (master 5173, UITemp 5174): chạy song song nhiều dev server không xung
  // đột port (vite otherwise auto-increment, nhưng Playwright baseURL cần
  // port cố định biết trước). Env override vẫn được: npm run dev -- --port 5999.
  server: {
    port: Number(process.env.DEV_PORT ?? 5175),
    strictPort: false,
  },
  preview: {
    port: Number(process.env.DEV_PORT ?? 5175),
    strictPort: false,
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
        // Tách vendor (Vue/Pinia/router/i18n) và các bảng data tĩnh lớn
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
              /[\\/]node_modules[\\/](vue|@vue|pinia|vue-router|vue-i18n|@intlify|@floating-ui)[\\/]/.test(
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
    include: ['src/**/*.test.ts'],
  },
})
