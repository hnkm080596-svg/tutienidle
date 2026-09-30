/**
 * B1-D (beta-final PR5) - the result-bearing flush contract shared by the
 * three consumers that must wait for the save queue to drain AND for the
 * remote acknowledgement: normal window close, the updater install path,
 * and logout. The result binds to the flush request id and the admission
 * generation at issue, so a late or forged ack can never satisfy a newer
 * request, and a failed result never reaches the close/install action.
 */
export type FlushResult =
  | { status: 'saved'; requestId: string; generation: number; revision: number }
  | { status: 'blocked'; requestId: string; generation: number; code: string }
  | { status: 'failed'; requestId: string; generation: number; code: string }

/** Main -> renderer: one flush attempt; a retry always mints a new id. */
export interface QuitFlushRequest {
  requestId: string
}

/** Renderer -> main: the settled result of one attempt (FlushResult wire shape). */
export interface QuitFlushResultMessage {
  requestId: string
  generation?: number
  status: 'saved' | 'blocked' | 'failed'
  revision?: number
  code?: string
}

/** Main -> renderer: an attempt failed (bad result or timeout); the user
 *  picks retry / cancel / force-close. NEVER an implicit success. */
export interface QuitFlushFailedNotice {
  requestId: string
  status: string
  code?: string
}
