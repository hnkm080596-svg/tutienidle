// BETA-FINAL B1-F (PR7) coordinated-cutover compatibility matrix +
// production-like adversarial proof, on the real staging project.
//
// Two layers:
//   1. matrix: cells - every (schema phase x client era) pair as an executable
//      spec. Cells whose phase the project has already passed honest-skip
//      with a recorded reason (test.skip is visible, never a silent pass);
//      the cutover cells execute live.
//   2. adversarial cells - the two-device / forged-input / crash-replay /
//      refresh / clock-skew / first-save attacks the plan's B1-F checklist
//      requires. Ordinary authenticated JWTs are the only attack principals;
//      the operator pg connection only seeds/asserts, never acts as a client.
//
// Env gate identical to authority.spec.ts: missing infra throws nonzero.
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { Client } from 'pg'
import {
  loadContractEnv,
  dbClient,
  rpc,
  rest,
  createAnonymousUser,
  createRegisteredUser,
  signupAnonymousWithRefresh,
  confirmEmailIdentity,
  claimSession,
  provisionCharacter,
  buildSavePayload,
  loadState,
  writeSave,
  checkpointArg,
  saveRow,
  receiptRows,
  mutationReceiptCount,
  activeSessionCount,
  sqlAsUser,
  uniqueName,
  type ContractEnv,
} from './fixture'
import {
  journalHarness,
  retrySameMutationAfterLostAck,
  readServerRevision,
  integrationGameSave,
  asRpcPayload,
} from './journal-harness'
import { buildPendingSaveRecord } from '../../../src/services/cloudSave/PendingSaveJournal'
import type { ClientBuildInfo } from '../../../src/services/backend/ClientBuildInfo'

test.describe.configure({ mode: 'serial' })

let env: ContractEnv
let pg: Client
let phase: string

const BUILD = 'contract-build-1'
const CONTRACT_BUILD: ClientBuildInfo = {
  buildId: BUILD,
  appVersion: '0.0.0',
  releaseChannel: 'beta',
  saveSchemaVersion: 87,
}

async function authedUserWithCharacter(kind: 'anonymous' | 'registered' = 'registered') {
  const user = kind === 'registered' ? await createRegisteredUser(env, pg) : await createAnonymousUser(env)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  return { user, sid, character }
}

async function currentPhase(): Promise<string> {
  const hasFn = await pg.query(`select to_regprocedure('public.beta_contract_phase()') as f`)
  if (!hasFn.rows[0].f) return 'legacy'
  const r = await pg.query(`select public.beta_contract_phase() as p`)
  return r.rows[0].p as string
}

test.beforeAll(async () => {
  env = loadContractEnv()
  pg = await dbClient(env)
  phase = await currentPhase()
})

// Every cell below that requires the cutover surface honest-skips with a
// recorded reason on a project still in an earlier phase - the suite stays
// truthful when run mid-migration (runbook step 5 re-runs it post-apply).
const requireCutover = () =>
  test.skip(
    phase !== 'cutover',
    `project phase is '${phase}' - this cell requires the cutover schema`,
  )

test.afterAll(async () => {
  await pg.end()
})

// ---------------------------------------------------------------------------
// Matrix cells: schema phase x client era (runbook table in
// docs/operations/beta/backend-cutover.md). Cells for phases the project has
// already passed are recorded as visible skips - the contract runner's
// phase-driven probes covered them at first apply; they re-execute whenever
// this suite runs against a project that still sits in that phase.
// ---------------------------------------------------------------------------

test('matrix [legacy x legacy client]: direct writes, 1-arg claim and fabricated {} saves all work', async () => {
  test.skip(
    phase !== 'legacy',
    `project phase is '${phase}' - legacy surface already retired; proven at first apply by run-contract.mjs legacy probes`,
  )
  const user = await createRegisteredUser(env, pg)
  await sqlAsUser(pg, user.userId, 'authenticated', async () => {
    // the retired 1-arg overload mints a session
    const claim = await pg.query(`select public.claim_active_session('legacy-client') as sid`)
    const sid = claim.rows[0].sid as string
    expect(sid).toBeTruthy()
    const roll = await pg.query(`select public.create_talent_roll($1) as r`, [sid])
    const rollId = roll.rows[0].r.rollId
    const talentId = roll.rows[0].r.talents[0].id
    // the retired 7-arg overload fabricates a {} save row at creation
    const created = await pg.query(
      `select public.create_character($1::uuid,$2::uuid,$3::text,array[$4::text],'tram','{}'::jsonb,87) as cid`,
      [sid, rollId, uniqueName('L'), talentId],
    )
    const cid = created.rows[0].cid as string
    const row = await pg.query(`select payload from public.character_saves where character_id = $1`, [cid])
    expect(JSON.stringify(row.rows[0].payload)).toBe('{}')
    // direct table mutation is the normal write path
    const direct = await pg.query(
      `update public.character_saves set payload = '{"direct":true}'::jsonb where character_id = $1 returning character_id`,
      [cid],
    )
    expect(direct.rows[0].character_id).toBe(cid)
  })
})

test('matrix [prepare x legacy client]: the dual window keeps every legacy path working', async () => {
  test.skip(
    phase !== 'prepare',
    `project phase is '${phase}' - the dual window was probed at first apply by run-contract.mjs (legacy probes + dual-surface checks)`,
  )
  const user = await createRegisteredUser(env, pg)
  await sqlAsUser(pg, user.userId, 'authenticated', async () => {
    // legacy overloads still resolve alongside the versioned ones
    const claim = await pg.query(`select public.claim_active_session('legacy-client') as sid`)
    const sid = claim.rows[0].sid as string
    expect(sid).toBeTruthy()
    const roll = await pg.query(`select public.create_talent_roll($1) as r`, [sid])
    const rollId = roll.rows[0].r.rollId
    const talentId = roll.rows[0].r.talents[0].id
    const created = await pg.query(
      `select public.create_character($1::uuid,$2::uuid,$3::text,array[$4::text],'tram','{}'::jsonb,87) as cid`,
      [sid, rollId, uniqueName('D'), talentId],
    )
    const cid = created.rows[0].cid as string
    // and a direct save write still lands under the saves_own_* policies
    const w = await pg.query(
      `insert into public.character_saves(character_id, user_id, schema_version, save_revision, payload)
       values ($1, $2, 87, 1, '{"dual":"window"}'::jsonb) returning character_id`,
      [cid, user.userId],
    )
    expect(w.rows[0].character_id).toBe(cid)
  })
})

test('matrix [prepare x contract client]: guarded RPCs admit normal play during the dual window', async () => {
  test.skip(
    phase !== 'prepare',
    `project phase is '${phase}' - contract-on-prepare admission was probed at first apply`,
  )
  // identical to the cutover eligible cell: the guarded surface is additive
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(ls.serverCheckpoint, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
})

test('matrix [cutover x legacy client]: every legacy path is server-denied with zero mutation', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
  const before = await saveRow(pg, character.id)
  const receiptsBefore = (await receiptRows(pg, user.userId)).length

  // What an un-upgraded binary can still send: the retired overloads and the
  // direct table API, all under a perfectly valid authenticated JWT.
  const oldClaim = await rpc(env, user.token, 'claim_active_session', { p_device_label: 'legacy' })
  expect(oldClaim.status, 'retired 1-arg claim').toBe(404)
  const oldCreate = await rpc(env, user.token, 'create_character', {
    p_session_id: randomUUID(), p_roll_id: randomUUID(), p_name: 'zz',
    p_talent_ids: ['x'], p_mortal_basic_skill_id: 'tram',
    p_initial_save: {}, p_schema_version: 87,
  })
  expect(oldCreate.status, 'retired 7-arg create').toBe(404)

  for (const [method, path, body] of [
    ['POST', '/character_saves', { character_id: character.id, user_id: user.userId, schema_version: 87, payload: { injected: true } }],
    ['PATCH', `/character_saves?character_id=eq.${character.id}`, { payload: { injected: true } }],
    ['DELETE', `/character_saves?character_id=eq.${character.id}`, undefined],
    ['GET', `/save_inventory_compatibility?limit=1`, undefined],
  ] as const) {
    const res = await rest(env, user.token, method, path, body)
    const denied = res.status >= 400 || (res.status === 200 && Array.isArray(res.body) && res.body.length === 0)
    expect(denied, `${method} ${path} -> ${res.status}`).toBe(true)
  }

  // zero mutation: bytes, revision, cutoff, receipt count all unchanged
  const after = await saveRow(pg, character.id)
  expect(after.save_revision).toBe(before.save_revision)
  expect(after.payload_bytes).toBe(before.payload_bytes)
  expect(after.progression_cutoff_at).toEqual(before.progression_cutoff_at)
  expect(await receiptRows(pg, user.userId)).toHaveLength(receiptsBefore)
})

test('matrix [cutover x contract client]: the B1.3 surface admits the full save journey', async () => {
  requireCutover()
  const user = await createRegisteredUser(env, pg)

  const status = await rpc(env, user.token, 'get_backend_status')
  expect(status.body.status).toBe('OK')
  expect(status.body.contractPhase).toBe('cutover')

  const sid = await claimSession(env, user.token, { deviceLabel: 'matrix-eligible', protocolVersion: 1, buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  const ls0 = await loadState(env, user.token, sid)
  expect(ls0.status).toBe('CHARACTER_UNINITIALIZED')

  const w1 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(ls0.serverCheckpoint, 100), buildId: BUILD,
  })
  expect(w1.body.status).toBe('COMMITTED')
  expect(w1.body.committedRevision).toBe(1)

  const hb = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sid })
  expect(hb.body.status).toBe('OK')
  const w2 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload: buildSavePayload(character),
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: hb.body.checkpoint.checkpointId, elapsedMonotonicMs: 60_000 },
    buildId: BUILD,
  })
  expect(w2.body.status).toBe('COMMITTED')
  expect(w2.body.committedRevision).toBe(2)

  const ls2 = await loadState(env, user.token, sid)
  expect(ls2.status).toBe('SAVE_READY')
  expect(ls2.save.saveRevision).toBe(2)

  const rev = await rpc(env, user.token, 'revoke_current_session', { p_session_id: sid })
  expect(rev.body.status).toBe('REVOKED')
  const after = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sid })
  expect(after.body.code).toBe('28000')
  expect(await receiptRows(pg, user.userId)).toHaveLength(2)
})

test('matrix [retained legacy JWT/session x cutover]: stale sessions denied, auth itself unchanged, revoke reachable', async () => {
  requireCutover()
  const { user, character } = await authedUserWithCharacter()

  // A retained GoTrue JWT is indistinguishable from a fresh one - auth is not
  // schema-phased. It still authenticates the public status surface...
  const status = await rpc(env, user.token, 'get_backend_status')
  expect(status.body.status).toBe('OK')

  // ...while session rows minted by retired means (null protocol, or a
  // version outside the supported set) can never reach a guarded op.
  for (const protocol of [null, 99]) {
    await pg.query(`update public.account_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [user.userId])
    const seeded = await pg.query(
      `insert into public.account_sessions(user_id, device_label, protocol_version, build_id)
         values ($1, $2, $3, $4) returning id`,
      [user.userId, `retained-${protocol ?? 'null'}`, protocol, 'legacy-build'],
    )
    const staleSid = seeded.rows[0].id as string
    const ls = await rpc(env, user.token, 'load_game_state', { p_session_id: staleSid })
    expect(ls.body.code, `protocol ${protocol}`).toBe('28000')
    expect(ls.body.message).toBe('SESSION_PROTOCOL_OUTDATED')
    const w = await writeSave(env, user.token, {
      sessionId: staleSid, expectedRevision: 0, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: { checkpointId: randomUUID(), elapsedMonotonicMs: 0 },
      buildId: BUILD,
    })
    expect(w.body.code).toBe('28000')
    const hb = await rpc(env, user.token, 'heartbeat_session', { p_session_id: staleSid })
    expect(hb.body.code).toBe('28000')
    // cleanup is always reachable regardless of protocol vintage
    const rev = await rpc(env, user.token, 'revoke_current_session', { p_session_id: staleSid })
    expect(rev.body.status).toBe('REVOKED')
  }

  // the account is not bricked: a fresh versioned claim resumes normal play
  const sid2 = await claimSession(env, user.token, { buildId: BUILD })
  const ls = await loadState(env, user.token, sid2)
  expect(ls.status).toBe('CHARACTER_UNINITIALIZED')
  const w = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(ls.serverCheckpoint, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
})

// ---------------------------------------------------------------------------
// Two-device adversarial cells - two claim orders, CAS one-wins, foreign
// session theft. One account admits exactly one active session, so "device B"
// is a second claim under the same JWT (the real multi-device contract).
// ---------------------------------------------------------------------------

test('two-device [claim A then B]: B steals the slot; A is dead for every guarded op', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')

  // Device B claims under the same account - the steal is the contract.
  const sidB = await claimSession(env, user.token, { deviceLabel: 'device-b', buildId: BUILD })
  expect(sidB).not.toBe(sid)

  const hbA = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sid })
  expect(hbA.body.code).toBe('28000')
  const hbB = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sidB })
  expect(hbB.body.status).toBe('OK')

  // A's write dies on the revoked session and mutates nothing.
  const cpB = (await loadState(env, user.token, sidB)).serverCheckpoint
  const wA = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cpB, 10), buildId: BUILD,
  })
  expect(wA.body.code).toBe('28000')
  expect((await saveRow(pg, character.id)).save_revision).toBe(1)
  expect(await activeSessionCount(pg, user.userId)).toBe(1)
})

test('two-device [claim B then A]: the reverse order steals symmetrically', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  // Retire the provisioned claim; drive the B-first order explicitly.
  await rpc(env, user.token, 'revoke_current_session', { p_session_id: sid })
  const sidB = await claimSession(env, user.token, { deviceLabel: 'device-b', buildId: BUILD })
  const cpB = (await loadState(env, user.token, sidB)).serverCheckpoint
  const wB = await writeSave(env, user.token, {
    sessionId: sidB, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cpB, 10), buildId: BUILD,
  })
  expect(wB.body.status).toBe('COMMITTED')

  // Device A (re-)claims second - A wins the slot, B is dead.
  const sidA = await claimSession(env, user.token, { deviceLabel: 'device-a', buildId: BUILD })
  const hbB = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sidB })
  expect(hbB.body.code).toBe('28000')
  const lsA = await loadState(env, user.token, sidA)
  expect(lsA.status).toBe('SAVE_READY')
  expect(lsA.save.saveRevision).toBe(1)
  expect(await activeSessionCount(pg, user.userId)).toBe(1)
  expect((await saveRow(pg, character.id)).save_revision).toBe(1)
})

test('two-device [same-revision race]: concurrent CAS at nonzero revision admits exactly one writer', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp0 = (await loadState(env, user.token, sid)).serverCheckpoint
  const w1 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp0, 10), buildId: BUILD,
  })
  expect(w1.body.status).toBe('COMMITTED')

  // Two writes race at expectedRevision 1 - the row lock + CAS admits one.
  const cp1 = (await loadState(env, user.token, sid)).serverCheckpoint
  const [a, b] = await Promise.all([
    writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 1, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp1, 60), buildId: BUILD,
    }),
    writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 1, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp1, 60), buildId: BUILD,
    }),
  ])
  const outcomes = [a.body.status, b.body.status].sort()
  expect(outcomes).toEqual(['COMMITTED', 'CONFLICT'])
  const conflict = [a, b].find((r) => r.body.status === 'CONFLICT')!
  expect(conflict.body.currentRevision).toBe(2)
  expect((await saveRow(pg, character.id)).save_revision).toBe(2)
  expect(await receiptRows(pg, user.userId)).toHaveLength(2)
})

test('two-device [foreign session theft]: another account cannot drive or revoke the session', async () => {
  requireCutover()
  const a = await authedUserWithCharacter()
  const b = await authedUserWithCharacter()

  // B presents A's session id: guarded ops deny it as a foreign session.
  const hb = await rpc(env, b.user.token, 'heartbeat_session', { p_session_id: a.sid })
  expect(hb.body.code).toBe('28000')
  const ls = await rpc(env, b.user.token, 'load_game_state', { p_session_id: a.sid })
  expect(ls.body.code).toBe('28000')

  // revoke_current_session is idempotent by design - B's call affects zero
  // rows, A's session stays live.
  const rev = await rpc(env, b.user.token, 'revoke_current_session', { p_session_id: a.sid })
  expect(rev.body.status).toBe('REVOKED')
  const stillAlive = await rpc(env, a.user.token, 'heartbeat_session', { p_session_id: a.sid })
  expect(stillAlive.body.status).toBe('OK')
  expect(await activeSessionCount(pg, a.user.userId)).toBe(1)
})

// ---------------------------------------------------------------------------
// Forged inputs - malformed/forged RPC arguments reject before any mutation.
// ---------------------------------------------------------------------------

test('forged: malformed and forged write/claim inputs reject without unintended mutation', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const payload = buildSavePayload(character)
  const receiptsBefore = (await receiptRows(pg, user.userId)).length

  // revision outside the safe-integer contract
  for (const rev of [-1, 9007199254740992]) {
    const r = await writeSave(env, user.token, {
      sessionId: sid, expectedRevision: rev, payload,
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
    })
    expect(r.body.code, `revision ${rev}`).toBe('SAVE_INVALID')
  }
  // a non-integer revision never reaches the function body
  const badType = await rpc(env, user.token, 'write_character_save', {
    p_session_id: sid, p_expected_revision: 'seven', p_schema_version: 87,
    p_payload: payload, p_build_id: BUILD, p_mutation_id: randomUUID(),
    p_time_checkpoint: checkpointArg(cp, 10),
  })
  expect(badType.status).toBeGreaterThanOrEqual(400)

  // fabricated session uuid: exists nowhere -> session-revoked class
  const ghost = await writeSave(env, user.token, {
    sessionId: randomUUID(), expectedRevision: 0, payload,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(ghost.body.code).toBe('28000')

  // overlong build id
  const bigBuild = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10),
    buildId: 'b'.repeat(65),
  })
  expect(bigBuild.body.code).toBe('SAVE_INVALID')

  // checkpoint shaped wrong: array is not an object
  const arrCp = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(), timeCheckpoint: [] as unknown as Record<string, unknown>, buildId: BUILD,
  })
  expect(arrCp.body.code).toBe('CHECKPOINT_REQUIRED')

  // fractional monotonic offset is not an integer
  const frac = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 1.5 },
    buildId: BUILD,
  })
  expect(frac.body.code).toBe('CHECKPOINT_INVALID')

  // receipt fingerprint binds the checkpoint: reusing a committed mutation id
  // with a different checkpoint is a forged replay, not an idempotent retry.
  const mutation = randomUUID()
  const first = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: mutation, timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(first.body.status).toBe('COMMITTED')
  const cp2 = (await loadState(env, user.token, sid)).serverCheckpoint
  const forgedRetry = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: mutation, timeCheckpoint: checkpointArg(cp2, 10), buildId: BUILD,
  })
  expect(forgedRetry.body.status).toBe('REJECTED')
  expect(forgedRetry.body.code).toBe('MUTATION_ID_REUSED')

  // claim forgery: protocol versions outside the supported set
  const p0 = await rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'x', p_protocol_version: 0, p_build_id: 'b',
  })
  expect(p0.body.code).toBe('PROTOCOL_UNSUPPORTED')
  const pNeg = await rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'x', p_protocol_version: -3, p_build_id: 'b',
  })
  expect(pNeg.body.code).toBe('PROTOCOL_UNSUPPORTED')

  // exactly one mutation ever landed - the single legitimate commit above
  const row = await saveRow(pg, character.id)
  expect(row.save_revision).toBe(1)
  expect(await receiptRows(pg, user.userId)).toHaveLength(receiptsBefore + 1)
})

// ---------------------------------------------------------------------------
// Journal crash-point replays - kill between each durable stage, simulated by
// driving the stages step-wise against the real RPC surface.
// ---------------------------------------------------------------------------

test('crash replay [journal written, transport never reached]: replay commits the pending mutation exactly once', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const h = journalHarness(env, CONTRACT_BUILD, user, character, sid)

  // Killed after the journal write, before the transport write ever left:
  // a durable record whose mutation the server has never seen.
  const payload = integrationGameSave(character)
  const record = buildPendingSaveRecord({
    environmentId: h.binding.environmentId,
    userId: user.userId,
    characterId: character.id,
    mutationId: randomUUID(),
    baseRevision: 0,
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 100 },
    schemaVersion: 87,
    buildId: BUILD,
    createdAtUtc: new Date().toISOString(),
    rawPayload: JSON.stringify(payload),
  })
  expect(h.journal.put(record).status).toBe('ok')

  // Next boot: load() replays the frozen mutation verbatim; the server
  // commits it for the first time and the journal drains.
  const load = await h.service.load()
  expect(load.status).toBe('ok')
  if (load.status === 'ok') expect(load.revision).toBe(1)
  expect(h.decisions.at(-1)).toMatchObject({
    status: 'already-committed',
    committedRevision: 1,
    currentRevision: 1,
  })
  expect(h.journal.read(h.binding).status).toBe('none')
  expect(await mutationReceiptCount(pg, user.userId, record.mutationId)).toBe(1)
  expect(await readServerRevision(pg, character.id)).toBe(1)
  const row = await saveRow(pg, character.id)
  expect(row.payload).toEqual(payload)
})

test('crash replay [ACK received, journal clear never ran]: replay resolves already-committed and never re-commits', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const h = journalHarness(env, CONTRACT_BUILD, user, character, sid)
  const payload = integrationGameSave(character)
  const mutation = randomUUID()
  const record = buildPendingSaveRecord({
    environmentId: h.binding.environmentId,
    userId: user.userId,
    characterId: character.id,
    mutationId: mutation,
    baseRevision: 0,
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 100 },
    schemaVersion: 87,
    buildId: BUILD,
    createdAtUtc: new Date().toISOString(),
    rawPayload: JSON.stringify(payload),
  })
  expect(h.journal.put(record).status).toBe('ok')

  // The write committed and the ACK reached the client (the acked mirror is
  // written first), but the process died before journal.clearMatching.
  const committed = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: asRpcPayload(payload),
    mutationId: mutation, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(committed.body.status).toBe('COMMITTED')

  const { load, decision } = await retrySameMutationAfterLostAck(h)
  expect(load.status).toBe('ok')
  expect(decision).toMatchObject({ status: 'already-committed', committedRevision: 1, currentRevision: 1 })
  expect(h.journal.read(h.binding).status).toBe('none')
  expect(await mutationReceiptCount(pg, user.userId, mutation)).toBe(1)
  expect(await readServerRevision(pg, character.id)).toBe(1)
})

test('crash replay [no journal record]: nothing replays; the first save commits fresh', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const h = journalHarness(env, CONTRACT_BUILD, user, character, sid)

  // Killed before the journal write: no record exists, so load() is a plain
  // authoritative read - no phantom replay, no revision drift.
  expect(h.journal.read(h.binding).status).toBe('none')
  const load = await h.service.load()
  expect(load.status).toBe('uninitialized')
  expect(await receiptRows(pg, user.userId)).toHaveLength(0)
  expect(await saveRow(pg, character.id)).toBeNull()

  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: asRpcPayload(integrationGameSave(character)),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
  expect(w.body.committedRevision).toBe(1)
})

// ---------------------------------------------------------------------------
// Token refresh mid-flight - rotating the GoTrue pair mid-write must not
// abort the in-flight commit nor strand the session.
// ---------------------------------------------------------------------------

test('auth: token refresh mid-flight keeps the in-flight commit and the rotated pair working', async () => {
  requireCutover()
  const user = await signupAnonymousWithRefresh(env)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint

  // Fire the write and the refresh concurrently: the in-flight request is
  // already authenticated; rotation cannot retroactively kill its commit.
  const [writeRes, refreshRes] = await Promise.all([
    writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 50), buildId: BUILD,
    }),
    fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: user.refreshToken }),
      signal: AbortSignal.timeout(15_000),
    }),
  ])
  expect(writeRes.body.status).toBe('COMMITTED')
  expect(refreshRes.status).toBe(200)
  const rotated = await refreshRes.json()
  expect(rotated.access_token).toBeTruthy()
  expect(rotated.user.id).toBe(user.userId)

  // The rotated access token operates the still-live session normally.
  const hb = await rpc(env, rotated.access_token as string, 'heartbeat_session', { p_session_id: sid })
  expect(hb.body.status).toBe('OK')
  const ls = await rpc(env, rotated.access_token as string, 'load_game_state', { p_session_id: sid })
  expect(ls.body.status).toBe('SAVE_READY')

  // Reuse of the spent refresh token is at most a same-user rotation: it can
  // never mint tokens for a different user, and it never rewrites the save.
  const reuse = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: env.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: user.refreshToken }),
    signal: AbortSignal.timeout(15_000),
  })
  if (reuse.status === 200) {
    const reuseBody = await reuse.json()
    expect(reuseBody.user.id).toBe(user.userId)
  } else {
    // rotation reuse detection: spent tokens are rejected outright
    expect(reuse.status).toBeGreaterThanOrEqual(400)
  }
  expect(await readServerRevision(pg, character.id)).toBe(1)
  expect(await receiptRows(pg, user.userId)).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// Clock skew - client-supplied time is never authority. The server bounds the
// monotonic offset to anchor + elapsed + grace and derives the cutoff from
// the checkpoint anchor, not from any client-carried wall-clock field.
// ---------------------------------------------------------------------------

test('clock: skewed client timestamps cannot move the progression cutoff past server bounds', async () => {
  requireCutover()
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint
  const anchorMs = Date.parse(cp.anchorAt)

  // First-save / no-tick proof: elapsed 0 -> the cutoff lands exactly at the
  // checkpoint anchor (zero accrual before the first commit).
  const w0 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 0 },
    buildId: BUILD,
  })
  expect(w0.body.status).toBe('COMMITTED')
  const cutoff0 = Date.parse(w0.body.progressionCutoffAt)
  expect(Math.abs(cutoff0 - anchorMs)).toBeLessThan(1_000)

  // A payload carrying a fabricated far-future client clock field stores
  // verbatim but moves nothing - the cutoff is anchor + bounded offset.
  const skewedPayload = {
    ...buildSavePayload(character),
    lastSavedAt: '2999-01-01T00:00:00.000Z',
    playedUntil: '2999-01-01T00:00:00.000Z',
  }
  const cp2 = (await loadState(env, user.token, sid)).serverCheckpoint
  const skewElapsed = Math.max(0, Date.now() - Date.parse(cp2.anchorAt)) + 60_000 // inside the 300s grace
  const w1 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload: skewedPayload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp2.checkpointId, elapsedMonotonicMs: skewElapsed },
    buildId: BUILD,
  })
  expect(w1.body.status).toBe('COMMITTED')
  const cutoff1 = Date.parse(w1.body.progressionCutoffAt)
  expect(cutoff1).toBeLessThan(Date.parse('2999-01-01T00:00:00.000Z'))
  expect(Math.abs(cutoff1 - (Date.parse(cp2.anchorAt) + skewElapsed))).toBeLessThan(1_000)

  // And the bound is enforced: an offset past server-elapsed + grace rejects.
  const overGrace = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 2, payload: buildSavePayload(character),
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp2.checkpointId, elapsedMonotonicMs: skewElapsed + 300_000 + 60_000 },
    buildId: BUILD,
  })
  expect(overGrace.body.code).toBe('CHECKPOINT_OFFSET_OUT_OF_BOUNDS')
  expect((await saveRow(pg, character.id)).save_revision).toBe(2)
})

// ---------------------------------------------------------------------------
// Guest restart + upgrade replay - process restart claims a fresh session
// under the same durable identity; the PR6 finalize RPC replays idempotently.
// ---------------------------------------------------------------------------

test('guest: restart keeps the same account/character/save; upgrade finalize replays idempotently', async () => {
  requireCutover()
  const user = await createAnonymousUser(env)
  const sid1 = await claimSession(env, user.token, { deviceLabel: 'guest-boot-1', buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid1)
  const cp = (await loadState(env, user.token, sid1)).serverCheckpoint
  const w1 = await writeSave(env, user.token, {
    sessionId: sid1, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(w1.body.status).toBe('COMMITTED')

  // Restart: a new claim under the same auth identity revokes the old
  // session and reloads the same character at the committed revision.
  const sid2 = await claimSession(env, user.token, { deviceLabel: 'guest-boot-2', buildId: BUILD })
  const ls = await loadState(env, user.token, sid2)
  expect(ls.status).toBe('SAVE_READY')
  expect(ls.character.id).toBe(character.id)
  expect(ls.save.saveRevision).toBe(1)

  // Upgrade path (EXT-09 law): confirmed email -> FINALIZED; the replay is
  // idempotent and never duplicates profile/character rows.
  const loginId = uniqueName('cut').toLowerCase().replace(/[^a-z0-9_]/g, 'x').slice(0, 20)
  await confirmEmailIdentity(pg, user.userId, `${loginId}@tutien-idle-accounts.invalid`)
  const fin1 = await rpc(env, user.token, 'finalize_guest_upgrade', { p_login_id: loginId })
  expect(fin1.body?.status).toBe('FINALIZED')
  const fin2 = await rpc(env, user.token, 'finalize_guest_upgrade', { p_login_id: loginId })
  expect(fin2.body?.status).toBe('FINALIZED')
  const chars = await pg.query('select id from public.characters where user_id = $1', [user.userId])
  expect(chars.rows.map((r) => r.id)).toEqual([character.id])

  // Play continues post-upgrade under the restart session. The offset is a
  // plain bounded positive value - the checkpoint anchors server-side.
  const w2 = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 1, payload: buildSavePayload(character),
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: ls.serverCheckpoint.checkpointId, elapsedMonotonicMs: 60_000 },
    buildId: BUILD,
  })
  expect(w2.body.status).toBe('COMMITTED')
  expect(w2.body.committedRevision).toBe(2)
})
