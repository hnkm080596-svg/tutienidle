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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
