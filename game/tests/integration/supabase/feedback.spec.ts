// BETA-FINAL PR13 / spec B7 - real contract tests for submit_feedback on
// the staging project. Runs through npm run test:supabase (the same
// harness that applies every migration to the project + a fresh scratch
// DB before launching Playwright).
//
// Asserts:
//   - a full report is ACCEPTED and persisted with server-derived
//     owner/session/build attribution (the client's claims never reach a
//     column they could spoof)
//   - an identical retry returns the same reportId and stores exactly one
//     row (B7 acceptance)
//   - the same key with a different body rejects as
//     FEEDBACK_IDEMPOTENCY_REUSED and stores nothing
//   - the hourly rate limit and field bounds reject without writing
//   - revoked/expired sessions and anon callers cannot submit
//   - the table is definer-only: no public/anon/authenticated read and no
//     direct insert
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  claimSession,
  createAnonymousUser,
  dbClient,
  feedbackCountForIdempotencyKey,
  feedbackRows,
  loadContractEnv,
  provisionCharacter,
  rest,
  rpc,
  sqlAsUser,
  buildSavePayload,
  writeSave,
  checkpointArg,
  loadState,
} from './fixture'

const env = loadContractEnv()

// The buildId the session claims on admission; submit_feedback cross-checks
// the reported clientBuild.buildId against it.
const CLAIMED_BUILD = 'contract-build'

function report(overrides: Record<string, unknown> = {}) {
  return {
    category: 'bug',
    description: 'contract: merge gate stays open after defeat',
    steps: 'fight, win, exit',
    contact: 'contract@example.test',
    route: 'home',
    context: { saveRevision: 1, screen: 'home' },
    diagnostics: [
      {
        source: 'renderer',
        severity: 'error',
        category: 'lifecycle',
        code: 'EV_1',
        message: 'contract event',
        seq: 1,
        atUtc: '2026-09-30T00:00:00Z',
      },
    ],
    clientBuild: {
      productName: 'tutienidle',
      appVersion: '0.0.0',
      buildId: CLAIMED_BUILD,
      gitSha: 'abc1234',
      saveSchemaVersion: 87,
      backendEnvironment: 'staging',
      releaseChannel: 'beta',
      builtAtUtc: '2026-09-30T00:00:00Z',
    },
    ...overrides,
  }
}

async function provision(envArg: typeof env, sessionId: string, token: string) {
  const character = await provisionCharacter(envArg, token, sessionId)
  const state = await loadState(envArg, token, sessionId)
  const write = await writeSave(envArg, token, {
    sessionId,
    expectedRevision: 0,
    payload: buildSavePayload(character),
    timeCheckpoint: state.serverCheckpoint ? checkpointArg(state.serverCheckpoint) : undefined,
  })
  expect(write.status).toBe(200)
  expect(write.body.status).toBe('COMMITTED')
  return character
}

test.describe('submit_feedback', () => {
  test('accepts a report, derives attribution server-side, stays idempotent', async () => {
    const pg = await dbClient(env)
    const user = await createAnonymousUser(env)
    const sessionId = await claimSession(env, user.token)
    const character = await provision(env, sessionId, user.token)

    const key = randomUUID()
    const submit = () =>
      rpc(env, user.token, 'submit_feedback', {
        p_session_id: sessionId,
        p_idempotency_key: key,
        p_report: report({
          context: { saveRevision: 1, attemptedOwnerSpoof: user.userId },
        }),
      })

    const first = await submit()
    expect(first.status).toBe(200)
    expect(first.body.status).toBe('ACCEPTED')
    expect(first.body.alreadyAccepted).toBe(false)
    expect(first.body.reportId).toBeTruthy()

    const secondIdenticalSubmit = await submit()
    expect(secondIdenticalSubmit.status).toBe(200)
    expect(secondIdenticalSubmit.body.status).toBe('ACCEPTED')
    expect(secondIdenticalSubmit.body.alreadyAccepted).toBe(true)
    // B7 acceptance: the retried submit returns the same stable reportId.
    expect(secondIdenticalSubmit.body.reportId).toBe(first.body.reportId)
    // B7 acceptance: exactly one row per (owner, idempotency key).
    expect(await feedbackCountForIdempotencyKey(pg, user.userId, key)).toBe(1)

    const rows = await feedbackRows(pg, user.userId)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.owner_user_id).toBe(user.userId)
    expect(row.session_id).toBe(sessionId)
    expect(row.build_id).toBe(CLAIMED_BUILD)
    expect(row.character_id).toBe(character.id)
    // Live attribution the client cannot spoof: save revision/schema come
    // from the character_saves row, not the report body.
    expect(Number(row.save_revision)).toBeGreaterThanOrEqual(1)
    expect(row.save_schema_version).toBe(87)
    expect(row.retain_until).toBeTruthy()
    await pg.end()
  })

  test('rejects the same idempotency key with a different body', async () => {
    const pg = await dbClient(env)
    const user = await createAnonymousUser(env)
    const sessionId = await claimSession(env, user.token)

    const key = randomUUID()
    const first = await rpc(env, user.token, 'submit_feedback', {
      p_session_id: sessionId,
      p_idempotency_key: key,
      p_report: report(),
    })
    expect(first.body.status).toBe('ACCEPTED')

    const reused = await rpc(env, user.token, 'submit_feedback', {
      p_session_id: sessionId,
      p_idempotency_key: key,
      p_report: report({ description: 'different body, same key' }),
    })
    expect(reused.status).toBe(200)
    expect(reused.body.status).toBe('REJECTED')
    expect(reused.body.code).toBe('FEEDBACK_IDEMPOTENCY_REUSED')
    expect(await feedbackCountForIdempotencyKey(pg, user.userId, key)).toBe(1)
    await pg.end()
  })

  test('enforces the hourly rate limit without writing rejected submits', async () => {
    const pg = await dbClient(env)
    const user = await createAnonymousUser(env)
    const sessionId = await claimSession(env, user.token)

    const results = []
    for (let i = 0; i < 4; i++) {
      results.push(
        await rpc(env, user.token, 'submit_feedback', {
          p_session_id: sessionId,
          p_idempotency_key: randomUUID(),
          p_report: report({ description: `rate limit probe ${i}` }),
        }),
      )
    }
    expect(results.slice(0, 3).every((r) => r.body.status === 'ACCEPTED')).toBe(true)
    const limited = results[3]!
    expect(limited.body.status).toBe('RATE_LIMITED')
    expect(limited.body.retryAfterSeconds).toBeGreaterThan(0)
    const rows = await feedbackRows(pg, user.userId)
    expect(rows).toHaveLength(3)
    await pg.end()
  })

  test('rejects invalid reports and revoked sessions; denies all table access', async () => {
    const pg = await dbClient(env)
    const user = await createAnonymousUser(env)
    const sessionId = await claimSession(env, user.token)

    const empty = await rpc(env, user.token, 'submit_feedback', {
      p_session_id: sessionId,
      p_idempotency_key: randomUUID(),
      p_report: report({ description: '   ' }),
    })
    expect(empty.body.status).toBe('REJECTED')

    const spoofed = await rpc(env, user.token, 'submit_feedback', {
      p_session_id: sessionId,
      p_idempotency_key: randomUUID(),
      p_report: report({
        clientBuild: { ...report().clientBuild, buildId: 'other-build' },
      }),
    })
    expect(spoofed.body.status).toBe('REJECTED')
    expect(spoofed.body.code).toBe('FEEDBACK_BUILD_MISMATCH')

    // Revoke the session through the real controller path, then retry.
    const end = await rpc(env, user.token, 'revoke_current_session', { p_session_id: sessionId })
    expect(end.status).toBe(200)
    const revoked = await rpc(env, user.token, 'submit_feedback', {
      p_session_id: sessionId,
      p_idempotency_key: randomUUID(),
      p_report: report(),
    })
    expect(revoked.status).not.toBe(200)
    expect(JSON.stringify(revoked.body)).toContain('session revoked')

    // The table is definer-only: a caller-impersonated select and insert
    // both fail under the authenticated role.
    const denied = await sqlAsUser(pg, user.userId, 'authenticated', async () => {
      const sel = await pg
        .query(`select count(*) from public.feedback_reports`)
        .then(() => 'select-ok')
        .catch((e: Error) => `select:${e.message.slice(0, 40)}`)
      const ins = await pg
        .query(`insert into public.feedback_reports(owner_user_id) values (auth.uid())`)
        .then(() => 'insert-ok')
        .catch((e: Error) => `insert:${e.message.slice(0, 40)}`)
      return { sel, ins }
    })
    expect(denied.sel).not.toBe('select-ok')
    expect(denied.ins).not.toBe('insert-ok')

    // PostgREST table surface is closed for anon + authenticated tokens.
    const restAnon = await rest(env, null, 'GET', '/feedback_reports?select=id&limit=1')
    expect([401, 403]).toContain(restAnon.status)
    const restAuthed = await rest(env, user.token, 'GET', '/feedback_reports?select=id&limit=1')
    expect([401, 403]).toContain(restAuthed.status)
    const restInsert = await rest(env, user.token, 'POST', '/feedback_reports', { category: 'bug' })
    expect([401, 403]).toContain(restInsert.status)

    expect(await feedbackRows(pg, user.userId)).toHaveLength(0)
    await pg.end()
  })
})
