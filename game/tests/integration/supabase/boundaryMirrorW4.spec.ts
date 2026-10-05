// W4-COR contract pins (docs/qa/fixpoint-codex-w4-COR.md).
//
// Runs against the real staging Supabase project via
// scripts/supabase/run-contract.mjs - same harness as authority.spec.ts.
// No skip=pass: missing infra throws and the suite fails nonzero.
//
// W4-COR-1: a `player.nodeLevels` that is jsonb null/string/number/array
// raises `cannot call jsonb_each on a non-object` inside
// _check_save_payload (202610050002:237) instead of returning the
// structured SAVE_INVALID the contract promises - the pending journal
// record then replays the same crashing payload forever (unavailable ->
// retry-same) instead of quarantining to the export/delete surface.
// These probes are marked test.fail() until the mirror type-guards
// nodeLevels.
//
// W4-COR-2: the create_character charset mirror `[[:alnum:] _-]` +
// Postgres trim() rejects names the client validator
// /^[\p{L}\p{N} _-]{2,20}$/u legitimately admits: No-category digits
// ('A½ B' - alnum under en_US.utf8 covers L*+Nd+Nl but not No) and any
// Unicode whitespace the JS trim strips but Postgres trim does not
// (NBSP, tab). The reject arrives as CHARACTER_NAME_UNAVAILABLE, which
// the client renders as "name taken".

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import {
  loadContractEnv,
  dbClient,
  rpc,
  createRegisteredUser,
  claimSession,
  provisionCharacter,
  buildSavePayload,
  loadState,
  writeSave,
  checkpointArg,
  type ContractEnv,
  type ServerCheckpoint,
} from './fixture'

test.describe.configure({ mode: 'serial' })

let env: ContractEnv
let pg: Client

const BUILD = 'contract-build-1'

test.beforeAll(async () => {
  env = loadContractEnv()
  pg = await dbClient(env)
  const phase = await pg.query(`select public.beta_contract_phase() as p`)
  expect(phase.rows[0].p, 'beta_contract_phase must be cutover').toBe('cutover')
})

test.afterAll(async () => {
  await pg.end()
})

async function authedUserWithCharacter() {
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  return { user, sid, character }
}

test('W4-COR-1: non-object nodeLevels must reject SAVE_INVALID, not throw', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint as ServerCheckpoint
  const base = buildSavePayload(character)

  // Control (passes today): a legal object nodeLevels carrying a
  // non-beta root claim exercises the intended reject path.
  const rootClaim = structuredClone(base)
  ;(rootClaim.player as Record<string, unknown>).nodeLevels = { thuy_linh_ngo: 1 }
  const wRoot = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: rootClaim,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wRoot.body.code).toBe('SAVE_INVALID')
  expect(wRoot.body.detail).toContain('non-beta element root')

  // The crash class: every non-object nodeLevels is invalid client-side
  // (saveShapeValidation.ts:1836) and must die as SAVE_INVALID. Today the
  // mirror raises an unhandled exception and the RPC errors out -
  // test.fail() pins the defect until the type-guard lands.
  for (const nodeLevels of [null, 'corrupt', 5, [1, 2]]) {
    test.fail()
    const bad = structuredClone(base)
    ;(bad.player as Record<string, unknown>).nodeLevels = nodeLevels
    const res = await writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 0, payload: bad,
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
    })
    expect(res.status, `nodeLevels ${JSON.stringify(nodeLevels)}`).toBe(200)
    expect(res.body.code).toBe('SAVE_INVALID')
  }
})

test('W4-COR-2: charset mirror accepts client-valid names', async () => {
  // Each create needs a fresh user - a second character on one user is
  // rejected CHARACTER_EXISTS before the name is ever checked.
  for (const name of ['A½ B', ' Minh ']) {
    test.fail()
    const user = await createRegisteredUser(env, pg)
    const sid = await claimSession(env, user.token, { buildId: BUILD })
    const roll = await rpc(env, user.token, 'create_talent_roll', { p_session_id: sid })
    expect(roll.status).toBe(200)
    const talentId = roll.body.talents?.[0]?.id
    const res = await rpc(env, user.token, 'create_character', {
      p_session_id: sid,
      p_roll_id: roll.body.rollId,
      p_name: name,
      p_talent_ids: [talentId],
      p_mortal_basic_skill_id: 'linh_bao',
    })
    expect(res.status).toBe(200)
    // 'A½ B' is client-legal (\p{N} covers No); ' Minh ' has NBSP padding
    // the JS trim strips. Both must create, or at minimum fail with a
    // charset-specific code - today they return CHARACTER_NAME_UNAVAILABLE
    // which the client renders as "name taken".
    expect(res.body.status).toBe('CREATED')
  }
})
