import { requestSupabase } from '../supabase/SupabaseHttp'
import { readSupabaseSession, resolveSupabaseSession } from '../supabase/SupabaseSession'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { CURRENT_SAVE_VERSION, inspectLocalSave } from '../save/SaveSystem'
import { validateGameSaveShape } from '../save/saveShapeValidation'
import { resolveRevisionKey, resolveSaveKey } from '../save/saveKeys'
import { readLocalSaveRevision } from './LocalCloudSaveService'

export type RemoteSyncOutcome = 'pulled' | 'pushed' | 'skipped' | 'unavailable'

interface CharacterRow { id: string }
interface RemoteSaveRow {
  payload: unknown
  save_revision: number
  updated_at: string
}

/**
 * Spec F8 - login-time newest-wins reconciliation between the remote
 * character_saves row and the account-scoped local slot. This is a boot
 * pre-load step, NOT the AR-15 remote write adapter: per-save writes stay
 * local. Every authenticated request passes session.accessToken - without
 * it the RLS policies silently return empty/denied results.
 *
 * Remote wins when its updated_at is newer than local lastSavedAt AND the
 * payload validates (version + shape) - a pulled payload is normalized
 * exactly like loadGame() before hitting storage. An unusable/missing
 * remote payload counts as "no remote" -> local pushes instead. Any thrown
 * or HTTP error maps to 'unavailable'; the boot caller logs and proceeds
 * on the local slot.
 */
export async function syncRemoteSaveOnLogin(config: SupabaseConfig): Promise<RemoteSyncOutcome> {
  try {
    // Cheap checks on the stored session first - a guest or userId-less
    // session can never sync, so don't spend a token-refresh round-trip
    // on it (and a failed refresh would wrongly clear a live guest login).
    const stored = readSupabaseSession()
    if (!stored || stored.mode === 'guest' || !stored.userId) return 'skipped'

    const session = await resolveSupabaseSession(config)
    if (!session || session.mode === 'guest' || !session.userId) return 'skipped'

    const characters = await requestSupabase<CharacterRow[]>(
      config,
      `/rest/v1/characters?select=id&user_id=eq.${session.userId}&limit=1`,
      {},
      session.accessToken,
    )
    const characterId = characters[0]?.id
    if (!characterId) return 'skipped'

    const rows = await requestSupabase<RemoteSaveRow[]>(
      config,
      `/rest/v1/character_saves?select=payload,save_revision,updated_at&character_id=eq.${characterId}&limit=1`,
      {},
      session.accessToken,
    )
    const remoteRow = rows[0]
    const remoteShape = remoteRow ? validateGameSaveShape(remoteRow.payload) : null
    const remoteUsable = remoteShape !== null && remoteShape.ok ? remoteShape : null
    const remoteUpdatedMs = remoteRow ? Date.parse(remoteRow.updated_at) : Number.NaN

    // F2 / INV-F-19 - pure inspect, never the consuming loadGame():
    // this preflight only compares timestamps, so it must not eat the
    // one-shot import-handoff marker before the owner boot load.
    const local = inspectLocalSave()
    const localSave = local.status === 'ok' ? local.save : null
    const localLastSavedAt = localSave?.player.lastSavedAt ?? Number.NEGATIVE_INFINITY

    if (remoteUsable && remoteUpdatedMs > localLastSavedAt && remoteRow) {
      // Revision-first, same convention as LocalCloudSaveService: a crash
      // between the two writes leaves new-revision + old-save -> the next
      // CAS mismatches and the coordinator resyncs - never a stale-
      // revision split.
      localStorage.setItem(resolveRevisionKey(), String(remoteRow.save_revision))
      localStorage.setItem(resolveSaveKey(), JSON.stringify(remoteUsable.normalizedSave))
      return 'pulled'
    }

    if (!localSave) return 'skipped'

    // Remote absent/unusable/older - local is the freshest copy.
    // updated_at is sent explicitly: the column default only applies on
    // INSERT, so every later UPDATE would keep the insert timestamp and
    // newest-wins would go stale after the first push.
    await requestSupabase<unknown>(
      config,
      '/rest/v1/character_saves',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          character_id: characterId,
          user_id: session.userId,
          schema_version: CURRENT_SAVE_VERSION,
          save_revision: readLocalSaveRevision(),
          payload: localSave,
          updated_at: new Date().toISOString(),
        }),
      },
      session.accessToken,
    )
    return 'pushed'
  } catch {
    return 'unavailable'
  }
}
