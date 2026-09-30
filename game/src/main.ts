import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import './assets/system-theme.css'
import App from './App.vue'
import { vTooltip } from './directives/tooltip'
import { useErrorStore } from './stores/error'
import { initUiScale } from './composables/uiScale'
import { initLocale } from './composables/locale'
import { i18n } from './i18n'
import {
  bindDiagnosticRecorder,
  DiagnosticRecorder,
} from './services/diagnostics/DiagnosticRecorder'
import { LocalBundleCrashReporter } from './services/diagnostics/CrashReporter'
import type { DiagnosticEvent } from './shared/diagnostics/DiagnosticEvent'

// WS8 — áp UI scale người chơi chọn TRƯỚC mount để không nhấp nháy font.
initUiScale()
// Saved locale applies before mount - no VI flash before hydration.
initLocale()

// BETA-FINAL PR11 / spec B8 - one recorder bound before mount so every
// layer (error store, boundary, bridge, lifecycle) records through it.
// Under Electron the transport forwards each validated+redacted event to
// the main-process bundle; the crash reporter consumes error/fatal records
// through the same sink (one line per event, no duplicates). On web both
// are no-ops - the ring alone keeps the trail.
const diagnosticsTransport = (event: DiagnosticEvent) => {
  window.electronAPI?.reportDiagnosticEvent?.(event)
}
const diagnosticsRecorder = bindDiagnosticRecorder(
  new DiagnosticRecorder({
    transport: diagnosticsTransport,
    reporter: new LocalBundleCrashReporter(diagnosticsTransport),
  }),
)

window.addEventListener('error', (ev) => {
  diagnosticsRecorder.recordError(ev.error ?? ev.message, {
    category: 'renderer-error',
    code: 'WINDOW_ERROR',
  })
})
window.addEventListener('unhandledrejection', (ev) => {
  diagnosticsRecorder.recordError(ev.reason, {
    category: 'renderer-error',
    code: 'UNHANDLED_REJECTION',
  })
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
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
  useErrorStore(pinia).report(err instanceof Error ? err.message : String(err), {
    error: err,
    code: 'VUE_HANDLER',
  })
}

app.mount('#app')
