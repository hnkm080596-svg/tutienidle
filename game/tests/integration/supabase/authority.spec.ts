// BETA-FINAL B1-A (PR2) authority contract suite.
//
// Executes the spec B1.3 surface against the real staging Supabase project:
// real GoTrue JWTs (anonymous + SQL-seeded registered), real PostgREST calls,
// and a direct postgres connection for lock-holding, seeding and invariant
// assertions. The runner (scripts/supabase/run-contract.mjs) has already
// applied migrations and proven both migration histories; this spec proves
// the resulting contract behavior.
//
// No skip=pass: missing infra throws and the suite fails nonzero.
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
  claimSession,
  provisionCharacter,
  buildSavePayload,
  loadState,
  writeSave,
  checkpointArg,
  saveRow,
  receiptRows,
  activeSessionCount,
  uniqueName,
  type ContractEnv,
  type TestUser,
  type CharacterMeta,
} from './fixture'

test.describe.configure({ mode: 'serial' })

let env: ContractEnv
let pg: Client

const BUILD = 'contract-build-1'

async function authedUserWithCharacter(kind: 'anonymous' | 'registered' = 'registered') {
  const user = kind === 'registered' ? await createRegisteredUser(env, pg) : await createAnonymousUser(env)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  return { user, sid, character }
}

// Poll until `needle` SQL text is observed waiting on a lock (bounded).
async function waitForLockWaiter(needle: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await pg.query(
      `select count(*)::int n from pg_stat_activity
        where wait_event_type = 'Lock' and query ilike $1 and pid <> pg_backend_pid()`,
      [`%${needle}%`],
    )
    if (r.rows[0].n > 0) return
    await new Promise((r2) => setTimeout(r2, 50))
  }
  throw new Error(`no lock waiter observed for ${needle}`)
}

test.beforeAll(async () => {
  env = loadContractEnv()
  pg = await dbClient(env)
  // Infra gate: contract surface installed and in cutover phase.
  const phase = await pg.query(`select public.beta_contract_phase() as p`)
  expect(phase.rows[0].p, 'beta_contract_phase must be cutover').toBe('cutover')
})

test.afterAll(async () => {
  await pg.end()
})

// ---------------------------------------------------------------------------
// admission + status
// ---------------------------------------------------------------------------

test('status: get_backend_status exposes the compatibility projection', async () => {
  const user = await createRegisteredUser(env, pg)
  const res = await rpc(env, user.token, 'get_backend_status')
  expect(res.status).toBe(200)
  expect(res.body.status).toBe('OK')
  expect(res.body.contractPhase).toBe('cutover')
  expect(res.body.protocolVersion).toBe(1)
  expect(res.body.supportedProtocolVersions).toContain(1)
  expect(res.body.acceptedSaveSchemaVersions).toContain(87)
  expect(res.body.serverTimeUtc).toBeTruthy()
  // no private state: the object contains only compatibility keys
  expect(Object.keys(res.body).sort()).toEqual(
    ['acceptedSaveSchemaVersions', 'contractPhase', 'maintenance', 'minClientVersion',
      'protocolVersion', 'serverTimeUtc', 'status', 'supportedClientVersions',
      'supportedProtocolVersions'].sort(),
  )
})

test('status: unauthenticated callers get nothing', async () => {
  const noJwt = await rpc(env, null, 'get_backend_status')
  expect(noJwt.status).toBeGreaterThanOrEqual(400)
  expect(noJwt.body?.status).not.toBe('OK')
  const anonKeyAsBearer = await rpc(env, env.anonKey, 'get_backend_status')
  expect(anonKeyAsBearer.status).toBeGreaterThanOrEqual(400)
})

test('admission: versioned claim admits supported protocol and records metadata', async () => {
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, {
    deviceLabel: 'contract-device',
    protocolVersion: 1,
    buildId: BUILD,
  })
  const row = await pg.query(
    `select protocol_version, build_id, device_label, revoked_at is null as active
       from public.account_sessions where id = $1`,
    [sid],
  )
  expect(row.rows[0].protocol_version).toBe(1)
  expect(row.rows[0].build_id).toBe(BUILD)
  expect(row.rows[0].device_label).toBe('contract-device')
  expect(row.rows[0].active).toBe(true)
})

test('admission: unsupported protocol, bad build/device fields rejected', async () => {
  const user = await createRegisteredUser(env, pg)
  const badProto = await rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'x', p_protocol_version: 999, p_build_id: 'b',
  })
  expect(badProto.body.status).toBe('REJECTED')
  expect(badProto.body.code).toBe('PROTOCOL_UNSUPPORTED')
  const noBuild = await rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'x', p_protocol_version: 1, p_build_id: '',
  })
  expect(noBuild.body.code).toBe('BUILD_ID_INVALID')
  const longDevice = await rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'd'.repeat(161), p_protocol_version: 1, p_build_id: 'b',
  })
  expect(longDevice.body.code).toBe('DEVICE_LABEL_INVALID')
  // and an unauthenticated caller is rejected outright
  const noJwt = await rpc(env, null, 'claim_active_session', {
    p_device_label: 'x', p_protocol_version: 1, p_build_id: 'b',
  })
  expect(noJwt.status).toBeGreaterThanOrEqual(400)
})

test('admission: maintenance lever denies new claims only', async () => {
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  await pg.query(`update public.backend_config set value='{"enabled": true}'::jsonb where key='maintenance'`)
  try {
    const denied = await rpc(env, user.token, 'claim_active_session', {
      p_device_label: 'x', p_protocol_version: 1, p_build_id: 'b',
    })
    expect(denied.body.status).toBe('REJECTED')
    expect(denied.body.code).toBe('MAINTENANCE_MODE')
    // existing admitted sessions continue operating (reads stay live)
    const hb = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sid })
    expect(hb.status).toBe(200)
    expect(hb.body.status).toBe('OK')
  } finally {
    await pg.query(`update public.backend_config set value='{"enabled": false}'::jsonb where key='maintenance'`)
  }
})

// ---------------------------------------------------------------------------
// session lock interleaving (checkbox 2)
// ---------------------------------------------------------------------------

test('locks: profile row serializes claim vs write; save-first order commits', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint

  const holder = await dbClient(env)
  await holder.query('begin')
  await holder.query(`select user_id from public.profiles where user_id = $1 for update`, [user.userId])

  // order A: write enqueues first
  const writeP = writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 50), buildId: BUILD,
  })
  await waitForLockWaiter('write_character_save')
  const claimP = rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'racer', p_protocol_version: 1, p_build_id: BUILD,
  })
  await waitForLockWaiter('claim_active_session')
  await holder.query('commit')
  const [w, c] = await Promise.all([writeP, claimP])
  await holder.end()

  expect(w.status).toBe(200)
  expect(w.body.status).toBe('COMMITTED')
  expect(w.body.committedRevision).toBe(1)
  expect(c.body.status).toBe('ADMITTED')
  const newSid = c.body.sessionId as string
  expect(newSid).not.toBe(sid)
  // the save committed under the pre-claim session; that session is now revoked
  const stale = await rpc(env, user.token, 'load_game_state', { p_session_id: sid })
  expect(stale.body.code).toBe('28000')
  const row = await saveRow(pg, character.id)
  expect(row.save_revision).toBe(1)
})

test('locks: profile row serializes claim vs write; claim-first order revokes', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint

  const holder = await dbClient(env)
  await holder.query('begin')
  await holder.query(`select user_id from public.profiles where user_id = $1 for update`, [user.userId])

  // order B: claim enqueues first - the stale session's save must be rejected
  const claimP = rpc(env, user.token, 'claim_active_session', {
    p_device_label: 'racer', p_protocol_version: 1, p_build_id: BUILD,
  })
  await waitForLockWaiter('claim_active_session')
  const writeP = writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 50), buildId: BUILD,
  })
  await waitForLockWaiter('write_character_save')
  await holder.query('commit')
  const [c, w] = await Promise.all([claimP, writeP])
  await holder.end()

  expect(c.body.status).toBe('ADMITTED')
  expect(w.body.code).toBe('28000') // session revoked mid-flight
  expect(w.body.message).toBe('session revoked')
  const row = await saveRow(pg, character.id)
  expect(row).toBeNull() // no save row created
  const receipts = await receiptRows(pg, user.userId)
  expect(receipts.length).toBe(0)
})

test('locks: simultaneous claims serialize - exactly one active session survives', async () => {
  const user = await createRegisteredUser(env, pg)
  const [a, b] = await Promise.all([
    rpc(env, user.token, 'claim_active_session', { p_device_label: 'a', p_protocol_version: 1, p_build_id: BUILD }),
    rpc(env, user.token, 'claim_active_session', { p_device_label: 'b', p_protocol_version: 1, p_build_id: BUILD }),
  ])
  expect(a.body.status).toBe('ADMITTED')
  expect(b.body.status).toBe('ADMITTED')
  expect(await activeSessionCount(pg, user.userId)).toBe(1)
  const active = await pg.query(
    `select id from public.account_sessions where user_id = $1 and revoked_at is null`,
    [user.userId],
  )
  const winner = active.rows[0].id as string
  const loser = winner === a.body.sessionId ? b.body.sessionId : a.body.sessionId
  // loser cannot operate
  const dead = await rpc(env, user.token, 'heartbeat_session', { p_session_id: loser })
  expect(dead.body.code).toBe('28000')
  // winner can
  const alive = await rpc(env, user.token, 'heartbeat_session', { p_session_id: winner })
  expect(alive.body.status).toBe('OK')
})

test('locks: simultaneous revision-0 writes - exactly one commits', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint
  const [w1, w2] = await Promise.all([
    writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
    }),
    writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 150), buildId: BUILD,
    }),
  ])
  const outcomes = [w1.body.status, w2.body.status].sort()
  expect(outcomes).toEqual(['COMMITTED', 'CONFLICT'])
  const conflict = [w1, w2].find((w) => w.body.status === 'CONFLICT')!
  expect(conflict.body.code).toBe('SAVE_CONFLICT')
  expect(conflict.body.currentRevision).toBe(1)
  const row = await saveRow(pg, character.id)
  expect(row.save_revision).toBe(1)
  expect(await receiptRows(pg, user.userId)).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// receipt / CAS matrix (checkboxes 3 + 5)
// ---------------------------------------------------------------------------

test('receipts: 0->1 commit, identical retry, reused id, conflicts, digests', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint
  const mutationA = randomUUID()
  const payloadA = buildSavePayload(character)

  // 0 -> 1
  const w1 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: payloadA,
    mutationId: mutationA, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(w1.body.status).toBe('COMMITTED')
  expect(w1.body.committedRevision).toBe(1)
  expect(w1.body.progressionCutoffAt).toBeTruthy()
  expect(w1.body.receipt.requestDigest).toMatch(/^[0-9a-f]{64}$/)

  // identical retry stays at the committed revision (lost-ACK semantics)
  const w1retry = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: payloadA,
    mutationId: mutationA, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(w1retry.body.status).toBe('COMMITTED')
  expect(w1retry.body.alreadyCommitted).toBe(true)
  expect(w1retry.body.committedRevision).toBe(1)
  let row = await saveRow(pg, character.id)
  expect(row.save_revision).toBe(1)
  expect(await receiptRows(pg, user.userId)).toHaveLength(1)

  // JSONB digest is canonical: same payload, different key order -> same
  // fingerprint -> identical retry (NOT a byte hash of the client request)
  const reordered = JSON.parse(
    `{"equipmentSlots":[],"buildings":[],"formations":[],"talismans":[],"pills":[],"equipment":[],"materials":[],"skills":[],"techniques":[],"player":${JSON.stringify(payloadA.player)},"version":87}`,
  )
  const w1reorder = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: reordered,
    mutationId: mutationA, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(w1reorder.body.alreadyCommitted).toBe(true)
  expect(row.save_revision).toBe(1)

  // same mutation id + different payload -> rejected, row/receipt unchanged
  const payloadB = { ...payloadA, techniques: [{ id: 'changed' }] }
  const wReuse = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: payloadB,
    mutationId: mutationA, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(wReuse.body.status).toBe('REJECTED')
  expect(wReuse.body.code).toBe('MUTATION_ID_REUSED')
  row = await saveRow(pg, character.id)
  expect(row.save_revision).toBe(1)
  expect(await receiptRows(pg, user.userId)).toHaveLength(1)

  // move the row to revision 7 via the operator connection (fixture shortcut
  // for the 7->8 case without seven round trips)
  await pg.query(`update public.character_saves set save_revision = 7 where character_id = $1`, [character.id])
  const cp2 = (await loadState(env, user.token, sid)).serverCheckpoint
  const w78 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 7, payload: payloadA,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp2, 200), buildId: BUILD,
  })
  expect(w78.body.status).toBe('COMMITTED')
  expect(w78.body.committedRevision).toBe(8)

  // expected revision mismatch -> CONFLICT, row + receipts unchanged
  const before = await saveRow(pg, character.id)
  const wConflict = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 7, payload: payloadA,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp2, 300), buildId: BUILD,
  })
  expect(wConflict.body.status).toBe('CONFLICT')
  expect(wConflict.body.code).toBe('SAVE_CONFLICT')
  expect(wConflict.body.currentRevision).toBe(8)
  const after = await saveRow(pg, character.id)
  expect(after.save_revision).toBe(8)
  expect(after.payload_bytes).toBe(before.payload_bytes)
  expect(await receiptRows(pg, user.userId)).toHaveLength(2)

  // already-committed old receipt vs newer row: replaying mutationA reports
  // the original committed revision against the live current revision
  const staleRetry = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: payloadA,
    mutationId: mutationA, timeCheckpoint: checkpointArg(cp, 100), buildId: BUILD,
  })
  expect(staleRetry.body.alreadyCommitted).toBe(true)
  expect(staleRetry.body.committedRevision).toBe(1)
  expect(staleRetry.body.currentRevision).toBe(8)
  expect(await receiptRows(pg, user.userId)).toHaveLength(2)
})

test('receipts: mutation ids are namespaced per owner; foreign session rejected', async () => {
  const a = await authedUserWithCharacter()
  const b = await authedUserWithCharacter()
  const sharedMutation = randomUUID()

  const cpA = (await loadState(env, a.user.token, a.sid)).serverCheckpoint
  const wA = await writeSave(env, a.user.token, {
    sessionId: a.sid, expectedRevision: 0, payload: buildSavePayload(a.character),
    mutationId: sharedMutation, timeCheckpoint: checkpointArg(cpA, 10), buildId: BUILD,
  })
  expect(wA.body.status).toBe('COMMITTED')

  // B reuses A's mutation id against B's own character: owners isolate the
  // receipt namespace, so B's write is judged on B's own CAS state.
  const cpB = (await loadState(env, b.user.token, b.sid)).serverCheckpoint
  const wB = await writeSave(env, b.user.token, {
    sessionId: b.sid, expectedRevision: 0, payload: buildSavePayload(b.character),
    mutationId: sharedMutation, timeCheckpoint: checkpointArg(cpB, 10), buildId: BUILD,
  })
  expect(wB.body.status).toBe('COMMITTED')
  expect(wB.body.committedRevision).toBe(1)
  expect((await saveRow(pg, a.character.id)).save_revision).toBe(1)
  expect((await saveRow(pg, b.character.id)).save_revision).toBe(1)

  // B cannot drive A's session: foreign session id fails the session check
  const steal = await writeSave(env, b.user.token, {
    sessionId: a.sid, expectedRevision: 0, payload: buildSavePayload(b.character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cpB, 10), buildId: BUILD,
  })
  expect(steal.body.code).toBe('28000')
})

test('receipts: revoked session and deleted character cannot commit', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint
  const payload = buildSavePayload(character)

  // revoked session -> exception, no row
  await pg.query(`update public.account_sessions set revoked_at = now() where id = $1`, [sid])
  const wRevoked = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wRevoked.body.code).toBe('28000')
  expect(await saveRow(pg, character.id)).toBeNull()

  // deleted character -> REJECTED even for an identical retry
  const sid2 = await claimSession(env, user.token, { buildId: BUILD })
  const cp2 = (await loadState(env, user.token, sid2)).serverCheckpoint
  const mut = randomUUID()
  const wFirst = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 0, payload,
    mutationId: mut, timeCheckpoint: checkpointArg(cp2, 10), buildId: BUILD,
  })
  expect(wFirst.body.status).toBe('COMMITTED')
  await pg.query(`update public.characters set deleted_at = now() where id = $1`, [character.id])
  const wDeleted = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 0, payload,
    mutationId: mut, timeCheckpoint: checkpointArg(cp2, 10), buildId: BUILD,
  })
  expect(wDeleted.body.status).toBe('REJECTED')
  expect(wDeleted.body.code).toBe('CHARACTER_DELETED')
})

test('payload: schema gate, shape checks, identity binding, byte ceiling', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint
  const payload = buildSavePayload(character)

  // {} rejected server-side
  const empty = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: {},
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(empty.body.status).toBe('REJECTED')
  expect(empty.body.code).toBe('SAVE_INVALID')
  expect(await saveRow(pg, character.id)).toBeNull()

  // non-object rejected
  const arr = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: [1, 2, 3] as any, // deliberately malformed: boundary check
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(arr.body.code).toBe('SAVE_INVALID')

  // unsupported schema version
  const schema = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, schemaVersion: 999,
    payload: { ...payload, version: 999 },
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(schema.body.code).toBe('SAVE_SCHEMA_UNSUPPORTED')

  // schema/payload version mismatch
  const mismatch = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, schemaVersion: 87,
    payload: { ...payload, version: 86 },
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(mismatch.body.code).toBe('SAVE_INVALID')

  // required top-level arrays enforced
  const { equipmentSlots: _drop, ...noSlots } = payload
  const missing = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: noSlots,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(missing.body.code).toBe('SAVE_INVALID')

  // immutable identity: name / talents / starter pick bound to the character
  const wrongName = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0,
    payload: { ...payload, player: { ...(payload.player as object), name: 'NotTheChar' } },
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wrongName.body.code).toBe('SAVE_INVALID')
  const wrongTalent = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0,
    payload: { ...payload, player: { ...(payload.player as object), selectedTalentIds: ['some_other_talent'] } },
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wrongTalent.body.code).toBe('SAVE_INVALID')
  const wrongSkill = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0,
    payload: { ...payload, player: { ...(payload.player as object), mortalBasicSkillId: 'linh_bao' } },
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wrongSkill.body.code).toBe('SAVE_INVALID')

  // post-initiation shape: mortalBasicSkillId absent is legal
  const noMortal = { ...payload, player: { name: character.name, selectedTalentIds: [...character.selectedTalentIds] } }
  const wNoMortal = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: noMortal,
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(wNoMortal.body.status).toBe('COMMITTED')

  // byte ceiling, enforced without mutation: temporarily lower the configured
  // ceiling so the test is independent of transport body limits.
  await pg.query(
    `update public.backend_config set value = jsonb_set(value, '{maxSavePayloadBytes}', '1024') where key = 'limits'`,
  )
  try {
    const big = await writeSave(env, user.token, {
      sessionId: sid, expectedRevision: 1,
      payload: { ...payload, notes: 'x'.repeat(4096) },
      mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
    })
    expect(big.body.status).toBe('REJECTED')
    expect(big.body.code).toBe('SAVE_TOO_LARGE')
    const row = await saveRow(pg, character.id)
    expect(row.save_revision).toBe(1)
    expect(row.payload.notes).toBeUndefined()
  } finally {
    await pg.query(
      `update public.backend_config set value = jsonb_set(value, '{maxSavePayloadBytes}', '4194304') where key = 'limits'`,
    )
  }
  expect(await receiptRows(pg, user.userId)).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// checkpoints + progression cutoff (checkbox 4)
// ---------------------------------------------------------------------------

test('checkpoints: missing/expired/foreign rejected, offset bounded, cutoff monotone', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const ls = await loadState(env, user.token, sid)
  const cp = ls.serverCheckpoint as { checkpointId: string; anchorAt: string; leaseExpiresAt: string }
  const payload = buildSavePayload(character)

  // missing checkpoint object
  const none = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(), timeCheckpoint: undefined, buildId: BUILD,
  })
  expect(none.body.code).toBe('CHECKPOINT_REQUIRED')

  // unknown checkpoint id
  const fake = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: randomUUID(), elapsedMonotonicMs: 10 },
    buildId: BUILD,
  })
  expect(fake.body.code).toBe('CHECKPOINT_INVALID')

  // malformed fields
  const badId = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: 'not-a-uuid', elapsedMonotonicMs: 10 },
    buildId: BUILD,
  })
  expect(badId.body.code).toBe('CHECKPOINT_INVALID')
  const badElapsed = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 'later' },
    buildId: BUILD,
  })
  expect(badElapsed.body.code).toBe('CHECKPOINT_INVALID')

  // negative and out-of-lease offsets
  const neg = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: -5 },
    buildId: BUILD,
  })
  expect(neg.body.code).toBe('CHECKPOINT_OFFSET_OUT_OF_BOUNDS')
  const future = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 10 * 60 * 1000 },
    buildId: BUILD,
  })
  expect(future.body.code).toBe('CHECKPOINT_OFFSET_OUT_OF_BOUNDS')
  expect(await saveRow(pg, character.id)).toBeNull()

  // commit T0 with a large in-lease offset: the stored cutoff lands far ahead
  // of wall-clock-now so a later small offset is a genuine regression
  const e0 = 240_000
  const m0 = randomUUID()
  const w0 = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: m0, timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: e0 },
    buildId: BUILD,
  })
  expect(w0.body.status).toBe('COMMITTED')
  const cutoff0 = w0.body.progressionCutoffAt
  expect(cutoff0).toBeTruthy()
  // cutoff = anchor + offset (not updated_at, not client wall clock)
  const anchorMs = Date.parse(cp.anchorAt)
  expect(Math.abs(Date.parse(cutoff0) - (anchorMs + e0))).toBeLessThan(1_000)

  // pending-at-T0 / retry-at-T1: an identical retry later reports the SAME
  // cutoff - the committed watermark is preserved, never guessed forward
  await new Promise((r) => setTimeout(r, 300))
  const w0retry = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload,
    mutationId: m0, timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: e0 },
    buildId: BUILD,
  })
  expect(w0retry.body.alreadyCommitted).toBe(true)
  expect(w0retry.body.progressionCutoffAt).toBe(cutoff0)

  // expired lease -> checkpoint invalid (operator update simulates expiry)
  await pg.query(
    `update public.time_checkpoints set lease_expires_at = now() - interval '1 second' where id = $1`,
    [cp.checkpointId],
  )
  const stale = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cp.checkpointId, elapsedMonotonicMs: 1_000 },
    buildId: BUILD,
  })
  expect(stale.body.code).toBe('CHECKPOINT_INVALID')

  // foreign checkpoint: bound to another owner's character
  const other = await authedUserWithCharacter()
  const cpOther = (await loadState(env, other.user.token, other.sid)).serverCheckpoint
  const crossCp = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cpOther.checkpointId, elapsedMonotonicMs: 10 },
    buildId: BUILD,
  })
  expect(crossCp.body.code).toBe('CHECKPOINT_INVALID')

  // nondecreasing cutoff: a second commit on a fresh checkpoint with a smaller
  // offset that still lands before the stored cutoff must reject
  const cpB = (await loadState(env, user.token, sid)).serverCheckpoint
  await new Promise((r) => setTimeout(r, 50))
  const regress = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cpB.checkpointId, elapsedMonotonicMs: 0 },
    buildId: BUILD,
  })
  expect(regress.body.code).toBe('CUTOFF_REGRESSION')
  const fwd = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 1, payload,
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cpB.checkpointId, elapsedMonotonicMs: e0 + 10_000 },
    buildId: BUILD,
  })
  expect(fwd.body.status).toBe('COMMITTED')
  expect(fwd.body.committedRevision).toBe(2)
  expect(Date.parse(fwd.body.progressionCutoffAt)).toBeGreaterThan(Date.parse(cutoff0))
})

test('checkpoints: fresh session may present the owner historical checkpoint', async () => {
  const { user, sid, character } = await authedUserWithCharacter()
  const cpOld = (await loadState(env, user.token, sid)).serverCheckpoint
  // claim a new session (old one revoked); the pending op keeps the checkpoint
  // issued under the previous session - same owner, same character
  const sid2 = await claimSession(env, user.token, { buildId: BUILD })
  const w = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: cpOld.checkpointId, elapsedMonotonicMs: 500 },
    buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
  expect(w.body.committedRevision).toBe(1)

  // heartbeat-issued checkpoints are valid save anchors too; the offset is
  // derived from the committed cutoff so the write lands deterministically
  // ahead of the stored watermark
  const hb = await rpc(env, user.token, 'heartbeat_session', { p_session_id: sid2 })
  expect(hb.body.status).toBe('OK')
  const hbAnchorMs = Date.parse(hb.body.checkpoint.anchorAt)
  const hbElapsed = Date.parse(w.body.progressionCutoffAt) - hbAnchorMs + 1_000
  const wHb = await writeSave(env, user.token, {
    sessionId: sid2, expectedRevision: 1, payload: buildSavePayload(character),
    mutationId: randomUUID(),
    timeCheckpoint: { checkpointId: hb.body.checkpoint.checkpointId, elapsedMonotonicMs: hbElapsed },
    buildId: BUILD,
  })
  expect(wHb.body.status).toBe('COMMITTED')
  expect(wHb.body.committedRevision).toBe(2)
})

// ---------------------------------------------------------------------------
// load_game_state lifecycle
// ---------------------------------------------------------------------------

test('load: NO_CHARACTER -> UNINITIALIZED -> SAVE_READY -> INCOMPATIBLE/DELETED', async () => {
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })

  // no character yet
  const s0 = await loadState(env, user.token, sid)
  expect(s0.status).toBe('NO_CHARACTER')

  // created but no save
  const character = await provisionCharacter(env, user.token, sid)
  const s1 = await loadState(env, user.token, sid)
  expect(s1.status).toBe('CHARACTER_UNINITIALIZED')
  expect(s1.character.id).toBe(character.id)
  expect(s1.serverCheckpoint.checkpointId).toBeTruthy()

  // committed save -> ready + server checkpoint returned each load
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(s1.serverCheckpoint, 20), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
  const s2 = await loadState(env, user.token, sid)
  expect(s2.status).toBe('SAVE_READY')
  expect(s2.save.saveRevision).toBe(1)
  expect(s2.save.schemaVersion).toBe(87)
  expect(s2.save.progressionCutoffAt).toBeTruthy()
  expect(s2.save.payload.version).toBe(87)
  expect(s2.serverCheckpoint.checkpointId).toBeTruthy()

  // incompatible schema row -> INCOMPATIBLE with classified reason
  await pg.query(`update public.character_saves set schema_version = 40 where character_id = $1`, [character.id])
  const s3 = await loadState(env, user.token, sid)
  expect(s3.status).toBe('INCOMPATIBLE')
  expect(s3.reason).toBe('incompatible-schema')
  expect(s3.save.schemaVersion).toBe(40)

  // recovery write over an incompatible row uses normal CAS (expected=current)
  const cp4 = s3.serverCheckpoint
  const wRecover = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: s3.save.saveRevision,
    payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp4, 50), buildId: BUILD,
  })
  expect(wRecover.body.status).toBe('COMMITTED')

  // deleted character -> terminal state
  await pg.query(`update public.characters set deleted_at = now() where id = $1`, [character.id])
  const s5 = await loadState(env, user.token, sid)
  expect(s5.status).toBe('CHARACTER_DELETED')
})

// ---------------------------------------------------------------------------
// protocol gating + revoke
// ---------------------------------------------------------------------------

test('guards: legacy-minted session (no protocol) cannot reach guarded ops', async () => {
  const { user, character } = await authedUserWithCharacter()
  // one active session per user: retire the provisioned claim first
  await pg.query(`update public.account_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [user.userId])
  // operator-seeded session with no admitted protocol (as if minted by the
  // retired one-arg overload)
  const stale = await pg.query(
    `insert into public.account_sessions(user_id, device_label, protocol_version, build_id)
       values ($1, 'legacy-mint', null, null) returning id`,
    [user.userId],
  )
  const staleSid = stale.rows[0].id
  const ls = await rpc(env, user.token, 'load_game_state', { p_session_id: staleSid })
  expect(ls.body.code).toBe('28000')
  expect(ls.body.message).toBe('SESSION_PROTOCOL_OUTDATED')
  const cp = (await loadState(env, user.token, await claimSession(env, user.token, { buildId: BUILD }))).serverCheckpoint
  const w = await writeSave(env, user.token, {
    sessionId: staleSid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(w.body.code).toBe('28000')
  const hb = await rpc(env, user.token, 'heartbeat_session', { p_session_id: staleSid })
  expect(hb.body.code).toBe('28000')
  // revoke remains reachable so stale sessions can always be cleaned up
  const rev = await rpc(env, user.token, 'revoke_current_session', { p_session_id: staleSid })
  expect(rev.body.status).toBe('REVOKED')
  const gone = await pg.query(`select revoked_at is not null as r from public.account_sessions where id=$1`, [staleSid])
  expect(gone.rows[0].r).toBe(true)
})

// ---------------------------------------------------------------------------
// direct-table / old-overload / view attacks (checkbox 6)
// ---------------------------------------------------------------------------

test('attacks: direct saves mutation denied under anon key, anon user, registered user', async () => {
  const { user, sid, character } = await authedUserWithCharacter('anonymous')
  const cp = (await loadState(env, user.token, sid)).serverCheckpoint
  const w = await writeSave(env, user.token, {
    sessionId: sid, expectedRevision: 0, payload: buildSavePayload(character),
    mutationId: randomUUID(), timeCheckpoint: checkpointArg(cp, 10), buildId: BUILD,
  })
  expect(w.body.status).toBe('COMMITTED')
  const registered = await createRegisteredUser(env, pg)

  const principals: Array<[string, string | null]> = [
    ['anon-key-only', null],
    ['anonymous-user', user.token],
    ['registered-user', registered.token],
  ]
  const before = await saveRow(pg, character.id)
  const receiptsBefore = (await receiptRows(pg, user.userId)).length
  const garbage = '{"injected":"direct"}'

  for (const [label, token] of principals) {
    // direct insert/update/delete/select on character_saves
    const ins = await rest(env, token, 'POST', `/character_saves`, {
      character_id: character.id, user_id: user.userId, schema_version: 87, payload: { hacked: true },
    })
    expect(ins.status, `${label} insert`).toBeGreaterThanOrEqual(400)
    const patch = await rest(env, token, 'PATCH', `/character_saves?character_id=eq.${character.id}`, {
      payload: { hacked: true },
    })
    expect(patch.status, `${label} patch`).toBeGreaterThanOrEqual(400)
    const del = await rest(env, token, 'DELETE', `/character_saves?character_id=eq.${character.id}`)
    expect(del.status, `${label} delete`).toBeGreaterThanOrEqual(400)
    const sel = await rest(env, token, 'GET', `/character_saves?character_id=eq.${character.id}`)
    expect(sel.status === 200 && Array.isArray(sel.body) && sel.body.length === 0
      ? true : sel.status >= 400, `${label} select leaked rows: ${sel.status}`).toBe(true)

    // authority tables + config + inventory view are not reachable
    for (const table of ['save_mutation_receipts', 'time_checkpoints', 'backend_config']) {
      const t = await rest(env, token, 'GET', `/${table}?limit=1`)
      const denied = t.status >= 400 || (t.status === 200 && t.body.length === 0)
      expect(denied, `${label} ${table} read`).toBe(true)
    }
    const view = await rest(env, token, 'GET', `/save_inventory_compatibility?limit=1`)
    expect(view.status >= 400 || (view.status === 200 && view.body.length === 0),
      `${label} inventory view`).toBe(true)

    // retired overloads are gone (PostgREST: function not found)
    const oldClaim = await rpc(env, token, 'claim_active_session', { p_device_label: 'legacy' })
    expect(oldClaim.status, `${label} old claim overload`).toBe(404)
    const oldCreate = await rpc(env, token, 'create_character', {
      p_session_id: randomUUID(), p_roll_id: randomUUID(), p_name: 'zz',
      p_talent_ids: ['x'], p_mortal_basic_skill_id: 'tram',
      p_initial_save: {}, p_schema_version: 87,
    })
    expect(oldCreate.status, `${label} old create overload`).toBe(404)

    // internal helpers are not callable
    const helper = await rpc(env, token, '_lock_caller_profile', {})
    expect(helper.status, `${label} helper`).toBeGreaterThanOrEqual(400)
    expect(helper.body?.status).not.toBe('COMMITTED')
  }

  // zero mutation proof: bytes, revision, receipts identical
  const after = await saveRow(pg, character.id)
  expect(after.save_revision).toBe(before.save_revision)
  expect(after.payload_bytes).toBe(before.payload_bytes)
  expect(after.progression_cutoff_at).toEqual(before.progression_cutoff_at)
  expect(await receiptRows(pg, user.userId)).toHaveLength(receiptsBefore)
  expect(JSON.stringify(after.payload)).not.toContain('hacked')
  expect(garbage).toBeTruthy() // marker retention for readability
})

test('attacks: {} via retired create overload impossible; new create writes no save row', async () => {
  const user = await createRegisteredUser(env, pg)
  const sid = await claimSession(env, user.token, { buildId: BUILD })
  const character = await provisionCharacter(env, user.token, sid)
  // the metadata-only overload left no fabricated save row behind
  expect(await saveRow(pg, character.id)).toBeNull()
  const s = await loadState(env, user.token, sid)
  expect(s.status).toBe('CHARACTER_UNINITIALIZED')
})
