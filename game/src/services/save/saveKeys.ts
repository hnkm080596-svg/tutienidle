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
// Sync base (F1 lineage anchor): the remote save_revision the local
// lineage last descended from - set when a pull lands or a push commits.
// Remote rev != base means the remote row moved under us (divergence).
const SYNC_BASE_KEY_BASE = 'tien-hiep-idle-save-sync-base'
export function resolveSyncBaseKey(): string { return `${SYNC_BASE_KEY_BASE}:${resolveSaveAccountId()}` }
export function resolveImportHandoffKey(): string { return `${IMPORT_HANDOFF_KEY_BASE}:${resolveSaveAccountId()}` }

// The local CAS lineage counter (9.11), read through the shared key
// resolver - every writer (LocalCloudSaveService.save, the login
// reconcile, importSaveRaw) must bump it through the same convention.
export function readLocalSaveRevision(): number {
  const value = Number(localStorage.getItem(resolveRevisionKey()))
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

// F1 lineage anchor moved here from LocalCloudSaveService so the leaf key
// module owns every account-scoped key read - SaveSystem.deleteSave needs
// the base for the reset tombstone ceiling without a cloudSave import.
export function readSyncBaseRevision(): number | null {
  const raw = localStorage.getItem(resolveSyncBaseKey())
  const value = raw === null ? Number.NaN : Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function writeSyncBaseRevision(revision: number): void {
  localStorage.setItem(resolveSyncBaseKey(), String(revision))
}

// Reset tombstone (F-BX-24): deleteSave writes it before the slot clears.
// remoteCeiling is the highest remote save_revision this account's local
// lineage could legitimately know - max(local revision, adopted sync
// base). A remote row at or below the ceiling still carries the deleted
// lineage, so the login reconcile suppresses the pull arm; a row above it
// moved after the reset on another device and reconciles normally.
const TOMBSTONE_KEY_BASE = 'tien-hiep-idle-save-reset'
export function resolveTombstoneKey(): string { return `${TOMBSTONE_KEY_BASE}:${resolveSaveAccountId()}` }

export interface SaveResetTombstone { remoteCeiling: number }

export function writeResetTombstone(remoteCeiling: number): void {
  try {
    localStorage.setItem(resolveTombstoneKey(), JSON.stringify({ remoteCeiling }))
  } catch {
    // Best-effort: a lost tombstone degrades to pre-fix resurrection, it
    // must never fail the delete itself.
  }
}

export function readResetTombstone(): SaveResetTombstone | null {
  try {
    const raw = localStorage.getItem(resolveTombstoneKey())
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { remoteCeiling?: unknown }
    return typeof parsed.remoteCeiling === 'number' &&
      Number.isSafeInteger(parsed.remoteCeiling) &&
      parsed.remoteCeiling >= 0
      ? { remoteCeiling: parsed.remoteCeiling }
      : null
  } catch {
    return null
  }
}

export function clearResetTombstone(): void {
  try {
    localStorage.removeItem(resolveTombstoneKey())
  } catch {
    // Auxiliary write - a stale tombstone only suppresses rows at/below
    // its recorded ceiling, it cannot corrupt a newer remote.
  }
}
