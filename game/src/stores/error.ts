import { defineStore } from 'pinia'

import {
  recordDiagnostic,
  recordDiagnosticError,
} from '../services/diagnostics/DiagnosticRecorder'
import type { DiagnosticCategory } from '../shared/diagnostics/DiagnosticEvent'

export interface ErrorReportContext {
  /** The original error object - stack/name reach the recorder, never the UI. */
  error?: unknown
  code?: string
  category?: DiagnosticCategory
}

export const useErrorStore = defineStore('error', {
  state: () => ({
    current: null as string | null,
  }),

  actions: {
    report(message: string, context: ErrorReportContext = {}) {
      this.current = message
      // BETA-FINAL PR11 - the store remains the single UI funnel; the
      // diagnostic trail is best-effort (no-op when no recorder is bound).
      if (context.error !== undefined) {
        recordDiagnosticError(context.error, {
          category: context.category ?? 'renderer-error',
          code: context.code ?? 'ERROR_REPORTED',
        })
      } else {
        recordDiagnostic({
          source: 'renderer',
          severity: 'error',
          category: context.category ?? 'renderer-error',
          code: context.code ?? 'ERROR_REPORTED',
          message,
        })
      }
    },

    clear() {
      this.current = null
    },
  },
})
