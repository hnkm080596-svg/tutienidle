import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import '@/assets/themes/ink-minimal.css'
import '@/assets/themes/landscape-shanshui.css'
import '@/assets/themes/xianxia-glow.css'
import '@/assets/themes/classical-imperial.css'
import '@/assets/artTestMode.css'
import App from './App.vue'
import router from './router'
import { vTooltip } from './directives/tooltip'
import { useErrorStore } from './stores/error'
import { useThemeStore } from './stores/themeStore'
import { initUiScale } from './composables/uiScale'
import { i18n } from './i18n'
import { isArtTestMode } from '@/core/dev/DevMode'

// WS8 — áp UI scale người chơi chọn TRƯỚC mount để không nhấp nháy font.
initUiScale()

// Art test mode (xem core/dev/DevMode.ts) — áp class TRƯỚC mount để
// không nhấp nháy style gốc rồi mới tắt.
if (isArtTestMode()) {
  document.documentElement.classList.add('dev-art-test-mode')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)
app.directive('tooltip', vTooltip)

// Beta Phase 4 (Global Error Boundary, mục XVIII) — bắt lỗi NGOÀI
// vòng render component (event handler, timer, promise reject không
// await...). Lỗi TRONG render/setup/watcher của cây component con bắt
// riêng qua ErrorBoundary.vue's onErrorCaptured(). Truyền thẳng
// instance `pinia` (không gọi useErrorStore() không tham số) vì
// errorHandler chạy NGOÀI context setup() của bất kỳ component nào —
// không có "active pinia" ngầm định để dựa vào.
app.config.errorHandler = err => {
  useErrorStore(pinia).report(err instanceof Error ? err.message : String(err))
}

// Theme redesign (Task 1.5) — áp <html data-theme> TRƯỚC app.mount() để
// Vue render với đúng biến CSS từ đầu, không bị flash theme mặc định
// rồi mới swap. Truyền `pinia` thẳng vì chạy NGOÀI context setup()
// component (giống useErrorStore ở trên) — không có "active pinia"
// ngầm định.
useThemeStore(pinia).applyToDocument()

app.mount('#app')
