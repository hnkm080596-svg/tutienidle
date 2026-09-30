import type { OnlineSessionController } from '../services/session/OnlineSessionController'
import type { CloudSaveWriteResult } from '../services/cloudSave/CloudSaveService'

/**
 * The ONE online-admission authority, lazily bound by App.vue at startup.
 * A save writer anywhere in the tree (settings panel, flush paths) must
 * report its outcome to this owner: 'ok' renews the health lease, a
 * failed/conflicted write pauses or terminates admission. Callers hold
 * no reference to App's setup scope, so the singleton is bound on mount
 * rather than injected through props.
 */
let bound: OnlineSessionController | null = null

export function bindOnlineAuthority(authority: OnlineSessionController): OnlineSessionController {
  bound = authority
  return authority
}

/** App teardown disposes its authority - unbind so a remounted App (HMR)
 *  rebinds a fresh instance instead of late saves observing the dead one. */
export function unbindOnlineAuthority(authority: OnlineSessionController): void {
  if (bound === authority) {
    bound = null
  }
}

/** Report a save outcome to the bound authority (no-op pre-bind / local
 *  teardown). The controller itself ignores failures when no remote
 *  authority is configured, so local-mode callers may report freely. */
export function observeAuthoritySaveResult(result: CloudSaveWriteResult): void {
  bound?.observeSaveResult(result)
}

/** The bound authority itself - B1.9's logout orchestration joins its ONE
 *  save queue for the flush leg instead of inventing a second write path. */
export function resolveOnlineAuthority(): OnlineSessionController | null {
  return bound
}
