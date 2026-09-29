import { requestSupabase } from '../supabase/SupabaseHttp'
import { readSupabaseSession, resolveSupabaseSession } from '../supabase/SupabaseSession'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { CURRENT_SAVE_VERSION, inspectLocalSave, type GameSave } from '../save/SaveSystem'
import { validateGameSaveShape } from '../save/saveShapeValidation'
import {
  isSaveAcceptable,
  staticSaveAcceptanceCatalogs,
} from '../save/saveAcceptance'
import { resolveImportHandoffKey, resolveRevisionKey, resolveSaveKey } from '../save/saveKeys'
import {
  readLocalSaveRevision,
  readSyncBaseRevision,
  writeSyncBaseRevision,
} from './LocalCloudSaveService'

export type RemoteSyncOutcome = 'pulled' | 'pushed' | 'skipped' | 'unavailable' | 'conflict'

/**
 * Order-insensitive structural equality for save payloads: Postgres jsonb
 * reorders object keys, so a byte compare cannot prove a remote row and a
 * local save carry identical content.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      out[key] = sortKeysDeep(record[key])
    }
    return out
  }
  return value
}

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
    const catalogs = staticSaveAcceptanceCatalogs()
    const remoteRow = rows[0]
    const remoteShape = remoteRow ? validateGameSaveShape(remoteRow.payload) : null
    // Preflight parity: a payload the boot restore would reject is 'no
    // remote' here - otherwise newest-wins resurrects it on every login
    // and the delete recovery can never converge (empty local loses to
    // any remote timestamp). The predicate is the SAME function the
    // restore preflight calls (services/save/saveAcceptance.ts) over
    // the SAME catalog ids, so the two acceptance gates cannot drift -
    // every preflight class is covered, not just the boundary contract.
    const remoteUsable =
      remoteShape !== null &&
      remoteShape.ok &&
      isSaveAcceptable(remoteShape.normalizedSave as GameSave, catalogs)
        ? remoteShape
        : null
    const remoteUpdatedMs = remoteRow ? Date.parse(remoteRow.updated_at) : Number.NaN

    // F2 / INV-F-19 - pure inspect, never the consuming loadGame():
    // this preflight only compares timestamps, so it must not eat the
    // one-shot import-handoff marker before the owner boot load.
    const local = inspectLocalSave()
    // Symmetric gate (qa-authority-01 + F-INT-02): a local payload the
    // boot restore would reject counts as 'no local' - it must not
    // push its poison over a usable remote, and its timestamp must not
    // shield it from a pull-heal. The same predicate and catalogs the
    // remote side uses.
    const localSave =
      local.status === 'ok' && isSaveAcceptable(local.save, catalogs) ? local.save : null
    const localLastSavedAt = localSave?.player.lastSavedAt ?? Number.NEGATIVE_INFINITY
    const localRevision = localSave ? readLocalSaveRevision() : 0

    // INFRA-01 — ordering authority is save_revision, NOT timestamps:
    // revision is a shared clock-free sequence (the pull below adopts
    // remoteRow.save_revision into local storage, so the counter rides
    // the remote row's lineage across devices), while updated_at was
    // written by whichever client's wall clock pushed last — two machine
    // clocks compared directly regressed newer saves whenever one device
    // ran ahead. Timestamps survive only as the same-revision fork
    // tie-break (two devices that each reached rev N independently).
    const remoteAhead =
      remoteRow !== undefined &&
      (remoteRow.save_revision > localRevision ||
        (remoteRow.save_revision === localRevision && remoteUpdatedMs > localLastSavedAt))

    // F1 — lineage divergence gate. Per-device counters cannot order
    // lineages that forked: a stale device whose counter ran far ahead of
    // the remote's still compares ">" and would push its stale lineage
    // over a newer one. The sync base (LocalCloudSaveService) records the
    // remote revision the local lineage last descended from, adopted on
    // every successful pull/push:
    //   base === remote rev -> same lineage point; newest-wins as before.
    //   base !== remote rev -> the remote row moved under us:
    //     * identical normalized content -> one save seen twice; adopt
    //       the base and let the normal comparison run.
    //     * local never advanced past base and remote moved ahead ->
    //       adopt: pulling loses nothing this device uniquely holds.
    //     * local moved past base (diverged) or remote rewound below it
    //       -> 'conflict': hold BOTH sides untouched so a user decision -
    //       never a silent pick - resolves the fork. Conflicting writes
    //       nothing; the remote row and local slot stay as they are.
    //   base absent -> migration (first sync under base tracking): same-
    //     content adopts; differing content runs the legacy newest-wins
    //     path once, except a stale-side push (local revision ahead while
    //     the remote row is clock-newer - the carried F1 scenario) holds
    //     as 'conflict' instead of regressing a newer remote lineage.
    if (remoteUsable && remoteRow && localSave) {
      const base = readSyncBaseRevision()
      const sameContent =
        canonicalJson(remoteUsable.normalizedSave) === canonicalJson(localSave)

      if (base !== null && base !== remoteRow.save_revision) {
        if (sameContent || (localRevision === base && remoteAhead)) {
          writeSyncBaseRevision(remoteRow.save_revision)
        } else {
          return 'conflict'
        }
      } else if (base === null) {
        if (sameContent) {
          writeSyncBaseRevision(remoteRow.save_revision)
        } else if (
          localRevision > remoteRow.save_revision &&
          remoteUpdatedMs > localLastSavedAt
        ) {
          return 'conflict'
        }
      }
    }

    if (remoteUsable && remoteAhead && remoteRow) {
      // Save-first (F5): a crash after the save write but before the
      // revision write leaves old-revision + new-save -> the next login
      // still sees the remote row ahead and re-pulls, self-healing to the
      // same bytes. The reverse order leaves new-revision + old-save ->
      // remoteAhead is false and the stale local save pushes right back
      // over the remote row that was just pulled.
      const pulledRaw = JSON.stringify(remoteUsable.normalizedSave)
      localStorage.setItem(resolveSaveKey(), pulledRaw)
      // Sync base adopts the pulled remote revision before the local
      // counter - a torn pair (new base, old revision) self-heals through
      // the same-content adoption above on the next login.
      writeSyncBaseRevision(remoteRow.save_revision)
      localStorage.setItem(resolveRevisionKey(), String(remoteRow.save_revision))
      // Discard-notice parity with importSaveRaw: equipment dropped by
      // normalization on the pull seam reports through the same one-shot
      // handoff channel - bound to the exact stored bytes so a stale
      // marker can never misattribute. A marker-write failure degrades
      // to a lost count, never a failed pull (loadGame's own marker-read
      // policy).
      if (remoteUsable.discardedEquipmentCount > 0) {
        try {
          localStorage.setItem(
            resolveImportHandoffKey(),
            JSON.stringify({
              normalizedRaw: pulledRaw,
              discardedEquipmentCount: remoteUsable.discardedEquipmentCount,
            }),
          )
        } catch {
          // Auxiliary channel - losing the count must not fail the pull.
        }
      }
      return 'pulled'
    }

    if (!localSave) return 'skipped'

    // Remote absent/unusable/behind - local is the freshest copy.
    // The pushed revision never regresses below remote+1: overwriting a
    // stale-but-higher-revision row with a smaller number would flip the
    // shared sequence and poison every later comparison. When the remote
    // row was ahead (or unusable), we adopt remote+1 into local storage
    // after a successful write so the sequences stay one lineage.
    const pushRevision = Math.max(localRevision, (remoteRow?.save_revision ?? 0) + 1)

    const body = JSON.stringify({
      character_id: characterId,
      user_id: session.userId,
      schema_version: CURRENT_SAVE_VERSION,
      save_revision: pushRevision,
      payload: localSave,
      updated_at: new Date().toISOString(),
    })

    if (remoteRow) {
      // INFRA-02 — CAS push: PATCH guarded by the revision we just read.
      // Two live sessions on one account can no longer blind-upsert over
      // each other; the loser sees 0 rows updated and reports
      // 'unavailable' (the caller logs and continues on the local slot -
      // the next login re-compares fresh and converges).
      const updated = await requestSupabase<RemoteSaveRow[]>(
        config,
        `/rest/v1/character_saves?character_id=eq.${characterId}&save_revision=eq.${remoteRow.save_revision}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body,
        },
        session.accessToken,
      )
      if (updated.length === 0) {
        return 'unavailable'
      }
    } else {
      // No remote row yet - plain insert. A concurrent first-push loses to
      // the PK conflict (throws -> 'unavailable') and pulls on next login.
      await requestSupabase<unknown>(
        config,
        '/rest/v1/character_saves',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body,
        },
        session.accessToken,
      )
    }

    if (pushRevision !== localRevision) {
      // Adopt the pushed revision locally so the shared sequence stays
      // aligned (same convention as the pull path above).
      try {
        localStorage.setItem(resolveRevisionKey(), String(pushRevision))
      } catch {
        // Revision-adoption failure: next save CAS-mismatches and the
        // coordinator resyncs - degraded, never inconsistent.
      }
    }
    // The committed remote row IS the new lineage base - a lost write
    // here leaves base behind, which the same-content adoption repairs
    // on the next login (local bytes still equal the row we just wrote).
    try {
      writeSyncBaseRevision(pushRevision)
    } catch {
      // Auxiliary write - degraded to a later adoption, never to a fork.
    }
    return 'pushed'
  } catch {
    return 'unavailable'
  }
}
