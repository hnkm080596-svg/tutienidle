// Quan The (Lay Khi Quan The) - the qi_refining hidden-body mechanism
// (design 2026-09-23 sec.10, master spec sec.8.2). Once an active hidden
// lineage player in qi_refining completes the normal Meridian chapter
// (Bat Mach 8/8), Quan The becomes actionable: the first FINAL post-
// modifier cultivation gain thereafter discovers the hidden continuation
// and activates persistent diversion - every later gain banks into
// quanTheProgress instead of realm cultivation until the required
// threshold. Overflow lands 100% on normal cultivation within the same
// settlement (sec.10.4 - nothing disappears). At threshold: active=false,
// bodyCompleted (which IS thienDiaChiKieu per sec.10.2 - no second flag),
// +10pp five-main-stat cap via the completed count.
//
// No MP gate, no material, no battle/daily/RNG requirement, no new
// currency (sec.10.3). Persists through save/reload like every hidden
// record; offline cultivation settles through the same addCultivation
// routing so the divert applies identically.
//
// Mechanism-owned persisted state: realms.qi_refining.mechanic =
//   { kind: 'quan_the', active, progress, required }
//
// Module-load registration (imported for side effects wherever the seam
// must be live - CultivationSystem pulls it so the diverter exists
// before the first gain routes): diverter into CultivationDiversion,
// validator into HIDDEN_MECHANIC_STATE_VALIDATORS, finished reader into
// HIDDEN_MECHANIC_FINISHED_READERS.

import { HIDDEN_MECHANIC_QUAN_THE } from '../../../data/realm/HiddenBodyRealms'
import { MERIDIANS } from '../../../data/realm/Meridians'
import { registerFinalCultivationDiversion } from '../../cultivation/CultivationDiversion'
import type { FinalCultivationGainPlayer } from '../../cultivation/CultivationDiversion'
import { HIDDEN_MECHANIC_STATE_VALIDATORS } from './HiddenPerfection'
import type { HiddenPerfectionState, RealmHiddenState } from './HiddenPerfection'
import {
  canProgressHiddenBody,
  completeHiddenBody,
  discoverHiddenRealm,
  HIDDEN_MECHANIC_FINISHED_READERS,
  type HiddenLineagePlayer,
} from './HiddenLineage'

// ---------------------------------------------------------------------------
// Authored constant - BALANCE-marked (design sec.10.5; ~2 mid-late
// qi_refining levels of cultivation at current curves).

export const QUAN_THE_REQUIRED_CULTIVATION = 50_000

const QI_REALM_ID = 'qi_refining'

// ---------------------------------------------------------------------------
// Mechanism-owned persisted payload

export interface QuanTheMechanic {
  kind: typeof HIDDEN_MECHANIC_QUAN_THE
  active: boolean
  progress: number
  required: number
}

/** The diverter's typed view over the seam's deliberately narrow player
 * shape - the mechanism knows callers pass real PlayerData. */
type QuanThePlayer = FinalCultivationGainPlayer & {
  hiddenPerfection?: HiddenPerfectionState
  bodyProgression: { meridian: { openedIds: string[] } }
}

export function getQuanTheMechanic(
  player: Pick<QuanThePlayer, 'hiddenPerfection'>,
): QuanTheMechanic | undefined {
  const payload = player.hiddenPerfection?.realms[QI_REALM_ID]?.mechanic
  if (payload === undefined || payload.kind !== HIDDEN_MECHANIC_QUAN_THE) {
    return undefined
  }
  return payload as unknown as QuanTheMechanic
}

/** sec.10.2/10.4: actionable = lineage open + strict prefix + authored
 * normal Meridian prerequisite (Bat Mach 8/8). */
export function isQuanTheActionable(player: QuanThePlayer): boolean {
  if (player.realmId !== QI_REALM_ID) {
    return false
  }
  if (!canProgressHiddenBody(player, QI_REALM_ID)) {
    return false
  }
  // Canonical-set membership, not a count: a legacy save can carry a
  // retired ninth id, and the authored gate is the current 8/8 set.
  return MERIDIANS.every((meridian) =>
    player.bodyProgression.meridian.openedIds.includes(meridian.id),
  )
}

// ---------------------------------------------------------------------------
// Diverter (registered at module load)

registerFinalCultivationDiversion((player, amount) => {
  const data = player as QuanThePlayer
  // A non-positive gain can bank nothing - discovery belongs to the
  // first ACTIONABLE gain (spec sec.8.2), so it must not fire here.
  if (!isQuanTheActionable(data) || amount <= 0) {
    return amount
  }

  const state = data.hiddenPerfection
  if (state === undefined) {
    return amount
  }
  let record = state.realms[QI_REALM_ID] as RealmHiddenState | undefined

  if (record === undefined) {
    // The first actionable gain IS the discovery moment (spec sec.8.2 -
    // "when Lay Khi Quan The first becomes actionable").
    record = discoverHiddenRealm(data as unknown as HiddenLineagePlayer, QI_REALM_ID)
    if (record === undefined) {
      return amount
    }
    record.mechanic = {
      kind: HIDDEN_MECHANIC_QUAN_THE,
      active: true,
      progress: 0,
      required: QUAN_THE_REQUIRED_CULTIVATION,
    } satisfies QuanTheMechanic
  }

  const mechanic = getQuanTheMechanic(data)
  if (mechanic === undefined || mechanic.active !== true) {
    return amount
  }

  // Bank up to the remaining requirement; the rest overflows into normal
  // realm cultivation inside the same settlement (sec.10.4). The max(0)
  // clamp keeps an over-reported progress from violating the diverter's
  // 0 <= landed <= amount contract.
  const banked = Math.min(amount, Math.max(0, mechanic.required - mechanic.progress))
  mechanic.progress += banked

  if (mechanic.progress >= mechanic.required) {
    mechanic.active = false
    completeHiddenBody(data as unknown as HiddenLineagePlayer, QI_REALM_ID)
  }

  return amount - banked
})

// ---------------------------------------------------------------------------
// Persisted-state validator + finished reader

HIDDEN_MECHANIC_STATE_VALIDATORS[HIDDEN_MECHANIC_QUAN_THE] = (payload, emit) => {
  const mechanic = payload as unknown as QuanTheMechanic
  if (typeof mechanic.active !== 'boolean') {
    emit('active phai la boolean')
  }
  if (typeof mechanic.progress !== 'number' || mechanic.progress < 0) {
    emit('progress phai la number >= 0')
  }
  if (typeof mechanic.required !== 'number' || mechanic.required <= 0) {
    emit('required phai la number > 0')
  }
}

HIDDEN_MECHANIC_FINISHED_READERS[HIDDEN_MECHANIC_QUAN_THE] = (payload) => {
  const mechanic = payload as unknown as QuanTheMechanic
  return mechanic.progress >= mechanic.required
}
