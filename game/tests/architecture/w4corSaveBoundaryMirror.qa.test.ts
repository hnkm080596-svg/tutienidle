// W4-COR pins (fixpoint-codex-w4-COR.md) - the client-side truth behind two
// wave-3 defects.
//
// W4-COR-1 (High): the SQL mirror's element-root block iterates
// `player.nodeLevels` via jsonb_each, which raises `cannot call jsonb_each
// on a non-object` on jsonb null/string/number/bool/array - an unhandled
// exception instead of the structured SAVE_INVALID that quarantines the
// record. These tests pin the client-side contract for that payload class:
// validateGameSaveShape rejects every non-object nodeLevels
// (saveShapeValidation.ts:1836), so the mirror's required behavior is a
// clean reject, never an exception. The contract-level repro lives in
// tests/integration/supabase/boundaryMirrorW4.spec.ts.
//
// W4-COR-3 (Medium): App.vue's live-replacement rejection calls
// saveIssue.report('corrupted', ...) but never enters the error route, so
// the corrupted-save surface (which only mounts inside
// entryStage === 'error', App.vue:1172-1188) is a dead write on that path,
// and it reports the normalized save instead of the remote raw bytes that
// every other callsite passes. The witnesses below fail until the live
// path reaches its surface with the authoritative payload.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { createDefaultPlayer } from '../../src/core/player/Player'

const APP_VUE_PATH = fileURLToPath(new URL('../../src/App.vue', import.meta.url))
const LIFECYCLE_PATH = fileURLToPath(
  new URL('../../src/composables/useAppLifecycle.ts', import.meta.url),
)

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('W4-COR-1 client truth: nodeLevels must be an object', () => {
  it.each([null, 'corrupt', 5, true, [1, 2], [{ a: 1 }]])(
    'rejects nodeLevels %j at the shape layer (the class the mirror must reject cleanly)',
    (nodeLevels) => {
      const save = validSave()
      ;(save.player as Record<string, unknown>).nodeLevels = nodeLevels
      const result = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
      expect(result.ok).toBe(false)
    },
  )

  it('accepts an object nodeLevels (control)', () => {
    const save = validSave()
    ;(save.player as Record<string, unknown>).nodeLevels = {}
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(true)
  })
})

describe('W4-COR-3: every saveIssue.report callsite must reach its surface', () => {
  // saveIssue.report is a dead write unless the same path enters the error
  // route (the only place SaveIncompatibleScreen mounts). The boot path
  // callsites in useAppLifecycle.ts are each followed by boot.fail(); the
  // live-path callsite in App.vue:673 currently is not followed by any
  // error-route entry - this witness fails until it gains one (e.g.
  // bootFlow.fail() or an equivalent entryStage drive).
  const REPORTER_FILES = [APP_VUE_PATH, LIFECYCLE_PATH]

  function callsitesLackingSurfaceEntry(file: string): number[] {
    const lines = readFileSync(file, 'utf-8').split('\n')
    const bad: number[] = []
    lines.forEach((line, i) => {
      if (!line.includes('saveIssue.report(')) return
      const tail = lines.slice(i, i + 10).join('\n')
      const reachesError =
        /boot(Flow)?\.fail\(/.test(tail) || /entryStage\s*=\s*'error'/.test(tail)
      if (!reachesError) bad.push(i + 1)
    })
    return bad
  }

  it('every saveIssue.report callsite is followed by an error-route entry', () => {
    const bad = REPORTER_FILES.flatMap((f) => callsitesLackingSurfaceEntry(f))
    expect(bad).toEqual([])
  })

  // The report's raw arg is exported as THE offending save bytes - every
  // other callsite passes the remote raw string (loaded.raw /
  // loaded.pendingRaw). The live path passes JSON.stringify(save) of the
  // normalized GameSave instead: the export affordance then yields
  // post-validation bytes, not the payload the server committed.
  it.fails('saveIssue.report receives the remote raw payload, not a re-serialization', () => {
    const bad: string[] = []
    for (const file of REPORTER_FILES) {
      const lines = readFileSync(file, 'utf-8').split('\n')
      lines.forEach((line, i) => {
        if (line.includes('saveIssue.report(') && /JSON\.stringify\(/.test(line)) {
          bad.push(`${file}:${i + 1}`)
        }
      })
    }
    expect(bad).toEqual([])
  })
})
