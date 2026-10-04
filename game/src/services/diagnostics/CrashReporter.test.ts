import { describe, expect, it, vi } from 'vitest'

import {
  LocalBundleCrashReporter,
  type CrashReportRecord,
} from './CrashReporter'

const RECORD: CrashReportRecord = {
  reportId: 'report-1',
  seq: 7,
  atUtc: '2026-09-30T00:00:00.000Z',
  source: 'renderer',
  severity: 'error',
  category: 'renderer-error',
  code: 'TEST',
  message: 'already redacted',
}

describe('LocalBundleCrashReporter', () => {
  it('forwards the already-redacted record to its append sink', () => {
    const append = vi.fn()
    const reporter = new LocalBundleCrashReporter(append)
    reporter.capture(RECORD)
    expect(append).toHaveBeenCalledWith(RECORD)
  })

  it('never throws when the sink fails', () => {
    const reporter = new LocalBundleCrashReporter(() => {
      throw new Error('disk gone')
    })
    expect(() => reporter.capture(RECORD)).not.toThrow()
  })
})
