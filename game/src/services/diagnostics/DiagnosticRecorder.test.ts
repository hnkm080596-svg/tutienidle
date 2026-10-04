import { afterEach, describe, expect, it, vi } from 'vitest'

import { DiagnosticRecorder } from './DiagnosticRecorder'
import { LocalBundleCrashReporter, type CrashReportRecord } from './CrashReporter'
import {
  bindDiagnosticRecorder,
  recordDiagnostic,
  recordDiagnosticError,
  unbindDiagnosticRecorder,
} from './DiagnosticRecorder'

const BASE = {
  source: 'renderer' as const,
  severity: 'error' as const,
  category: 'renderer-error' as const,
  code: 'TEST',
  message: 'something failed',
}

function makeRecorder(overrides: Record<string, unknown> = {}) {
  return new DiagnosticRecorder({
    reportId: 'report-test',
    ...overrides,
  })
}

describe('DiagnosticRecorder', () => {
  it('records a valid event with seq/atUtc stamped', () => {
    const recorder = makeRecorder({ nowUtc: () => '2026-09-30T01:02:03.000Z' })
    const event = recorder.record(BASE)
    expect(event).not.toBeNull()
    expect(event!.seq).toBe(1)
    expect(event!.atUtc).toBe('2026-09-30T01:02:03.000Z')
    expect(recorder.events).toHaveLength(1)
  })

  it('rejects invalid input without throwing', () => {
    const recorder = makeRecorder()
    expect(recorder.record({ severity: 'error' })).toBeNull()
    expect(recorder.record(null)).toBeNull()
    expect(recorder.record('nope')).toBeNull()
    expect(recorder.invalidCount).toBe(3)
    expect(recorder.events).toHaveLength(0)
  })

  it('bounds the ring: oldest events drop past maxEntries', () => {
    const recorder = makeRecorder({ bounds: { maxEntries: 5 } })
    for (let i = 0; i < 9; i += 1) {
      recorder.record({ ...BASE, message: `m${i}` })
    }
    expect(recorder.events.length).toBeLessThanOrEqual(5)
    expect(recorder.droppedCount).toBe(4)
    expect(recorder.events[0]!.message).toBe('m4')
    expect(recorder.events.at(-1)!.message).toBe('m8')
  })

  it('forwards recorded events through transport without breaking on failure', () => {
    const transport = vi.fn()
    const recorder = makeRecorder({ transport })
    recorder.record(BASE)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0]![0]).toMatchObject({ code: 'TEST', seq: 1 })

    const badTransport = makeRecorder({ transport: () => { throw new Error('ipc down') } })
    expect(() => badTransport.record(BASE)).not.toThrow()
    expect(badTransport.events).toHaveLength(1)
  })

  it('sends error/fatal records to the crash reporter with the report id', () => {
    const captured: CrashReportRecord[] = []
    const recorder = makeRecorder({
      reporter: { capture: (r: CrashReportRecord) => captured.push(r) },
    })
    recorder.record({ ...BASE, severity: 'info' })
    expect(captured).toHaveLength(0)
    recorder.record({ ...BASE, severity: 'fatal', message: 'death token=sekrit12345' })
    expect(captured).toHaveLength(1)
    expect(captured[0]!.reportId).toBe('report-test')
    expect(captured[0]!.message).not.toContain('sekrit12345')
  })

  it('exactly one sink per event through the production-shaped composition', () => {
    const sink: unknown[] = []
    const transport = (event: unknown) => sink.push(event)
    const recorder = makeRecorder({
      transport,
      reporter: new LocalBundleCrashReporter(transport),
    })
    recorder.record({ ...BASE, severity: 'error', message: 'boom' })
    // The error record reaches the shared sink once via the reporter - a
    // double-send would double-persist the line in the bundle.
    expect(sink).toHaveLength(1)
    recorder.record({ ...BASE, severity: 'info', message: 'note' })
    expect(sink).toHaveLength(2)
  })

  it('recordError captures name, message and a bounded redacted stack', () => {
    const recorder = makeRecorder()
    const error = new Error('kaboom token=topsecretvalue')
    const event = recorder.recordError(error, { category: 'renderer-error', code: 'VUE' })
    expect(event).not.toBeNull()
    expect(event!.message).not.toContain('topsecretvalue')
    expect(event!.details).toMatchObject({ errorName: 'Error' })
    expect(event!.stack).toBeDefined()
    expect(event!.stack!.split('\n').length).toBeLessThanOrEqual(8)
  })

  it('recordError tolerates non-Error values', () => {
    const recorder = makeRecorder()
    const event = recorder.recordError('plain string', {
      category: 'renderer-error',
      code: 'REJ',
    })
    expect(event).not.toBeNull()
    expect(event!.message).toContain('plain string')
  })

  it('drops a throwing provider value instead of crashing the caller', () => {
    const transport = vi.fn()
    const recorder = makeRecorder({
      transport,
      routeProvider: () => {
        throw new Error('router exploded')
      },
      revisionProvider: () => 'not-a-number' as never,
    })
    const event = recorder.record({ ...BASE, message: 'm' })
    // The caller's event survives with the bad context fields dropped;
    // record() itself never throws (it sits inside save/error paths).
    expect(event).not.toBeNull()
    expect(event!.route).toBeUndefined()
    expect(event!.revision).toBeUndefined()
    expect(transport).toHaveBeenCalledTimes(1)

    const fused = makeRecorder({
      revisionProvider: () => 'not-a-number' as never,
      correlationId: 'bad id with spaces!',
    })
    const fusedEvent = fused.record({ ...BASE, message: 'm2' })
    expect(fusedEvent).not.toBeNull()
    expect(fusedEvent!.correlationId).toBeUndefined()
    expect(fusedEvent!.revision).toBeUndefined()
    expect(fusedEvent!.message).toBe('m2')
  })

  it('fills route/revision/correlationId from bound context providers', () => {
    const recorder = makeRecorder()
    recorder.bindContext({
      routeProvider: () => '/game/combat?x=1',
      revisionProvider: () => 41,
      correlationId: 'corr-9',
    })
    const event = recorder.record({ ...BASE, message: 'm' })
    expect(event!.route).toBe('/game/combat')
    expect(event!.revision).toBe(41)
    expect(event!.correlationId).toBe('corr-9')

    const explicit = recorder.record({ ...BASE, message: 'm', correlationId: 'corr-x' })
    expect(explicit!.correlationId).toBe('corr-x')
  })
})

describe('module binding', () => {
  afterEach(() => {
    unbindDiagnosticRecorder()
  })

  it('is a no-op when unbound and forwards when bound', () => {
    expect(recordDiagnostic(BASE)).toBeNull()
    const recorder = makeRecorder()
    bindDiagnosticRecorder(recorder)
    const event = recordDiagnostic(BASE)
    expect(event).not.toBeNull()
    expect(recordDiagnosticError(new Error('x'), {
      category: 'renderer-error',
      code: 'E',
    })).not.toBeNull()
    unbindDiagnosticRecorder()
    expect(recordDiagnostic(BASE)).toBeNull()
  })
})
