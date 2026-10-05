import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/theme.css'
import './assets/huyen-kim.tokens.css'
import './assets/system-theme.css'
import './assets/tien-hiep-ui.css'
import './assets/tien-hiep-secondary-ui.css'
import './assets/tien-hiep-auxiliary.css'
import './assets/pc-paper-production.css'
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

// WS8 - ap UI scale nguoi choi chon TRUOC mount de khong nhap nhay font.
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

installTienHiepUiAssets(document.documentElement)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.directive('tooltip', vTooltip)

// Beta Phase 4 (Global Error Boundary, muc XVIII) - bat loi NGOAI
// vong render component (event handler, timer, promise reject khong
// await...). Loi TRONG render/setup/watcher cua cay component con bat
// rieng qua ErrorBoundary.vue's onErrorCaptured(). Truyen thang
// instance `pinia` (khong goi useErrorStore() khong tham so) vi
// errorHandler chay NGOAI context setup() cua bat ky component nao -
// khong co "active pinia" ngam dinh de dua vao.
app.config.errorHandler = err => {
  useErrorStore(pinia).report(err instanceof Error ? err.message : String(err), {
    error: err,
    code: 'VUE_HANDLER',
  })
}

app.mount('#app')
