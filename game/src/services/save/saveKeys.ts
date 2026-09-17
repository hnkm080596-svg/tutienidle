import { readSupabaseSession } from '../supabase/SupabaseSession'

// Spec F8 (locked 2026-09-16): every save-storage key is namespaced to the
// authenticated account - 'tien-hiep-idle-save:<accountId>' - with a shared
// 'guest' slot for unauthenticated play. One resolver feeds every storage
// path; nothing templates the key inline.
export const GUEST_ACCOUNT_ID = 'guest'

const SAVE_KEY_BASE = 'tien-hiep-idle-save'
const BACKUP_KEY_BASE = 'tien-hiep-idle-save-backup'
const REVISION_KEY_BASE = 'tien-hiep-idle-save-revision'
const IMPORT_HANDOFF_KEY_BASE = 'tien-hiep-idle-import-discarded-equipment-count'

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
  return session?.mode !== 'guest' && session?.userId ? session.userId : GUEST_ACCOUNT_ID
}

export function accountIdForSession(session: { mode: string; userId?: string; loginId?: string }): string {
  if (session.mode !== 'login' && session.mode !== 'register') return GUEST_ACCOUNT_ID
  return session.userId ?? session.loginId ?? GUEST_ACCOUNT_ID
}

export function resolveSaveKey(): string { return `${SAVE_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveBackupKey(): string { return `${BACKUP_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveRevisionKey(): string { return `${REVISION_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveImportHandoffKey(): string { return `${IMPORT_HANDOFF_KEY_BASE}:${resolveSaveAccountId()}` }
