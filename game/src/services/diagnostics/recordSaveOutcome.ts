// BETA-FINAL PR11 - the one translation from a CloudSaveWriteResult to a
// diagnostic event, shared by the autosave path (App.vue persistPlayer)
// and the boot-commit paths (useAppLifecycle). Scalars only - never save
// bytes, never the server message verbatim beyond the bounded message
// field; ok results are not recorded (autosave cadence would flood the
// bounded ring).

import type { CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import { recordDiagnostic } from './DiagnosticRecorder'

export function recordSaveOutcome(result: CloudSaveWriteResult, trigger: string): void {
  if (result.status === 'ok') return
  recordDiagnostic({
    source: 'renderer',
    severity: 'error',
    category: 'save',
    code: `SAVE_${result.status.toUpperCase().replace(/-/g, '_')}`,
    message: `save ${result.status} (${trigger})`,
    details: {
      status: result.status,
      trigger,
      ...(result.status === 'conflict'
        ? { currentRevision: result.currentRevision }
        : {
            retryable: result.retryable,
            ...(result.code !== undefined ? { code: result.code } : {}),
            ...(result.detail !== undefined ? { detail: result.detail } : {}),
          }),
    },
  })
}
