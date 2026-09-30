// Signing preflight tests (BETA-FINAL PR9, spec B4).
// Run: node --test scripts/release/signing-preflight.test.mjs
// Covers: unsigned dev state is clean, missing credentials block a release,
// PR/fork contexts never keep signing credentials, redaction of secret
// values at capture time, azure/signtool ambiguity, and the pinned
// electron-builder signing knobs (sha256 + RFC3161).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  captureEnv,
  detectContext,
  detectCredentialSources,
  readBuilderSigningConfig,
  signingPreflight,
} from './signing-preflight.mjs'

const GAME_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REAL_YML = fs.readFileSync(path.join(GAME_ROOT, 'electron-builder.yml'), 'utf8')

// Pinned signtool knobs the beta contract requires.
const GOOD_YML = `
win:
  signtoolOptions:
    signingHashAlgorithms:
      - sha256
    rfc3161TimeStampServer: http://timestamp.digicert.com
`

const CI_PUSH = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' }
const PR_CONTEXT = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }
const PFX_CREDS = { WIN_CSC_LINK: 'BASE64-PFX-SECRET==', WIN_CSC_KEY_PASSWORD: 'hunter2' }

const run = (env, opts = {}) =>
  signingPreflight({ env, builderConfigText: GOOD_YML, ...opts })

const allText = (report) =>
  JSON.stringify(report) + '\n' + report.problems.join('\n')

describe('captureEnv redaction', () => {
  it('records presence only - never a credential value', () => {
    const env = {
      WIN_CSC_LINK: 'BASE64-PFX-SECRET==',
      WIN_CSC_KEY_PASSWORD: 'hunter2',
      CSC_LINK: 'https://secrets.internal/cert.pfx?sig=abc',
      CSC_KEY_PASSWORD: 'p@ssw0rd!',
      AZURE_CLIENT_SECRET: 'AZ-SECRET-123',
      UNRELATED_SECRET: 'not-allowlisted-anyway',
    }
    const captured = captureEnv(env)
    const text = JSON.stringify(captured)
    for (const secret of Object.values(env)) {
      assert.ok(!text.includes(secret), `leaked value for a captured env var`)
    }
    assert.equal(captured.WIN_CSC_LINK, '<redacted>')
    assert.equal(captured.AZURE_CLIENT_SECRET, '<redacted>')
    // non-allowlisted vars are invisible entirely
    assert.ok(!('UNRELATED_SECRET' in captured))
  })

  it('empty and whitespace-free empty values count as absent', () => {
    assert.equal(captureEnv({ WIN_CSC_LINK: '' }).WIN_CSC_LINK, undefined)
  })
})

describe('credential source detection', () => {
  it('WIN_CSC_LINK alone is complete (password optional, empty-password fallback)', () => {
    const sources = detectCredentialSources(captureEnv({ WIN_CSC_LINK: 'x' }))
    const s = sources.find((s) => s.source === 'WIN_CSC_LINK')
    assert.equal(s.complete, true)
    assert.equal(s.partial, false)
  })

  it('a password without its link is an incomplete misconfiguration', () => {
    const sources = detectCredentialSources(captureEnv({ CSC_KEY_PASSWORD: 'x' }))
    const s = sources.find((s) => s.source === 'CSC_LINK')
    assert.equal(s.partial, true)
    assert.deepEqual(s.missing, ['CSC_LINK'])
  })

  it('azure needs tenant + client + one auth mechanism', () => {
    const partial = detectCredentialSources(
      captureEnv({ AZURE_TENANT_ID: 't', AZURE_CLIENT_ID: 'c' }),
    ).find((s) => s.source === 'AZURE_TRUSTED_SIGNING')
    assert.equal(partial.complete, false)
    assert.equal(partial.partial, true)

    const full = detectCredentialSources(
      captureEnv({
        AZURE_TENANT_ID: 't',
        AZURE_CLIENT_ID: 'c',
        AZURE_FEDERATED_TOKEN_FILE: 'f',
      }),
    ).find((s) => s.source === 'AZURE_TRUSTED_SIGNING')
    assert.equal(full.complete, true)
  })
})

describe('context detection', () => {
  it('pull_request and pull_request_target are both untrusted', () => {
    assert.equal(detectContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' }).untrusted, true)
    assert.equal(detectContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request_target' }).untrusted, true)
  })

  it('push / workflow_dispatch / release are trusted', () => {
    for (const e of ['push', 'workflow_dispatch', 'release', 'schedule']) {
      assert.equal(detectContext({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: e }).untrusted, false, e)
    }
  })

  it('a PR head ref without an event name is untrusted', () => {
    assert.equal(detectContext({ GITHUB_ACTIONS: 'true', GITHUB_HEAD_REF: 'feature/x' }).untrusted, true)
  })

  it('non-CI local context is not untrusted', () => {
    const c = detectContext({})
    assert.equal(c.ci, false)
    assert.equal(c.untrusted, false)
  })
})

describe('unsigned plumbing state (EXT-02 unresolved)', () => {
  it('local dev with no credentials is a clean unsigned build', () => {
    const report = run({})
    assert.equal(report.verdict, 'unsigned-ok')
    assert.deepEqual(report.problems, [])
  })

  it('unsigned CI build is clean too', () => {
    const report = run({ ...CI_PUSH })
    assert.equal(report.verdict, 'unsigned-ok')
  })

  it('--require-signing refuses a release without any credential source', () => {
    const report = run({ ...CI_PUSH }, { requireSigning: true })
    assert.equal(report.verdict, 'blocked')
    assert.ok(report.problems.some((p) => p.includes('EXT-02')))
  })
})

describe('trusted signing context', () => {
  it('complete WIN_CSC_LINK credentials on push -> signing-ready', () => {
    const report = run({ ...CI_PUSH, ...PFX_CREDS })
    assert.equal(report.verdict, 'signing-ready')
    assert.deepEqual(report.problems, [])
  })

  it('a commit-visible certificate field in yml counts as a service identity source', () => {
    const yml = GOOD_YML + '    certificateSha1: "A1B2C3"\n'
    const report = signingPreflight({ env: CI_PUSH, builderConfigText: yml })
    assert.equal(report.verdict, 'signing-ready')
  })
})

describe('untrusted contexts never keep credentials', () => {
  it('PR context + complete credentials -> blocked', () => {
    const report = run({ ...PR_CONTEXT, ...PFX_CREDS })
    assert.equal(report.verdict, 'blocked')
    assert.ok(report.problems.some((p) => p.includes('untrusted context')))
  })

  it('pull_request_target + credentials -> blocked', () => {
    const report = run({
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'pull_request_target',
      ...PFX_CREDS,
    })
    assert.equal(report.verdict, 'blocked')
  })

  it('PR context + no credentials stays a clean unsigned build', () => {
    const report = run({ ...PR_CONTEXT })
    assert.equal(report.verdict, 'unsigned-ok')
  })

  it('--require-signing in a PR context refuses even with credentials', () => {
    const report = run({ ...PR_CONTEXT, ...PFX_CREDS }, { requireSigning: true })
    assert.equal(report.verdict, 'blocked')
  })
})

describe('builder config contract', () => {
  it('signing credentials + missing sha256 pin is a problem', () => {
    const bare = 'win:\n  target: nsis\n'
    const report = signingPreflight({ env: { ...CI_PUSH, ...PFX_CREDS }, builderConfigText: bare })
    assert.ok(report.problems.some((p) => p.includes('signingHashAlgorithms')))
  })

  it('signing credentials + missing RFC3161 timestamp server is a problem', () => {
    const noTs = 'win:\n  signtoolOptions:\n    signingHashAlgorithms: [sha256]\n'
    const report = signingPreflight({ env: { ...CI_PUSH, ...PFX_CREDS }, builderConfigText: noTs })
    assert.ok(report.problems.some((p) => p.includes('rfc3161TimeStampServer')))
  })

  it('inline [sha256] list form parses the same as a block list', () => {
    const report = signingPreflight({ env: { ...CI_PUSH, ...PFX_CREDS }, builderConfigText: 'win:\n  signtoolOptions:\n    signingHashAlgorithms: [sha256]\n    rfc3161TimeStampServer: http://timestamp.digicert.com\n' })
    assert.deepEqual(report.problems, [])
  })

  it('committed cscLink / certificatePassword is a credential violation', () => {
    const bad = GOOD_YML + '    certificatePassword: "secret-pw"\nwin2:\n'
    const withPassword = signingPreflight({ env: {}, builderConfigText: bad })
    assert.ok(withPassword.problems.some((p) => p.includes('certificatePassword')))

    const badLink = 'win:\n  cscLink: ./cert/dev.pfx\n'
    const report = signingPreflight({ env: {}, builderConfigText: badLink })
    assert.ok(report.problems.some((p) => p.includes('cscLink')))
  })

  it('a custom sign hook is rejected for the beta path', () => {
    const yml = GOOD_YML + '    sign: ./scripts/custom-sign.mjs\n'
    const report = signingPreflight({ env: {}, builderConfigText: yml })
    assert.ok(report.problems.some((p) => p.includes('custom sign hook')))
  })
})

describe('azure trusted signing', () => {
  const AZURE_CREDS = {
    AZURE_TENANT_ID: 'tenant',
    AZURE_CLIENT_ID: 'client',
    AZURE_CLIENT_SECRET: 'azure-secret-value',
  }

  it('azureSignOptions + complete env -> signing-ready', () => {
    const yml = GOOD_YML + '  azureSignOptions:\n    endpoint: https://eus.codesigning.azure.net\n    certificateProfileName: beta\n    codeSigningAccountName: acct\n    publisherName: pub\n'
    const report = signingPreflight({ env: { ...CI_PUSH, ...AZURE_CREDS }, builderConfigText: yml })
    assert.equal(report.verdict, 'signing-ready')
  })

  it('azureSignOptions without env credentials is a hard misconfiguration', () => {
    const yml = GOOD_YML + '  azureSignOptions:\n    endpoint: https://x\n'
    const report = signingPreflight({ env: CI_PUSH, builderConfigText: yml })
    assert.ok(report.problems.some((p) => p.includes('azureSignOptions')))
  })

  it('azureSignOptions + signtool creds both present is ambiguous -> blocked', () => {
    const yml = GOOD_YML + '  azureSignOptions:\n    endpoint: https://x\n'
    const report = signingPreflight({ env: { ...CI_PUSH, ...AZURE_CREDS, ...PFX_CREDS }, builderConfigText: yml })
    assert.ok(report.problems.some((p) => p.includes('ambiguous')))
  })
})

describe('redaction end to end', () => {
  const secrets = ['BASE64-PFX-SECRET==', 'hunter2', 'azure-secret-value', 'sk-cert-url-token']

  it('no credential value ever appears in the report or problems', () => {
    const env = {
      ...CI_PUSH,
      WIN_CSC_LINK: secrets[0],
      WIN_CSC_KEY_PASSWORD: secrets[1],
      AZURE_TENANT_ID: 'tenant',
      AZURE_CLIENT_ID: 'client',
      AZURE_CLIENT_SECRET: secrets[2],
      CSC_LINK: secrets[3],
    }
    const report = run(env)
    const text = allText(report)
    for (const s of secrets) {
      assert.ok(!text.includes(s), `secret leaked into report: ${s.slice(0, 4)}...`)
    }
    assert.equal(report.verdict, 'signing-ready')
  })

  it('failure reports stay redacted too', () => {
    const env = {
      ...PR_CONTEXT,
      CSC_LINK: secrets[3],
      CSC_KEY_PASSWORD: secrets[1],
    }
    const report = run(env, { requireSigning: true })
    const text = allText(report)
    for (const s of secrets) {
      assert.ok(!text.includes(s))
    }
    assert.equal(report.verdict, 'blocked')
  })
})

describe('real electron-builder.yml', () => {
  it('current repo config stays a clean unsigned build without credentials', () => {
    const report = signingPreflight({ env: {}, builderConfigText: REAL_YML })
    assert.equal(report.verdict, 'unsigned-ok')
    assert.deepEqual(report.problems, [])
  })

  it('current repo config + credentials -> signing-ready (config pins present)', () => {
    const report = signingPreflight({ env: { ...CI_PUSH, ...PFX_CREDS }, builderConfigText: REAL_YML })
    assert.deepEqual(report.problems, [])
    assert.equal(report.verdict, 'signing-ready')
  })
})
