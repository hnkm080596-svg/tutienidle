import { defineStore } from 'pinia'

import { recordDiagnostic } from '../services/diagnostics/DiagnosticRecorder'

// Phase 5 (Reliability) - bao cho App.vue biet save hien co KHONG
// doc duoc (incompatible version / JSON hong), de chan boot vao man
// nhan vat moi mot cach am tham. Khac useErrorStore (loi runtime sau
// khi da boot): store nay chan TRUOC khi game khoi dong, xem
// SaveIncompatibleScreen.vue.
export const useSaveIssueStore = defineStore('saveIssue', {
  state: () => ({
    status: null as 'incompatible' | 'corrupted' | null,
    foundVersion: undefined as number | undefined,
    raw: '',
    // Whether the offending bytes live on the server ('remote') or only
    // in the local envelope ('local' - pending-conflict/quarantined).
    // The recovery screen must not run the remote character reset for a
    // local-scope report: the remote row is healthy in that case.
    scope: 'remote' as 'remote' | 'local',
  }),

  actions: {
    report(
      status: 'incompatible' | 'corrupted',
      raw: string,
      foundVersion?: number,
      scope: 'remote' | 'local' = 'remote',
    ) {
      this.status = status
      this.raw = raw
      this.foundVersion = foundVersion
      this.scope = scope
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
      this.scope = 'remote'
    },
  },
})
