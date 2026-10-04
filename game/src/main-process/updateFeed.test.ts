// BETA-FINAL PR12 / spec B6 - the packaged feed manifest reader: parses
// the app-update.yml electron-builder emits and fails closed on anything
// that does not match the expected feed contract.
import { describe, expect, it } from 'vitest'
import { parsePackagedFeed, verifyPackagedFeed } from './updateFeed'
import { EXPECTED_UPDATE_FEED } from '../shared/update/UpdateState'

const GITHUB_YAML = [
  'provider: github',
  'owner: hnkm080596-svg',
  'repo: tutienidle',
  'channel: beta',
  'updaterCacheDirName: tien-hiep-idle-updater',
].join('\n')

describe('parsePackagedFeed', () => {
  it('parses the electron-builder github manifest', () => {
    const parsed = parsePackagedFeed(GITHUB_YAML)
    expect(parsed).toEqual({
      provider: 'github',
      owner: 'hnkm080596-svg',
      repo: 'tutienidle',
      channel: 'beta',
      publisherName: undefined,
    })
  })

  it('parses a generic provider with url and a publisherName list', () => {
    const parsed = parsePackagedFeed(
      [
        'provider: generic',
        'url: https://updates.example.com/beta',
        'channel: beta',
        'publisherName:',
        '  - Example, Inc.',
      ].join('\n'),
    )
    expect(parsed?.provider).toBe('generic')
    expect(parsed?.url).toBe('https://updates.example.com/beta')
    expect(parsed?.publisherName).toEqual(['Example, Inc.'])
  })

  it('returns null on malformed input', () => {
    expect(parsePackagedFeed('')).toBeNull()
    expect(parsePackagedFeed('provider:')).toBeNull()
    expect(parsePackagedFeed('provider: github\nowner: x\npublisherName:')).toBeNull()
    expect(parsePackagedFeed('  - orphan\nprovider: github')).toBeNull()
    expect(parsePackagedFeed('{{{{')).toBeNull()
  })
})

describe('verifyPackagedFeed', () => {
  it('accepts the expected github/beta feed', () => {
    const verdict = verifyPackagedFeed(parsePackagedFeed(GITHUB_YAML), EXPECTED_UPDATE_FEED)
    expect(verdict.status).toBe('ok')
  })

  it('rejects a missing manifest', () => {
    const verdict = verifyPackagedFeed(null, EXPECTED_UPDATE_FEED)
    expect(verdict).toMatchObject({ status: 'invalid', code: 'FEED_CONFIG_INVALID' })
  })

  it('rejects a foreign repo or provider (hijacked feed)', () => {
    const wrongRepo = verifyPackagedFeed(
      parsePackagedFeed('provider: github\nowner: attacker\nrepo: fake\nchannel: beta'),
      EXPECTED_UPDATE_FEED,
    )
    expect(wrongRepo).toMatchObject({ status: 'invalid', code: 'FEED_CONFIG_INVALID' })

    const wrongProvider = verifyPackagedFeed(
      parsePackagedFeed('provider: generic\nurl: https://updates.example.com\nchannel: beta'),
      EXPECTED_UPDATE_FEED,
    )
    expect(wrongProvider).toMatchObject({ status: 'invalid', code: 'FEED_CONFIG_INVALID' })
  })

  it('rejects the wrong channel', () => {
    const verdict = verifyPackagedFeed(
      parsePackagedFeed('provider: github\nowner: hnkm080596-svg\nrepo: tutienidle\nchannel: latest'),
      EXPECTED_UPDATE_FEED,
    )
    expect(verdict).toMatchObject({ status: 'invalid', code: 'WRONG_CHANNEL' })
  })

  it('rejects a packaged publisher while the pin is unset (EXT-02 pending)', () => {
    const verdict = verifyPackagedFeed(
      parsePackagedFeed(
        'provider: github\nowner: hnkm080596-svg\nrepo: tutienidle\nchannel: beta\npublisherName: Evil Corp',
      ),
      EXPECTED_UPDATE_FEED,
    )
    expect(verdict).toMatchObject({ status: 'invalid', code: 'PUBLISHER_MISMATCH' })
  })

  it('once pinned, requires the exact publisher CN', () => {
    const pinned = { ...EXPECTED_UPDATE_FEED, publisherName: 'Cognition AI, Inc.' }
    const match = verifyPackagedFeed(
      parsePackagedFeed(
        'provider: github\nowner: hnkm080596-svg\nrepo: tutienidle\nchannel: beta\npublisherName:\n  - Cognition AI, Inc.',
      ),
      pinned,
    )
    expect(match.status).toBe('ok')

    const wrong = verifyPackagedFeed(
      parsePackagedFeed(
        'provider: github\nowner: hnkm080596-svg\nrepo: tutienidle\nchannel: beta\npublisherName: Someone Else',
      ),
      pinned,
    )
    expect(wrong).toMatchObject({ status: 'invalid', code: 'PUBLISHER_MISMATCH' })
  })
})
