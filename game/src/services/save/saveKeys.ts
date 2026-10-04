import { readSupabaseSession } from '../supabase/SupabaseSession'

// Spec F8 (locked 2026-09-16): every save-storage key is namespaced to the
// authenticated account - 'tien-hiep-idle-save:<accountId>' - with a shared
// 'guest' slot for unauthenticated play. One resolver feeds every storage
// path; nothing templates the key inline.
export const GUEST_ACCOUNT_ID = 'guest'

const SAVE_KEY_BASE = 'tien-hiep-idle-save'
const BACKUP_KEY_BASE = 'tien-hiep-idle-save-backup'
const REVISION_KEY_BASE = 'tien-hiep-idle-save-revision'
// Shared handoff channel (two writers, one consumer): importSaveRaw and
// the remote-pull seam both bind {normalizedRaw, discardedEquipmentCount}
// to the save bytes they write; loadGame consumes it once on a byte-exact
// match. The 'import' key base predates the pull writer - renaming the
// stored key would orphan markers already written, so the name stays and
// the contract lives here.
const IMPORT_HANDOFF_KEY_BASE = 'tien-hiep-idle-import-discarded-equipment-count'
// B1-C (PR4) - durable remote-mode envelopes: one slot per
// {environment/project fingerprint, account} triple. The identity inside
// each envelope (environment/user/character) isolates cross-account and
// cross-environment reads; the environment segment in the key keeps two
// supabase projects sharing one browser profile from clobbering each
// other's pending work.
export const JOURNAL_KEY_BASE = 'tien-hiep-idle-save-journal'
export const ACKED_KEY_BASE = 'tien-hiep-idle-save-acked'
export const QUARANTINE_KEY_BASE = 'tien-hiep-idle-save-quarantine'

// Bound at authenticate time (App.vue onAuthenticated). null = fall back to
// the stored Supabase session (survives reload inside the same tab via
// sessionStorage), then to guest. Any future logout path MUST call
// setSaveAccountId(null) - the stored session is cleared separately.
let explicitAccountId: string | null = null

export function setSaveAccountId(accountId: string | null): void {
  explicitAccountId = accountId
}

export function resolveSaveAccountId(): string {
  if (explicitAccountId !== null) return explicitAccountId
  // Node/vitest has no sessionStorage - resolver stays pure there.
  if (typeof sessionStorage === 'undefined') return GUEST_ACCOUNT_ID
  const session = readSupabaseSession()
  // B1.5 - the Supabase userId scopes BOTH registered and guest
  // identities (anonymous guests hold a real auth.users row); only a
  // session without one (mock mode) shares the 'guest' slot.
  return session?.userId ?? GUEST_ACCOUNT_ID
}

export function accountIdForSession(session: { mode: string; userId?: string; loginId?: string }): string {
  // B1.5 - prefer the Supabase userId whenever the session carries one
  // (guest anonymous sessions included).
  if (session.userId) return session.userId
  if (session.mode !== 'login' && session.mode !== 'register') return GUEST_ACCOUNT_ID
  return session.loginId ?? GUEST_ACCOUNT_ID
}

export function resolveSaveKey(): string { return `${SAVE_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveBackupKey(): string { return `${BACKUP_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveRevisionKey(): string { return `${REVISION_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveImportHandoffKey(): string { return `${IMPORT_HANDOFF_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolvePendingSaveKey(environmentId: string): string {
  return `${JOURNAL_KEY_BASE}:${environmentId}:${resolveSaveAccountId()}`
}
export function resolveAckedSaveKey(environmentId: string): string {
  return `${ACKED_KEY_BASE}:${environmentId}:${resolveSaveAccountId()}`
}
export function resolveQuarantineSaveKey(environmentId: string): string {
  return `${QUARANTINE_KEY_BASE}:${environmentId}:${resolveSaveAccountId()}`
}

/** True for any B1-C durable envelope key bound to `accountId` (or the
 *  currently resolved account when omitted), under any environment. */
export function isSaveEnvelopeKey(key: string, accountId = resolveSaveAccountId()): boolean {
  if (!key.endsWith(`:${accountId}`)) return false
  return key.startsWith(`${JOURNAL_KEY_BASE}:`)
    || key.startsWith(`${ACKED_KEY_BASE}:`)
    || key.startsWith(`${QUARANTINE_KEY_BASE}:`)
}

/** All B1-C envelope keys for an account (default: the resolved one),
 *  any environment. Bounded localStorage scan - storage access failures
 *  degrade to []. */
export function listSaveEnvelopeKeys(storage?: Storage, accountId = resolveSaveAccountId()): string[] {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return []
  const keys: string[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && isSaveEnvelopeKey(key, accountId)) keys.push(key)
    }
  } catch {
    // storage denied -> nothing to enumerate
  }
  return keys
}
