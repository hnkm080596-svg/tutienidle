// BETA-FINAL PR12 / spec B6 - the UpdateState contract: version
// comparison (semver precedence for beta-tagged builds) and the boundary
// parsers both ends of the wire depend on.
import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  expectedChannelTag,
  parseUpdateInstallResult,
  parseUpdateState,
  parseVersion,
} from './UpdateState'

describe('parseVersion / compareVersions', () => {
  it('parses stable and prerelease versions', () => {
    expect(parseVersion('0.1.0')).toEqual({ major: 0, minor: 1, patch: 0, prerelease: null })
    expect(parseVersion('0.1.0-beta.2')).toEqual({ major: 0, minor: 1, patch: 0, prerelease: ['beta', '2'] })
    expect(parseVersion('1.2.3-beta')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['beta'] })
  })

  it('rejects malformed versions', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion('v1.2.3')).toBeNull()
    expect(parseVersion('1.2.3-')).toBeNull()
    expect(parseVersion('not-a-version')).toBeNull()
    expect(parseVersion(42)).toBeNull()
  })

  it('orders numeric triples then prerelease precedence (stable > prerelease)', () => {
    const v = (s: string) => parseVersion(s)!
    expect(compareVersions(v('0.2.0-beta.0'), v('0.1.0-beta.9'))).toBeGreaterThan(0)
    expect(compareVersions(v('0.1.0-beta.2'), v('0.1.0-beta.10'))).toBeLessThan(0)
    expect(compareVersions(v('0.1.0-beta.2'), v('0.1.0-beta.2'))).toBe(0)
    // semver rule 11: a stable release outranks any prerelease of the same triple.
    expect(compareVersions(v('0.1.0'), v('0.1.0-beta.9'))).toBeGreaterThan(0)
    expect(compareVersions(v('0.1.0-beta'), v('0.1.0-beta.1'))).toBeLessThan(0)
    // numeric identifiers sort below alphanumeric.
    expect(compareVersions(v('0.1.0-1'), v('0.1.0-alpha'))).toBeLessThan(0)
  })

  it('the channel tag binding only exists for beta builds', () => {
    expect(expectedChannelTag('beta')).toBe('beta')
    expect(expectedChannelTag('development')).toBeNull()
  })
})

describe('parseUpdateState', () => {
  const base = {
    phase: 'available',
    currentVersion: '0.1.0-beta.0',
    currentBuildId: 'build-1',
    candidate: { version: '0.2.0-beta.0', channel: 'beta', releaseNotes: 'notes' },
  }

  it('accepts a well-formed projection and ignores unknown keys', () => {
    const parsed = parseUpdateState({ ...base, unexpected: 'x' })
    expect(parsed).not.toBeNull()
    expect(parsed!.phase).toBe('available')
    expect(parsed!.candidate?.version).toBe('0.2.0-beta.0')
    expect((parsed as unknown as Record<string, unknown>).unexpected).toBeUndefined()
  })

  it('accepts every phase and an error payload', () => {
    for (const phase of ['idle', 'checking', 'unavailable', 'downloading', 'downloaded', 'installing', 'unsupported']) {
      expect(parseUpdateState({ phase, currentVersion: '1.0.0-beta.0', currentBuildId: 'b' })?.phase).toBe(phase)
    }
    const withError = parseUpdateState({
      phase: 'error',
      currentVersion: '1.0.0-beta.0',
      currentBuildId: 'b',
      error: { code: 'DOWNLOAD_FAILED', message: 'oops', retryable: true },
    })
    expect(withError?.error).toEqual({ code: 'DOWNLOAD_FAILED', message: 'oops', retryable: true })
  })

  it('drops a half-valid projection whole', () => {
    expect(parseUpdateState({ ...base, phase: 'not-a-phase' })).toBeNull()
    expect(parseUpdateState({ ...base, currentVersion: 42 })).toBeNull()
    expect(parseUpdateState({ ...base, candidate: { version: '0.2.0-beta.0' } })).toBeNull()
    expect(parseUpdateState({ ...base, progress: { percent: 120, bytesPerSecond: 0, transferred: 0, total: 0 } })).toBeNull()
    expect(parseUpdateState({ ...base, error: { code: 'MADE_UP', message: 'x' } })).toBeNull()
    expect(parseUpdateState(null)).toBeNull()
    expect(parseUpdateState('available')).toBeNull()
  })
})

describe('parseUpdateInstallResult', () => {
  it('accepts the saved/blocked/failed FlushResult shapes', () => {
    expect(parseUpdateInstallResult({ status: 'saved', requestId: 'r', generation: 3, revision: 12 })).toEqual({
      status: 'saved',
      requestId: 'r',
      generation: 3,
      revision: 12,
    })
    expect(parseUpdateInstallResult({ status: 'blocked', requestId: 'r', generation: 3, code: 'SIGNED_OUT' })).toEqual({
      status: 'blocked',
      requestId: 'r',
      generation: 3,
      code: 'SIGNED_OUT',
    })
  })

  it('rejects malformed results', () => {
    expect(parseUpdateInstallResult({ status: 'saved', requestId: 'r', generation: 3 })).toBeNull()
    expect(parseUpdateInstallResult({ status: 'saved', requestId: 'r', generation: -1, revision: 1 })).toBeNull()
    expect(parseUpdateInstallResult({ status: 'pending', requestId: 'r', generation: 0 })).toBeNull()
    expect(parseUpdateInstallResult({ status: 'failed', requestId: 7, generation: 0 })).toBeNull()
    expect(parseUpdateInstallResult(null)).toBeNull()
    expect(parseUpdateInstallResult({ status: 'saved', requestId: 'r', generation: 3, revision: 'latest' })).toBeNull()
  })
})
