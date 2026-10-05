// W4-AUT-1: reset_character must make a corrupt-row account recoverable -
// delete the character row (cascades saves/checkpoints/receipts), after
// which load_game_state reports NO_CHARACTER and a fresh create_character
// succeeds on the same user.

import { test, expect } from '@playwright/test'
import {
  loadContractEnv,
  dbClient,
  rpc,
  createRegisteredUser,
  uniqueName,
  claimSession,
  provisionCharacter,
  buildSavePayload,
  writeSave,
  checkpointArg,
  loadState,
} from './fixture'

const BUILD = 'w4-aut-reset'

test.describe.configure({ mode: 'serial' })

test('reset_character deletes and unblocks fresh creation', async () => {
  const env = loadContractEnv()
  const pg = await dbClient(env)
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const name = uniqueName('R')
  const character = await provisionCharacter(env, user.token, sid, name)
  expect(character.id).toBeTruthy()

  // Commit one real save so the deletion covers a row with history.
  const ls = await loadState(env, user.token, sid)
  const base = buildSavePayload(character)
  const w = await writeSave(env, user.token, {
    sessionId: sid,
    expectedRevision: 0,
    payload: base,
    mutationId: crypto.randomUUID(),
    timeCheckpoint: checkpointArg(ls.serverCheckpoint, 10),
    buildId: BUILD,
  })
  expect(w.body.code).toBeUndefined()

  const reset = await rpc(env, user.token, 'reset_character', { p_session_id: sid })
  expect(reset.status).toBe(200)
  expect(reset.body.status).toBe('DELETED')

  // The row is gone: the load path reports no character (client routes to
  // creation on 'empty').
  const after = await loadState(env, user.token, sid)
  expect(after.status).toBe('NO_CHARACTER')

  // The deleted row must not block fresh creation (deleted_at filter).
  const roll2 = await rpc(env, user.token, 'create_talent_roll', { p_session_id: sid })
  expect(roll2.status).toBe(200)
  const talentId2 = roll2.body.talents?.[0]?.id
  const recreated = await rpc(env, user.token, 'create_character', {
    p_session_id: sid,
    p_roll_id: roll2.body.rollId,
    p_name: uniqueName('R2'),
    p_talent_ids: [talentId2],
    p_mortal_basic_skill_id: 'linh_bao',
  })
  expect(recreated.status).toBe(200)
  expect(recreated.body.status).toBe('CREATED')

  await pg.end()
})

test('W6-COR-1: a tombstoned account can create_character (absorb, not unique_violation)', async () => {
  // characters.user_id is UNIQUE over ALL rows - a tombstone-only account
  // used to pass the existence gates then crash on the constraint at
  // INSERT (unique_violation -> opaque server error, unrecoverable wedge).
  // create_character now absorbs the tombstone before inserting.
  const env = loadContractEnv()
  const pg = await dbClient(env)
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid, uniqueName('T'))
  expect(character.id).toBeTruthy()

  // Fabricate the tombstone the deleted-at design leaves behind.
  await pg.query(
    `update public.characters set deleted_at = now() where id = $1`,
    [character.id],
  )
  const tombstoned = await loadState(env, user.token, sid)
  expect(tombstoned.status).toBe('CHARACTER_DELETED')

  const roll = await rpc(env, user.token, 'create_talent_roll', { p_session_id: sid })
  expect(roll.status).toBe(200)
  const talentId = roll.body.talents?.[0]?.id
  const recreated = await rpc(env, user.token, 'create_character', {
    p_session_id: sid,
    p_roll_id: roll.body.rollId,
    p_name: uniqueName('T2'),
    p_talent_ids: [talentId],
    p_mortal_basic_skill_id: 'linh_bao',
  })
  expect(recreated.status).toBe(200)
  expect(recreated.body.status).toBe('CREATED')

  // Exactly one row exists for the user - the tombstone was absorbed,
  // not shadowed (user_id UNIQUE makes coexistence impossible).
  const { rows } = await pg.query(
    `select count(*)::int as n from public.characters where user_id = $1`,
    [user.userId],
  )
  expect(rows[0].n).toBe(1)

  await pg.end()
})

test('reset_character on a characterless user returns NO_CHARACTER', async () => {
  const env = loadContractEnv()
  const pg = await dbClient(env)
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const reset = await rpc(env, user.token, 'reset_character', { p_session_id: sid })
  expect(reset.status).toBe(200)
  expect(reset.body.status).toBe('NO_CHARACTER')
  await pg.end()
})
