// BuildIdentity generator tests (BETA-FINAL PR1, spec B2).
// Run: node --test scripts/release/build-identity.test.mjs
// Covers: one frozen identity from canonical sources, fail-closed release
// input validation, and the secret-sentinel proof (no arbitrary env values
// can leak into the generated identity).
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  BuildIdentityError,
  checkArtifacts,
  collectIdentityInput,
  createBuildIdentity,
  readPackageVersion,
  readProductName,
  readSaveSchemaVersion,
} from './build-identity.mjs'

const FULL_SHA = 'a'.repeat(40)
const OTHER_SHA = 'b'.repeat(40)
const NOW = '2026-09-29T12:00:00.000Z'

function makeRoot({ version = '0.1.0-beta.0', schema = 87 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-identity-'))
  fs.mkdirSync(path.join(dir, 'src', 'services', 'save'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'tien-hiep-idle', version }, null, 2),
  )
  fs.writeFileSync(
    path.join(dir, 'electron-builder.yml'),
    'appId: com.tienhiepidle.app\nproductName: Tien Hiep Idle\n',
  )
  fs.writeFileSync(
    path.join(dir, 'src', 'services', 'save', 'saveVersion.ts'),
    `export const CURRENT_SAVE_VERSION = ${schema} as const\n`,
  )
  return dir
}

function execGiving(outputs) {
  // outputs: [ [argsPrefix[], stdout, errorToThrow?], ... ] matched in order.
  return (cmd, args) => {
    for (const [prefix, stdout, err] of outputs) {
      const head = args.slice(0, prefix.length)
      if (cmd === 'git' && prefix.every((p, i) => head[i] === p)) {
        if (err) throw err
        return stdout
      }
    }
    throw new Error(`unexpected exec: git ${args.join(' ')}`)
  }
}

const CLEAN_GIT = execGiving([
  [['rev-parse', 'HEAD'], FULL_SHA + '\n'],
  [['status', '--porcelain'], ''],
  [['describe', '--tags', '--exact-match', 'HEAD'], 'v0.1.0-beta.0\n'],
])

describe('canonical source readers', () => {
  it('reads package version, product name and CURRENT_SAVE_VERSION from disk', () => {
    const root = makeRoot({ version: '9.9.9-test.1', schema: 42 })
    assert.equal(readPackageVersion(root), '9.9.9-test.1')
    assert.equal(readProductName(root), 'Tien Hiep Idle')
    // 42 != the real CURRENT_SAVE_VERSION - proves the schema comes from the
    // canonical module content, never a second hard-coded constant.
    assert.equal(readSaveSchemaVersion(root), 42)
  })

  it('fails closed when saveVersion.ts stops exporting CURRENT_SAVE_VERSION', () => {
    const root = makeRoot()
    fs.writeFileSync(
      path.join(root, 'src', 'services', 'save', 'saveVersion.ts'),
      'export const SOMETHING_ELSE = 1\n',
    )
    assert.throws(() => readSaveSchemaVersion(root), BuildIdentityError)
  })
})

describe('createBuildIdentity - development mode', () => {
  const devInput = {
    mode: 'development',
    productName: 'Tien Hiep Idle',
    appVersion: '0.1.0-beta.0',
    saveSchemaVersion: 87,
    gitSha: FULL_SHA,
    backendEnvironment: 'development',
    releaseChannel: 'development',
    builtAtUtc: NOW,
  }

  it('returns one frozen identity with every field from the input', () => {
    const identity = createBuildIdentity(devInput)
    assert.equal(identity.productName, 'Tien Hiep Idle')
    assert.equal(identity.appVersion, '0.1.0-beta.0')
    assert.equal(identity.buildId, 'dev')
    assert.equal(identity.gitSha, FULL_SHA)
    assert.equal(identity.saveSchemaVersion, 87)
    assert.equal(identity.backendEnvironment, 'development')
    assert.equal(identity.releaseChannel, 'development')
    assert.equal(identity.builtAtUtc, NOW)
    assert.equal(Object.isFrozen(identity), true)
  })

  it('development identity is explicitly marked', () => {
    const identity = createBuildIdentity(devInput)
    assert.equal(identity.buildId, 'dev')
    assert.equal(identity.releaseChannel, 'development')
    assert.equal(identity.backendEnvironment, 'development')
  })

  it('rejects malformed fields even in development mode', () => {
    for (const patch of [
      { gitSha: 'not-a-sha' },
      { saveSchemaVersion: -1 },
      { saveSchemaVersion: 1.5 },
      { backendEnvironment: 'https://supabase.example' },
      { releaseChannel: 'nightly' },
      { builtAtUtc: 'not a date' },
      { productName: '' },
      { appVersion: '' },
    ]) {
      assert.throws(
        () => createBuildIdentity({ ...devInput, ...patch }),
        BuildIdentityError,
        JSON.stringify(patch),
      )
    }
  })
})

describe('createBuildIdentity - release mode fails closed', () => {
  const releaseInput = {
    mode: 'release',
    productName: 'Tien Hiep Idle',
    appVersion: '0.1.0-beta.0',
    saveSchemaVersion: 87,
    gitSha: FULL_SHA,
    buildId: 'ci-run-12345',
    backendEnvironment: 'beta',
    releaseChannel: 'beta',
    builtAtUtc: NOW,
    releaseTag: 'v0.1.0-beta.0',
    cleanTree: true,
  }

  it('accepts a complete, consistent release input', () => {
    const identity = createBuildIdentity(releaseInput)
    assert.equal(identity.buildId, 'ci-run-12345')
    assert.equal(identity.releaseChannel, 'beta')
    assert.equal(identity.gitSha, FULL_SHA)
    assert.equal(Object.isFrozen(identity), true)
  })

  it('rejects missing git SHA before any build output', () => {
    assert.throws(
      () => createBuildIdentity({ ...releaseInput, gitSha: null }),
      BuildIdentityError,
    )
  })

  it('rejects version 0.0.0 in release mode', () => {
    assert.throws(
      () =>
        createBuildIdentity({
          ...releaseInput,
          appVersion: '0.0.0',
          releaseTag: 'v0.0.0',
        }),
      BuildIdentityError,
    )
  })

  it('rejects a tag that does not match the package version', () => {
    assert.throws(
      () => createBuildIdentity({ ...releaseInput, releaseTag: 'v9.9.9' }),
      BuildIdentityError,
    )
    assert.throws(
      () => createBuildIdentity({ ...releaseInput, releaseTag: null }),
      BuildIdentityError,
    )
  })

  it('rejects a dirty working tree', () => {
    assert.throws(
      () => createBuildIdentity({ ...releaseInput, cleanTree: false }),
      BuildIdentityError,
    )
  })

  it('rejects a missing CI build id', () => {
    assert.throws(
      () => createBuildIdentity({ ...releaseInput, buildId: '' }),
      BuildIdentityError,
    )
  })

  it('rejects development backend for a release build', () => {
    assert.throws(
      () =>
        createBuildIdentity({ ...releaseInput, backendEnvironment: 'development' }),
      BuildIdentityError,
    )
  })

  it('rejects non-semantic versions in release mode', () => {
    assert.throws(
      () =>
        createBuildIdentity({
          ...releaseInput,
          appVersion: 'next',
          releaseTag: 'vnext',
        }),
      BuildIdentityError,
    )
  })
})

describe('collectIdentityInput - allowlisted env only', () => {
  it('never serializes arbitrary environment values (secret sentinel)', () => {
    const root = makeRoot()
    const env = {
      RELEASE_CHANNEL: 'development',
      SUPABASE_SERVICE_KEY: 'planted-secret-value',
      AWS_SECRET_ACCESS_KEY: 'planted-secret-value',
      npm_config__secret: 'planted-secret-value',
    }
    const input = collectIdentityInput({ rootDir: root, env, exec: CLEAN_GIT })
    const identity = createBuildIdentity(input)
    const serialized = JSON.stringify(identity) + JSON.stringify(input)
    assert.equal(serialized.includes('planted-secret-value'), false)
    // No env key names may be carried into the identity object at all.
    for (const key of Object.keys(env)) {
      assert.equal(key in identity, false)
    }
  })

  it('reads git metadata through the injected exec, not the ambient repo', () => {
    const root = makeRoot()
    const input = collectIdentityInput({
      rootDir: root,
      env: {},
      exec: execGiving([
        [['rev-parse', 'HEAD'], OTHER_SHA + '\n'],
        [['describe', '--tags', '--exact-match', 'HEAD'], 'v0.1.0-beta.0\n'],
      ]),
    })
    assert.equal(input.gitSha, OTHER_SHA)
  })

  it('release mode comes from RELEASE_CHANNEL=beta and pulls CI fields', () => {
    const root = makeRoot({ version: '0.1.0-beta.1' })
    const input = collectIdentityInput({
      rootDir: root,
      env: {
        RELEASE_CHANNEL: 'beta',
        BACKEND_ENVIRONMENT: 'beta',
        BUILD_ID: 'ci-run-777',
        GIT_TAG: 'v0.1.0-beta.1',
        GITHUB_SHA: FULL_SHA,
      },
      exec: execGiving([[['status', '--porcelain'], '']]),
    })
    assert.equal(input.mode, 'release')
    assert.equal(input.buildId, 'ci-run-777')
    assert.equal(input.releaseTag, 'v0.1.0-beta.1')
    assert.equal(input.gitSha, FULL_SHA)
    const identity = createBuildIdentity(input)
    assert.equal(identity.releaseChannel, 'beta')
  })

  it('falls back to GITHUB_RUN_ID for the release build id', () => {
    const input = collectIdentityInput({
      rootDir: makeRoot(),
      env: {
        RELEASE_CHANNEL: 'beta',
        BACKEND_ENVIRONMENT: 'beta',
        GITHUB_RUN_ID: '990011',
        GIT_TAG: 'v0.1.0-beta.0',
        GITHUB_SHA: FULL_SHA,
      },
      exec: execGiving([[['status', '--porcelain'], '']]),
    })
    assert.equal(input.buildId, '990011')
  })

  it("falls back to 'unknown' when git rev-parse fails (no repo)", () => {
    const input = collectIdentityInput({
      rootDir: makeRoot(),
      env: {},
      exec: () => {
        throw new Error('not a git repository')
      },
    })
    assert.equal(input.gitSha, 'unknown')
  })

  it('marks a dirty tree as dirty instead of hiding it', () => {
    const input = collectIdentityInput({
      rootDir: makeRoot(),
      env: {
        RELEASE_CHANNEL: 'beta',
        BACKEND_ENVIRONMENT: 'beta',
        BUILD_ID: 'x',
        GIT_TAG: 'v0.1.0-beta.0',
        GITHUB_SHA: FULL_SHA,
      },
      exec: execGiving([[['status', '--porcelain'], ' M src/App.vue\n']]),
    })
    assert.equal(input.cleanTree, false)
    assert.throws(() => createBuildIdentity(input), BuildIdentityError)
  })
})

describe('checkArtifacts - release artifact agreement', () => {
  const manifest = {
    productName: 'Tien Hiep Idle',
    appVersion: '0.1.0-beta.0',
    buildId: 'ci-run-12345',
    gitSha: FULL_SHA,
    saveSchemaVersion: 87,
    backendEnvironment: 'beta',
    releaseChannel: 'beta',
    builtAtUtc: NOW,
  }

  function writeArtifacts(root, { renderer, main, mainManifest } = {}) {
    const dist = path.join(root, 'dist', 'assets')
    fs.mkdirSync(dist, { recursive: true })
    fs.writeFileSync(
      path.join(root, 'dist', 'build-identity.json'),
      JSON.stringify(manifest, null, 2),
    )
    fs.writeFileSync(path.join(dist, 'index.js'), renderer ?? '')
    if (main !== undefined || mainManifest !== undefined) {
      const distElectron = path.join(root, 'dist-electron')
      fs.mkdirSync(distElectron, { recursive: true })
      fs.writeFileSync(path.join(distElectron, 'main.js'), main ?? '')
      if (mainManifest !== undefined) {
        fs.writeFileSync(
          path.join(distElectron, 'build-identity.json'),
          JSON.stringify(mainManifest, null, 2),
        )
      }
    }
  }

  // What rolldown actually emits: unquoted keys, backtick string values.
  const MINIFIED = `{productName:\`Tien Hiep Idle\`,appVersion:\`0.1.0-beta.0\`,` +
    `buildId:\`ci-run-12345\`,gitSha:\`${FULL_SHA}\`,saveSchemaVersion:87,` +
    `backendEnvironment:\`beta\`,releaseChannel:\`beta\`,builtAtUtc:\`${NOW}\`}`
  const JSON_STYLE = JSON.stringify(manifest)

  it('accepts a renderer+main pair carrying the manifest in minified spelling', () => {
    const root = makeRoot()
    writeArtifacts(root, { renderer: MINIFIED, main: MINIFIED, mainManifest: manifest })
    assert.deepEqual(checkArtifacts(root), [])
  })

  it('accepts the JSON-style spelling too', () => {
    const root = makeRoot()
    writeArtifacts(root, { renderer: JSON_STYLE, main: JSON_STYLE, mainManifest: manifest })
    assert.deepEqual(checkArtifacts(root), [])
  })

  it('flags a renderer bundle missing one identity field', () => {
    const root = makeRoot()
    const noSha = MINIFIED.replace(`gitSha:\`${FULL_SHA}\`,`, '')
    writeArtifacts(root, { renderer: noSha })
    const problems = checkArtifacts(root)
    assert.ok(problems.some((p) => p.includes('gitSha')))
  })

  it('flags a dist-electron manifest that disagrees with dist/', () => {
    const root = makeRoot()
    writeArtifacts(root, {
      renderer: MINIFIED,
      main: MINIFIED,
      mainManifest: { ...manifest, buildId: 'ci-run-999' },
    })
    const problems = checkArtifacts(root)
    assert.ok(problems.some((p) => p.includes('differs')))
  })

  it('flags a missing manifest and missing bundles', () => {
    const root = makeRoot()
    const problems = checkArtifacts(root)
    assert.ok(problems.some((p) => p.includes('missing or unreadable manifest')))
    assert.ok(problems.some((p) => p.includes('no built JS bundles')))
  })

  it('tolerates a web-only build with no dist-electron directory', () => {
    const root = makeRoot()
    writeArtifacts(root, { renderer: MINIFIED })
    assert.deepEqual(checkArtifacts(root), [])
  })
})
