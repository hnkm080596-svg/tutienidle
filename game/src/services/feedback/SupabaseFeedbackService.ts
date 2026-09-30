// BETA-FINAL PR13 / spec B7 - Supabase adapter for the feedback intake.
//
// Submits through the guarded submit_feedback RPC only - never a direct
// table write (feedback_reports has no grants). Session binding is resolved
// per call through resolveSupabaseSession so a rotated/refreshed credential
// is always the one used; auth-invalid responses map to 'session-revoked'
// and every other failure to 'unavailable' - the service never fabricates an
// acceptance and never throws into the dialog.

import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { resolveSupabaseSession } from '../supabase/SupabaseSession'
import {
  serializeFeedbackReport,
  validateFeedbackDraft,
  type FeedbackDraft,
} from '@/shared/feedback/FeedbackDraft'
import type { FeedbackService, FeedbackSubmitResult } from './FeedbackService'

interface FeedbackBinding {
  sessionId: string
  accessToken: string
}

interface SubmitFeedbackResponse {
  status?: string
  code?: string
  detail?: string
  reportId?: string
  alreadyAccepted?: boolean
  retryAfterSeconds?: number
}

export interface SupabaseFeedbackDeps {
  resolveBinding?: () => Promise<FeedbackBinding | null>
  request?: (
    config: SupabaseConfig,
    path: string,
    init?: RequestInit,
    accessToken?: string,
  ) => Promise<unknown>
}

export class SupabaseFeedbackService implements FeedbackService {
  private readonly config: SupabaseConfig
  private readonly resolveBinding: () => Promise<FeedbackBinding | null>
  private readonly request: NonNullable<SupabaseFeedbackDeps['request']>

  constructor(config: SupabaseConfig, deps: SupabaseFeedbackDeps = {}) {
    this.config = config
    this.resolveBinding =
      deps.resolveBinding ??
      (async () => {
        const session = await resolveSupabaseSession(this.config)
        return session
          ? { sessionId: session.sessionId, accessToken: session.accessToken }
          : null
      })
    this.request = deps.request ?? requestSupabase
  }

  async submit(draft: FeedbackDraft, idempotencyKey: string): Promise<FeedbackSubmitResult> {
    const validation = validateFeedbackDraft({
      category: draft.category,
      description: draft.description,
      steps: draft.steps,
      contact: draft.contact,
      route: draft.route,
      context: draft.context,
      diagnostics: draft.diagnostics,
      build: draft.build,
    })
    if (!validation.ok) {
      return { status: 'invalid', code: validation.code, detail: validation.detail }
    }

    // The contract returns a result union, never throws: a refresh that
    // fails transports-side (offline, GoTrue 5xx) is 'unavailable', not an
    // exception the caller has to catch.
    let binding: FeedbackBinding | null = null
    try {
      binding = await this.resolveBinding()
    } catch {
      return { status: 'unavailable', code: 'NETWORK_UNAVAILABLE', retryable: true }
    }
    if (!binding) {
      return { status: 'unavailable', code: 'AUTH_EXPIRED', retryable: true }
    }

    try {
      const res = (await this.request(
        this.config,
        '/rest/v1/rpc/submit_feedback',
        {
          method: 'POST',
          body: JSON.stringify({
            p_session_id: binding.sessionId,
            p_idempotency_key: idempotencyKey,
            p_report: serializeFeedbackReport(validation.draft),
          }),
        },
        binding.accessToken,
      )) as SubmitFeedbackResponse
      return mapResponse(res)
    } catch (error) {
      return mapError(error)
    }
  }
}

function mapResponse(res: SubmitFeedbackResponse): FeedbackSubmitResult {
  switch (res.status) {
    case 'ACCEPTED':
      if (typeof res.reportId === 'string' && res.reportId.length > 0) {
        return { status: 'accepted', reportId: res.reportId, alreadyAccepted: res.alreadyAccepted === true }
      }
      return { status: 'invalid', code: 'UNRECOGNIZED_RESPONSE', detail: 'accepted without reportId' }
    case 'RATE_LIMITED':
      return {
        status: 'rate-limited',
        retryAfterSeconds:
          typeof res.retryAfterSeconds === 'number' ? res.retryAfterSeconds : undefined,
      }
    case 'REJECTED':
      return { status: 'invalid', code: res.code ?? 'FEEDBACK_INVALID', detail: res.detail }
    default:
      return { status: 'invalid', code: 'UNRECOGNIZED_RESPONSE' }
  }
}

function mapError(error: unknown): FeedbackSubmitResult {
  if (error instanceof SupabaseHttpError) {
    const message = extractMessage(error.payload)
    if (
      message === 'session revoked' ||
      message === 'AUTH_REQUIRED' ||
      error.status === 401 ||
      error.status === 403
    ) {
      return { status: 'session-revoked' }
    }
    if (message === 'SESSION_PROTOCOL_OUTDATED') {
      return { status: 'unavailable', code: 'PROTOCOL_OUTDATED', retryable: false }
    }
    if (error.status === 429) {
      return { status: 'rate-limited' }
    }
    if (error.status >= 500) {
      return { status: 'unavailable', code: 'SERVER_ERROR', retryable: true }
    }
    return { status: 'unavailable', code: 'REQUEST_REJECTED', retryable: true }
  }
  return { status: 'unavailable', code: 'NETWORK_UNAVAILABLE', retryable: true }
}

function extractMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const message = (payload as { message?: unknown }).message
  return typeof message === 'string' ? message : null
}
