import { describe, expect, it } from 'vitest'

import type { BuildIdentity } from '../shared/build/BuildIdentity'
import { DEFAULT_DIAGNOSTIC_BOUNDS } from '../shared/diagnostics/DiagnosticEvent'
import {
  DiagnosticBundle,
  type DiagnosticBundleFs,
  type DiagnosticBundleManifest,
} from './DiagnosticBundle'

const IDENTITY: BuildIdentity = {
  productName: 'Tien Hiep Idle',
  appVersion: '0.1.0-beta.3',
  buildId: 'test-build-1',
  gitSha: 'dcabd316deadbeef',
  saveSchemaVersion: 87,
  backendEnvironment: 'beta',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-30T00:00:00.000Z',
}

function memoryFs(files: Map<string, string>, fail = false): DiagnosticBundleFs {
  const denied = (): never => {
    throw Object.assign(new Error('denied'), { code: 'EACCES' })
  }
  const missing = (): never => {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' })
  }
  return {
    async mkdir() {
      if (fail) denied()
    },
    async appendFile(path, data) {
      if (fail) denied()
      files.set(path, (files.get(path) ?? '') + data)
    },
    async readFile(path) {
      if (fail) denied()
      const data = files.get(path) ?? missing()
      return data
    },
    async writeFile(path, data) {
      if (fail) denied()
      files.set(path, data)
    },
    async rename(from, to) {
      if (fail) denied()
      const data = files.get(from) ?? missing()
      files.delete(from)
      files.set(to, data)
    },
    async readdir(dir) {
      if (fail) denied()
      const prefix = `${dir}/`
      return [...files.keys()]
        .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
        .map((k) => k.slice(prefix.length))
    },
    async stat(path) {
      if (fail) denied()
      const data = files.get(path) ?? missing()
      return { size: data.length }
    },
    async unlink(path) {
      if (fail) denied()
      files.delete(path)
    },
  }
}

function makeFs(seed: Record<string, string> = {}, fail = false) {
  const files = new Map<string, string>(Object.entries(seed))
  return { fs: memoryFs(files, fail), files }
}

function makeBundle(files: Map<string, string>, overrides: Record<string, unknown> = {}) {
  return new DiagnosticBundle({
    directory: '/userData/diagnostics',
    identity: IDENTITY,
    fs: memoryFs(files),
    randomId: () => 'minted-report-id',
    nowUtc: () => '2026-09-30T05:00:00.000Z',
    ...overrides,
  })
}

const EVENT = {
  source: 'renderer' as const,
  severity: 'error' as const,
  category: 'renderer-error' as const,
  code: 'TEST',
  message: 'boom',
}

describe('DiagnosticBundle', () => {
  it('appends validated events as NDJSON lines', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    await bundle.append(EVENT)
    await bundle.append({ ...EVENT, severity: 'info', message: 'ok' })
    const live = files.get('/userData/diagnostics/events.ndjson') ?? ''
    const lines = live.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!)).toMatchObject({ code: 'TEST' })
  })

  it('rejects malformed and freeform renderer payloads', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    expect(await bundle.append({ raw: '{"password":"x"}' })).toBe(false)
    expect(await bundle.append('freeform')).toBe(false)
    expect(await bundle.append({ ...EVENT, extra: 'smuggled' })).toBe(false)
    expect(files.get('/userData/diagnostics/events.ndjson')).toBeUndefined()
  })

  it('serializes concurrent appends - every line stays parseable', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => bundle.append({ ...EVENT, message: `m${i}` })),
    )
    const live = files.get('/userData/diagnostics/events.ndjson') ?? ''
    const lines = live.trim().split('\n')
    expect(lines).toHaveLength(25)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('rotates the live file when it exceeds maxFileBytes and caps at maxFiles', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files, {
      bounds: { maxFileBytes: 200, maxFiles: 3 },
    })
    for (let i = 0; i < 12; i += 1) {
      await bundle.append({ ...EVENT, message: `payload-${i}-${'x'.repeat(60)}` })
    }
    const names = [...files.keys()].sort()
    expect(names).toContain('/userData/diagnostics/events.ndjson')
    expect(names).toContain('/userData/diagnostics/events.ndjson.1')
    expect(names).toContain('/userData/diagnostics/events.ndjson.2')
    expect(names.filter((n) => n.endsWith('.3'))).toHaveLength(0)
    expect(files.get('/userData/diagnostics/events.ndjson.2')!.length)
      .toBeLessThanOrEqual(200 + 120)
  })

  it('mints and persists a stable report id across instances', async () => {
    const files = new Map<string, string>()
    const first = makeBundle(files)
    const id = await first.reportId()
    expect(id).toBe('minted-report-id')
    const second = makeBundle(files, { randomId: () => 'other-id' })
    expect(await second.reportId()).toBe('minted-report-id')
  })

  it('falls back to an in-memory report id when the disk denies access', async () => {
    const { fs } = makeFs({}, true)
    const bundle = new DiagnosticBundle({
      directory: '/userData/diagnostics',
      identity: IDENTITY,
      fs,
      randomId: () => 'fallback-id',
    })
    expect(await bundle.reportId()).toBe('fallback-id')
    expect(await bundle.reportId()).toBe('fallback-id')
    expect(await bundle.append(EVENT)).toBe(false)
  })

  it('exports manifest+summary+events; manifest carries the build identity', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    await bundle.append(EVENT)
    await bundle.append({ ...EVENT, severity: 'fatal', code: 'DEAD', message: 'gone' })
    const result = await bundle.export('/out/report.json', {
      revision: 41,
      saveHash: 'abc123hash',
    })
    expect(result.status).toBe('exported')
    const bundleText = files.get('/out/report.json')!
    const parsed = JSON.parse(bundleText) as {
      manifest: DiagnosticBundleManifest
      summary: string
      events: unknown[]
    }
    expect(parsed.manifest.buildId).toBe(IDENTITY.buildId)
    expect(parsed.manifest.reportId).toBe('minted-report-id')
    expect(parsed.manifest.save.revision).toBe(41)
    expect(parsed.manifest.save.hash).toBe('abc123hash')
    expect(parsed.events).toHaveLength(3) // 2 appended + export-requested marker
    expect(typeof parsed.summary).toBe('string')
    expect(parsed.summary).toContain(IDENTITY.buildId)
  })

  it('bounds the exported bundle by maxBundleEvents and maxBundleBytes', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files, {
      bounds: { maxBundleEvents: 10, maxEntries: 200 },
    })
    for (let i = 0; i < 30; i += 1) {
      await bundle.append({ ...EVENT, message: `m${i}` })
    }
    const result = await bundle.export('/out/r.json', {})
    expect(result.status).toBe('exported')
    const parsed = JSON.parse(files.get('/out/r.json')!) as {
      manifest: DiagnosticBundleManifest
      events: unknown[]
    }
    expect(parsed.events.length).toBeLessThanOrEqual(10)
    expect(parsed.manifest.counts.truncatedEvents).toBeGreaterThan(0)

    const tiny = makeBundle(files, {
      bounds: { maxBundleBytes: 3000, maxBundleEvents: 10 },
    })
    const r2 = await tiny.export('/out/small.json', {})
    expect(r2.status).toBe('exported')
    expect((files.get('/out/small.json') ?? '').length).toBeLessThanOrEqual(3000)
  })

  it('redacts planted secrets end-to-end through export', async () => {
    const plantedRefreshToken = 'rt-planted-refresh-token-9f8e7d6c'
    const plantedRawSave = '{"saveVersion":87,"player":{"gold":42}}'
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    await bundle.append({
      ...EVENT,
      message: `flush failed token=${plantedRefreshToken} save=${plantedRawSave}`,
    })
    const result = await bundle.export('/out/report.json', {})
    expect(result.status).toBe('exported')
    const bundleText = files.get('/out/report.json')!
    expect(bundleText).not.toContain(plantedRefreshToken)
    expect(bundleText).not.toContain(plantedRawSave)
    expect(bundleText).not.toContain('gold')
  })

  it('skips malformed lines on export instead of failing', async () => {
    const files = new Map<string, string>([
      [
        '/userData/diagnostics/events.ndjson',
        `${JSON.stringify({ ...EVENT, seq: 1, atUtc: '2026-09-30T00:00:00.000Z' })}\n{corrupt\n`,
      ],
    ])
    const bundle = makeBundle(files)
    const result = await bundle.export('/out/r.json', {})
    expect(result.status).toBe('exported')
    const parsed = JSON.parse(files.get('/out/r.json')!) as { events: unknown[] }
    expect(parsed.events.length).toBeGreaterThanOrEqual(1)
  })

  it('never throws when disk access is denied during export', async () => {
    const { fs } = makeFs({}, true)
    const bundle = new DiagnosticBundle({
      directory: '/userData/diagnostics',
      identity: IDENTITY,
      fs,
      randomId: () => 'fallback-id',
    })
    const result = await bundle.export('/out/report.json', {})
    expect(result.status).toBe('denied')
    if (result.status === 'denied') {
      expect(result.code).toBe('EACCES')
    }
    expect(result.reportId).toBe('fallback-id')
  })

  it('exports an empty bundle when no events exist yet', async () => {
    const files = new Map<string, string>()
    const bundle = makeBundle(files)
    const result = await bundle.export('/out/r.json', {})
    expect(result.status).toBe('exported')
    const parsed = JSON.parse(files.get('/out/r.json')!) as {
      manifest: DiagnosticBundleManifest
      events: unknown[]
    }
    expect(parsed.manifest.counts.events).toBe(1) // export-requested marker only
    expect(parsed.events).toHaveLength(1)
  })

  it('default bounds place maxEntries ceiling on bundle events', () => {
    expect(DEFAULT_DIAGNOSTIC_BOUNDS.maxBundleEvents).toBeLessThanOrEqual(
      DEFAULT_DIAGNOSTIC_BOUNDS.maxEntries,
    )
  })
})
