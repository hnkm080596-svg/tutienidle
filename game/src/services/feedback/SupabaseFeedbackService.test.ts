// BETA-FINAL PR13 / spec B7 - the Supabase feedback adapter, verified
// against the RPC contract with a stubbed transport. Asserts:
//   - submit() sends the guarded contract (session + idempotency key + report)
//   - ACCEPTED/RATE_LIMITED/REJECTED map onto the B7 result union
//   - auth-invalid and transport failures map to session-revoked/unavailable
//   - an identical retry surfaces the same reportId (idempotent delivery)
import { describe, expect, it } from 'vitest'
import { SupabaseFeedbackService } from './SupabaseFeedbackService'
import { LocalFeedbackService } from './FeedbackService'
import { SupabaseHttpError } from '../supabase/SupabaseHttp'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { validateFeedbackDraft } from '@/shared/feedback/FeedbackDraft'
import type { FeedbackDraft } from '@/shared/feedback/FeedbackDraft'
import type { BuildIdentity } from '@/shared/build/BuildIdentity'

const config: SupabaseConfig = { url: 'https://example.supabase.co', anonKey: 'anon' }

const BUILD: BuildIdentity = {
  productName: 'tutienidle',
  appVersion: '0.0.0',
  buildId: 'beta-test-build',
  gitSha: 'abc1234',
  saveSchemaVersion: 87,
  backendEnvironment: 'staging',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-30T00:00:00Z',
}

const BINDING = { sessionId: 'sess-1', accessToken: 'tok-1' }

function draft(): FeedbackDraft {
  const result = validateFeedbackDraft({
    category: 'bug',
    description: 'The merge gate stays open after defeat.',
    steps: 'fight, win, exit',
    route: 'home',
    context: { saveRevision: 3, diagnosticReportId: 'rep-1' },
    build: BUILD,
  })
  if (!result.ok) throw new Error(`fixture draft invalid: ${result.code}`)
  return result.draft
}

function serviceWith(
  request: (path: string, init?: RequestInit) => Promise<unknown>,
  binding = BINDING as { sessionId: string; accessToken: string } | null,
) {
  return new SupabaseFeedbackService(config, {
    resolveBinding: async () => binding,
    request: async (_c, path, init) => request(path, init),
  })
}

describe('SupabaseFeedbackService.submit', () => {
  it('sends the guarded contract and maps ACCEPTED to a reportId', async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = []
    const service = serviceWith(async (path, init) => {
      calls.push({ path, body: JSON.parse(String(init?.body)) })
      return { status: 'ACCEPTED', reportId: 'rep-abc', alreadyAccepted: false }
    })
    const result = await service.submit(draft(), 'key-1')
    expect(result).toEqual({ status: 'accepted', reportId: 'rep-abc', alreadyAccepted: false })
    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.path).toBe('/rest/v1/rpc/submit_feedback')
    expect(call.body.p_session_id).toBe('sess-1')
    expect(call.body.p_idempotency_key).toBe('key-1')
    const report = call.body.p_report as Record<string, unknown>
    expect(report.category).toBe('bug')
    expect((report.clientBuild as Record<string, unknown>).buildId).toBe('beta-test-build')
    expect(report).not.toHaveProperty('ownerUserId')
    expect(report).not.toHaveProperty('sessionId')
  })

  it('returns the same reportId for an identical retried submit', async () => {
    const service = serviceWith(async () => ({
      status: 'ACCEPTED',
      reportId: 'rep-stable',
      alreadyAccepted: true,
    }))
    const first = await service.submit(draft(), 'key-1')
    const second = await service.submit(draft(), 'key-1')
    expect(first.status).toBe('accepted')
    expect(second.status).toBe('accepted')
    if (first.status === 'accepted' && second.status === 'accepted') {
      expect(second.reportId).toBe(first.reportId)
      expect(second.alreadyAccepted).toBe(true)
    }
  })

  it('maps REJECTED, RATE_LIMITED and unknown bodies', async () => {
    const rejected = serviceWith(async () => ({ status: 'REJECTED', code: 'FEEDBACK_TOO_LARGE', detail: 'x' }))
    expect(await rejected.submit(draft(), 'k')).toEqual({
      status: 'invalid',
      code: 'FEEDBACK_TOO_LARGE',
      detail: 'x',
    })
    const limited = serviceWith(async () => ({ status: 'RATE_LIMITED', retryAfterSeconds: 120 }))
    expect(await limited.submit(draft(), 'k')).toEqual({ status: 'rate-limited', retryAfterSeconds: 120 })
    const weird = serviceWith(async () => ({ unexpected: true }))
    expect((await weird.submit(draft(), 'k')).status).toBe('invalid')
  })

  it('maps session/auth failures to session-revoked and transport to unavailable', async () => {
    const revoked = serviceWith(async () => {
      throw new SupabaseHttpError(400, { message: 'session revoked', code: '28000' })
    })
    expect(await revoked.submit(draft(), 'k')).toEqual({ status: 'session-revoked' })

    const unauth = serviceWith(async () => {
      throw new SupabaseHttpError(401, { message: 'AUTH_REQUIRED' })
    })
    expect(await unauth.submit(draft(), 'k')).toEqual({ status: 'session-revoked' })

    const outdated = serviceWith(async () => {
      throw new SupabaseHttpError(400, { message: 'SESSION_PROTOCOL_OUTDATED' })
    })
    expect(await outdated.submit(draft(), 'k')).toEqual({
      status: 'unavailable',
      code: 'PROTOCOL_OUTDATED',
      retryable: false,
    })

    const down = serviceWith(async () => {
      throw new TypeError('fetch failed')
    })
    const unavailableSubmit = await down.submit(draft(), 'k')
    expect(unavailableSubmit.status).toBe('unavailable')

    const server500 = serviceWith(async () => {
      throw new SupabaseHttpError(503, {})
    })
    expect((await server500.submit(draft(), 'k')).status).toBe('unavailable')
  })

  it('reports unavailable when no session binding resolves', async () => {
    const service = serviceWith(async () => ({ status: 'ACCEPTED', reportId: 'x' }), null)
    const result = await service.submit(draft(), 'k')
    expect(result).toEqual({ status: 'unavailable', code: 'AUTH_EXPIRED', retryable: true })
  })

  it('rejects an invalid draft before any transport call', async () => {
    let called = false
    const service = serviceWith(async () => {
      called = true
      return { status: 'ACCEPTED', reportId: 'x' }
    })
    const bad = { ...draft(), description: '   ' }
    const result = await service.submit(bad, 'k')
    expect(result.status).toBe('invalid')
    expect(called).toBe(false)
  })
})

describe('LocalFeedbackService', () => {
  it('honestly reports unavailable with no intake endpoint', async () => {
    const result = await new LocalFeedbackService().submit(draft(), 'k')
    expect(result.status).toBe('unavailable')
  })
})
