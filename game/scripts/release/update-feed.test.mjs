// Update feed parity test (BETA-FINAL PR12, spec B6).
// Run: node --test scripts/release/update-feed.test.mjs
//
// The packaged feed is declared TWICE and the two declarations must never
// drift:
//   1. electron-builder.yml `publish:` - what electron-builder writes into
//      resources/app-update.yml for the installed binary to read.
//   2. src/shared/update/UpdateState.ts EXPECTED_UPDATE_FEED - what the
//      main-process UpdateService verifies that packaged manifest against.
// This test asserts the yaml `publish:` block carries exactly the expected
// literals (github / hnkm080596-svg / tutienidle / beta, no token, no
// publisherName while EXT-02 signing is pending).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GAME_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')
const BUILDER_YML = path.join(GAME_ROOT, 'electron-builder.yml')

const EXPECTED = {
  provider: 'github',
  owner: 'hnkm080596-svg',
  repo: 'tutienidle',
  channel: 'beta',
}

/** Extract the top-level `publish:` block as an indented scalar map. The
 *  builder yaml's publish section is flat scalars only - anything richer
 *  fails loudly here rather than being silently ignored. */
function publishBlock(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^publish:\s*$/.test(l))
  assert.notStrictEqual(start, -1, 'electron-builder.yml must declare a top-level publish: block')
  const block = {}
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    if (!/^ {2}\S/.test(line)) break // dedented to a new top-level key
    const match = /^ {2}([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    assert.ok(match, `publish: line ${i + 1} is not a scalar mapping: ${JSON.stringify(line)}`)
    block[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return block
}

describe('electron-builder publish block', () => {
  it('declares exactly the EXPECTED_UPDATE_FEED literals', () => {
    const block = publishBlock(fs.readFileSync(BUILDER_YML, 'utf8'))
    assert.equal(block.provider, EXPECTED.provider)
    assert.equal(block.owner, EXPECTED.owner)
    assert.equal(block.repo, EXPECTED.repo)
    assert.equal(block.channel, EXPECTED.channel)
  })

  it('carries no repo token and no publisherName (EXT-02 pending)', () => {
    const block = publishBlock(fs.readFileSync(BUILDER_YML, 'utf8'))
    for (const key of Object.keys(block)) {
      assert.ok(
        !/token|secret|password/i.test(key),
        `publish block must not carry credential key ${key}`,
      )
      assert.ok(
        !/token|secret|password|ghp_|github_pat/i.test(block[key]),
        `publish.${key} must not contain a credential value`,
      )
    }
    assert.ok(!('publisherName' in block), 'publisherName stays unset until signing lands')
  })
})
