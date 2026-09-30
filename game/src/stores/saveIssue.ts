import { defineStore } from 'pinia'

import { recordDiagnostic } from '../services/diagnostics/DiagnosticRecorder'

// Phase 5 (Reliability) — báo cho App.vue biết save hiện có KHÔNG
// đọc được (incompatible version / JSON hỏng), để chặn boot vào màn
// nhân vật mới một cách âm thầm. Khác useErrorStore (lỗi runtime sau
// khi đã boot): store này chặn TRƯỚC khi game khởi động, xem
// SaveIncompatibleScreen.vue.
export const useSaveIssueStore = defineStore('saveIssue', {
  state: () => ({
    status: null as 'incompatible' | 'corrupted' | null,
    foundVersion: undefined as number | undefined,
    raw: '',
  }),

  actions: {
    report(status: 'incompatible' | 'corrupted', raw: string, foundVersion?: number) {
      this.status = status
      this.raw = raw
      this.foundVersion = foundVersion
      // BETA-FINAL PR11 - metadata only: `raw` (the unreadable save bytes)
      // must NEVER enter the diagnostic trail.
      recordDiagnostic({
        source: 'renderer',
        severity: 'error',
        category: 'lifecycle',
        code: `SAVE_ISSUE_${status.toUpperCase()}`,
        message: `boot blocked: save ${status}`,
        details: { status, foundVersion: foundVersion ?? null },
      })
    },

    clear() {
      this.status = null
      this.raw = ''
      this.foundVersion = undefined
    },
  },
})
