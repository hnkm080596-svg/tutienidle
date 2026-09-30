import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DIAGNOSTIC_BOUNDS,
  DIAGNOSTIC_CATEGORIES,
  DIAGNOSTIC_DETAIL_KEYS,
  DIAGNOSTIC_SEVERITIES,
  DIAGNOSTIC_SOURCES,
  redactDiagnosticText,
  validateDiagnosticEvent,
  type DiagnosticEventInput,
} from './DiagnosticEvent'

const VALID: DiagnosticEventInput = {
  source: 'renderer',
  severity: 'error',
  category: 'renderer-error',
  code: 'TEST_ERROR',
  message: 'boot failed',
}

describe('validateDiagnosticEvent', () => {
  it('accepts a minimal valid event', () => {
    const result = validateDiagnosticEvent(VALID)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event).toMatchObject(VALID)
    }
  })

  it('exposes the severity/category/source lists for schema symmetry', () => {
    expect(DIAGNOSTIC_SEVERITIES).toContain('fatal')
    expect(DIAGNOSTIC_CATEGORIES).toContain('quit-flush')
    expect(DIAGNOSTIC_SOURCES).toContain('main')
  })

  it.each([
    { source: 'hacked' },
    { severity: 'debug' },
    { category: 'telemetry' },
    { code: '' },
    { code: 'has space and password=hunter2' },
    { message: 42 },
    { severity: 'error', extra: 'freeform transport' } as never,
  ])('rejects invalid input %j', (patch) => {
    expect(validateDiagnosticEvent({ ...VALID, ...patch }).ok).toBe(false)
  })

  it('rejects a freeform transport payload (no allowlisted shape)', () => {
    expect(validateDiagnosticEvent({ raw: '{"a":1}', blob: 'x'.repeat(10) }).ok).toBe(false)
    expect(validateDiagnosticEvent('plain string').ok).toBe(false)
    expect(validateDiagnosticEvent(null).ok).toBe(false)
    expect(validateDiagnosticEvent(['severity', 'error']).ok).toBe(false)
  })

  it('rejects details keys outside the allowlist', () => {
    expect(
      validateDiagnosticEvent({ ...VALID, details: { body: 'full http body' } }).ok,
    ).toBe(false)
    expect(
      validateDiagnosticEvent({ ...VALID, details: { reason: 'pause' } }).ok,
    ).toBe(true)
    for (const key of DIAGNOSTIC_DETAIL_KEYS) {
      expect(
        validateDiagnosticEvent({ ...VALID, details: { [key]: 'v' } }).ok,
        `key ${key}`,
      ).toBe(true)
    }
  })

  it('rejects non-scalar detail values', () => {
    expect(
      validateDiagnosticEvent({ ...VALID, details: { reason: { nested: true } } }).ok,
    ).toBe(false)
    expect(
      validateDiagnosticEvent({ ...VALID, details: { reason: ['a'] } }).ok,
    ).toBe(false)
  })

  it('truncates overlong fields but keeps the event', () => {
    const result = validateDiagnosticEvent({
      ...VALID,
      message: 'm'.repeat(DEFAULT_DIAGNOSTIC_BOUNDS.maxMessageLength + 50),
      code: 'C'.repeat(DEFAULT_DIAGNOSTIC_BOUNDS.maxCodeLength + 5),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.message.length).toBeLessThanOrEqual(
      DEFAULT_DIAGNOSTIC_BOUNDS.maxMessageLength,
    )
    expect(result.event.code.length).toBeLessThanOrEqual(DEFAULT_DIAGNOSTIC_BOUNDS.maxCodeLength)
  })

  it('redacts planted credentials and payloads inside message/details', () => {
    const plantedJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dGVzdHNpZ25hdHVyZQ'
    const plantedRefreshToken = 'rt-planted-refresh-token-9f8e7d6c'
    const plantedRawSave = '{"saveVersion":87,"player":{"gold":42,"name":"Tester"}}'
    const result = validateDiagnosticEvent({
      ...VALID,
      message: `flush failed token=${plantedRefreshToken} auth=${plantedJwt} body=${plantedRawSave}`,
      details: { reason: `password=hunter2 ${plantedJwt}` },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const serialized = JSON.stringify(result.event)
    expect(serialized).not.toContain(plantedJwt)
    expect(serialized).not.toContain(plantedRefreshToken)
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain(plantedRawSave)
    expect(serialized).not.toContain('saveVersion')
  })

  it('strips URL query strings and file paths', () => {
    const result = validateDiagnosticEvent({
      ...VALID,
      message:
        'GET https://api.example.com/v1/saves?key=secret123&token=abc failed at /home/user/game/src/x.ts:12:3',
      route: '/game/settings?code=oauth-secret#frag',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.event.message).not.toContain('secret123')
    expect(result.event.message).not.toContain('/home/user')
    expect(result.event.message).toContain('<path>')
    expect(result.event.route).toBe('/game/settings')
  })
})

describe('redactDiagnosticText', () => {
  it('redacts a raw save payload wholesale (whole string, not partial leak)', () => {
    const plantedRawSave = '{"saveVersion":87,"player":{"gold":42},"inventory":["sword"]}'
    const out = redactDiagnosticText(`save content: ${plantedRawSave}`)
    expect(out).not.toContain('gold')
    expect(out).not.toContain('sword')
    expect(out).not.toContain('saveVersion')
  })

  it('redacts JWT/bearer/assignment forms and stack frames paths', () => {
    const stack =
      'Error: boom\n    at doThing (/home/u/app/src/a.ts:10:5)\n    at C:\\Users\\u\\app\\b.ts:2:1'
    const out = redactDiagnosticText(stack)
    expect(out).not.toContain('/home/u')
    expect(out).not.toContain('C:\\Users')
    expect(redactDiagnosticText('Authorization: Bearer abcdef1234567890')).not.toContain(
      'abcdef1234567890',
    )
    expect(redactDiagnosticText('refresh_token: rftok_abcdef')).not.toContain('rftok_abcdef')
  })
})
