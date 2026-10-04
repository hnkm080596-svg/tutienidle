// BETA-FINAL PR11 / spec B8 - the crash reporter provider boundary.
//
// capture() consumes an ALREADY-redacted, already-validated record; a
// provider never receives raw Errors, request bodies, or save payloads.
// The default provider is LocalBundleCrashReporter, which persists the
// record into the local diagnostic bundle through a caller-supplied append
// sink (renderer-side: an IPC forward; main-side: a file append). No remote
// vendor SDK ships here: remote telemetry needs a separate privacy/provider
// approval before any implementation may be added behind this interface.

import type { DiagnosticEvent } from '../../shared/diagnostics/DiagnosticEvent'

/** The record a provider consumes: one validated, redacted event whose
 *  reportId is guaranteed present. */
export type CrashReportRecord = DiagnosticEvent & { readonly reportId: string }

export interface CrashReporter {
  capture(record: CrashReportRecord): void
}

export class LocalBundleCrashReporter implements CrashReporter {
  constructor(private readonly append: (record: CrashReportRecord) => void) {}

  capture(record: CrashReportRecord): void {
    try {
      this.append(record)
    } catch {
      // Diagnostics must never take the game down with the reporter.
    }
  }
}
