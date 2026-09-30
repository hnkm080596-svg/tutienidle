// BETA-FINAL PR13 / spec B7 - the narrow feedback intake contract.
//
// One method: submit(draft, idempotencyKey). The draft is a validated
// FeedbackDraft (see src/shared/feedback/FeedbackDraft.ts); the idempotency
// key is a per-draft uuid minted by the dialog so a retried submit after a
// lost response resolves to the same server report instead of a duplicate.
//
// The result union is the B7 surface: accepted(reportId, alreadyAccepted) |
// invalid | rate-limited | unavailable | session-revoked. 'unavailable'
// covers transport, server-error and configuration failures; a submission
// that never reached the server leaves the draft intact for retry or local
// export - nothing is ever claimed saved.

import type { FeedbackDraft } from '@/shared/feedback/FeedbackDraft'

export type FeedbackSubmitResult =
  | { status: 'accepted'; reportId: string; alreadyAccepted: boolean }
  | { status: 'invalid'; code: string; detail?: string }
  | { status: 'rate-limited'; retryAfterSeconds?: number }
  | { status: 'unavailable'; code: string; retryable: boolean; message?: string }
  | { status: 'session-revoked' }

export interface FeedbackService {
  submit(draft: FeedbackDraft, idempotencyKey: string): Promise<FeedbackSubmitResult>
}

/**
 * Mock/local-mode stand-in: there is no intake endpoint, so the service
 * honestly reports unavailable. Local export (dialog-side) keeps working -
 * no silent fallback, no fabricated acceptance.
 */
export class LocalFeedbackService implements FeedbackService {
  async submit(_draft: FeedbackDraft, _idempotencyKey: string): Promise<FeedbackSubmitResult> {
    return { status: 'unavailable', code: 'LOCAL_BACKEND', retryable: false }
  }
}

/** Fail-closed service for a fatal backend composition. */
export class UnavailableFeedbackService implements FeedbackService {
  constructor(private readonly message: string) {}

  async submit(_draft: FeedbackDraft, _idempotencyKey: string): Promise<FeedbackSubmitResult> {
    return { status: 'unavailable', code: 'CONFIGURATION_ERROR', retryable: false, message: this.message }
  }
}

export function newFeedbackIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Coarse runtime context providers bound by App once the coordinator and
 *  cloud-save coordinator exist (same late-binding idiom as the diagnostic
 *  recorder). Everything here is optional - the draft carries only fields
 *  that actually resolved. */
export interface FeedbackEnvironmentProviders {
  route?: () => string | undefined
  saveRevision?: () => number | undefined
}

let boundProviders: FeedbackEnvironmentProviders = {}

export function bindFeedbackProviders(providers: FeedbackEnvironmentProviders): void {
  boundProviders = providers
}

export function unbindFeedbackProviders(): void {
  boundProviders = {}
}

export function getFeedbackProviders(): FeedbackEnvironmentProviders {
  return boundProviders
}

// Same module-binding idiom as the diagnostic recorder: App binds the real
// service once at setup; tests bind a fake. The dialog reads through
// getFeedbackService() and degrades to export-only when nothing is bound.
let boundService: FeedbackService | null = null

export function bindFeedbackService(service: FeedbackService): FeedbackService {
  boundService = service
  return service
}

export function unbindFeedbackService(): void {
  boundService = null
}

export function getFeedbackService(): FeedbackService | null {
  return boundService
}
