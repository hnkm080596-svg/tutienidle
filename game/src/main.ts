import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import App from './App.vue'
import router from './router'
import { vTooltip } from './directives/tooltip'
import { useErrorStore } from './stores/error'
import { initUiScale } from './composables/uiScale'

// WS8 — áp UI scale người chơi chọn TRƯỚC mount để không nhấp nháy font.
initUiScale()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
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

app.mount('#app')
