import { describe, expect, it } from 'vitest'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import { BUILD_IDENTITY, parseBuildIdentity } from './BuildIdentity'

const VALID = {
  productName: 'Tien Hiep Idle',
  appVersion: '0.1.0-beta.0',
  buildId: 'ci-run-1',
  gitSha: 'a'.repeat(40),
  saveSchemaVersion: 87,
  backendEnvironment: 'beta',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-29T12:00:00.000Z',
} as const

describe('BUILD_IDENTITY — the injected build identity', () => {
  it('resolves one frozen object carrying the canonical save schema', () => {
    expect(BUILD_IDENTITY.saveSchemaVersion).toBe(CURRENT_SAVE_VERSION)
    expect(Object.isFrozen(BUILD_IDENTITY)).toBe(true)
    expect(Object.keys(BUILD_IDENTITY).sort()).toEqual(
      [
        'appVersion',
        'backendEnvironment',
        'buildId',
        'builtAtUtc',
        'gitSha',
        'productName',
        'releaseChannel',
        'saveSchemaVersion',
      ].sort(),
    )
  })

  it('carries no out-of-contract data — secret sentinel rejected at the boundary', () => {
    // The injection surface can never smuggle extra fields: an injected blob
    // with a planted extra key must be rejected, not carried through.
    expect(() =>
      parseBuildIdentity({ ...VALID, leaked: 'planted-secret-value' }),
    ).toThrow()
    expect(JSON.stringify(BUILD_IDENTITY)).not.toContain('planted-secret-value')
  })
})

describe('parseBuildIdentity — shape validation at the injection boundary', () => {
  it('returns a frozen copy of a valid identity', () => {
    const parsed = parseBuildIdentity(VALID)
    expect(parsed).toEqual(VALID)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(parsed).not.toBe(VALID)
  })

  it.each([
    ['null', null],
    ['a string', 'v1'],
    ['missing gitSha', { ...VALID, gitSha: undefined }],
    ['empty productName', { ...VALID, productName: '' }],
    ['non-integer saveSchemaVersion', { ...VALID, saveSchemaVersion: 1.5 }],
    ['negative saveSchemaVersion', { ...VALID, saveSchemaVersion: -1 }],
    ['unknown backendEnvironment', { ...VALID, backendEnvironment: 'prod-like' }],
    ['unknown releaseChannel', { ...VALID, releaseChannel: 'nightly' }],
    ['unparseable builtAtUtc', { ...VALID, builtAtUtc: 'not a date' }],
    ['extra field', { ...VALID, extra: 'x' }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseBuildIdentity(value)).toThrow()
  })
})
