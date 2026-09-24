// HIDDEN-C - Nghich Chu Thien (Reverse Heavenly Circuit), the hidden body
// of foundation_establishment (design 2026-09-23 sec.12, master spec
// sec.8.3). Discoverable only after normal Chu Thien is 36/36 AND the
// hidden lineage is active - without an open lineage the continuation
// shows no hint anywhere (sec.12.1). Each attempt consumes authored
// Tinh Hoa Phap The + Linh Thach (both curves increasing); success
// chance is monotonically decreasing with LOCKED endpoints (first
// advancement 100%, last 1%, canonical values not rounded UI strings);
// failure consumes full cost and increments the CURRENT-level pity; at
// the authored pity threshold the next attempt is a guaranteed - still
// fully paid - success; pity persists through save/reload, never
// transfers to the next level, and freezes with the rest of hidden
// progress when the lineage closes. At 36/36 the Foundation hidden body
// completes via completeHiddenBody (+10pp five-main-stat cap).
//
// Registration: GameManagerRealmAdvanceOps imports this module (the ops
// seam owns the attempt command and the post-invest discovery check);
// the validator + finished reader self-register at module load, so a
// persisted nghich_chu_tian payload can never pass save validation
// silently when this file is absent.
import {
  HIDDEN_MECHANIC_NGHICH_CHU_TIAN,
} from '../../../data/realm/HiddenBodyRealms'
import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '../../../data/realm/ZhouTian'
import { SPIRIT_STONE_MATERIAL_ID } from '../../material/SpiritStoneMaterial'
import type { MaterialBag } from '../../material/MaterialBag'
import type { PlayerData } from '../../player/Player'
import {
  canProgressHiddenBody,
  completeHiddenBody,
  discoverHiddenRealm,
  getRealmHiddenState,
  HIDDEN_MECHANIC_FINISHED_READERS,
} from './HiddenLineage'
import { HIDDEN_MECHANIC_STATE_VALIDATORS, type RealmHiddenMechanicState } from './HiddenPerfection'
import { isDaiChuThienReached } from '../body/ZhouTianChapter'

const REALM_ID = 'foundation_establishment'
export const NGHICH_CHU_TIAN_TOTAL_STEPS = 36

/** BALANCE - Tinh Hoa Phap The cost of the attempt INTO level
 * `completed+1` (0-indexed by current level). Increasing; retune freely. */
export function nghichChuTianEssenceCost(level: number): number {
  return 40 + level * 10
}

/** BALANCE - Ha pham Linh Thach cost of the same attempt. Increasing;
 * retune freely (design names the currency only). */
export function nghichChuTianStoneCost(level: number): number {
  return 1 + Math.floor(level / 3)
}

/** Canonical success chance of the attempt INTO level `level+1`
 * (0-indexed). Monotonically decreasing, endpoints locked by sec.12.3:
 * level 0 -> 1.0 (first advancement 100%), level 35 -> 0.01 (final 1%).
 * BALANCE - the intermediate curve is linear pending the balance pass;
 * gameplay math MUST read these canonical values, never rounded UI text. */
export function nghichChuTianSuccessChance(level: number): number {
  return Math.max(0.01, 1 - level * (0.99 / 35))
}

/** BALANCE - attempts at level `level` before the next attempt is a
 * guaranteed success (sec.12.5). Increasing; retune freely. */
export function nghichChuTianPityLimit(level: number): number {
  return 3 + Math.floor(level / 4)
}

/** Persisted mechanic payload (master spec sec.8.3 pinned fields). */
export interface NghichChuTianMechanic extends RealmHiddenMechanicState {
  kind: typeof HIDDEN_MECHANIC_NGHICH_CHU_TIAN
  /** Completed Nghich advancements (0..36). */
  completed: number
  /** Pity attempts recorded per advancement level; index = the level the
   * attempts were spent on. Never transfers forward (sec.12.5). */
  pityByLevel: number[]
  /** Discovered and unfrozen while progressing; false once complete. */
  active: boolean
}

export function getNghichChuTianMechanic(player: PlayerData): NghichChuTianMechanic | undefined {
  const mechanic = getRealmHiddenState(player, REALM_ID)?.mechanic
  if (mechanic?.kind !== HIDDEN_MECHANIC_NGHICH_CHU_TIAN) {
    return undefined
  }
  return mechanic as NghichChuTianMechanic
}

/** Discovery gate (sec.12.1): in foundation_establishment, open lineage,
 * the realm is the strict-prefix target, AND normal Chu Thien is 36/36. */
export function isNghichChuTianEligible(player: PlayerData): boolean {
  return (
    player.realmId === REALM_ID &&
    canProgressHiddenBody(player, REALM_ID) &&
    isDaiChuThienReached(player)
  )
}

/** UI reveal gate: the discovered UNFROZEN record OR present eligibility
 * (covers saves where 36/36 landed before the record wrote - e.g. a
 * completion that raced discovery). Without an active lineage this is
 * always false - a frozen record is inert progress, and sec.12.1 shows
 * no hint of the continuation while the lineage is closed. */
export function isNghichChuTianRevealed(player: PlayerData): boolean {
  const record = getRealmHiddenState(player, REALM_ID)
  return (
    (record?.discovered === true && record.frozen !== true) ||
    isNghichChuTianEligible(player)
  )
}

/** Sole discovery+init writer for the Nghich continuation: writes the
 * realm discovery record and installs the mechanic payload. Idempotent;
 * gated by isNghichChuTianEligible so a closed lineage or incomplete
 * normal track can never manufacture it. */
export function maybeDiscoverNghichChuTian(player: PlayerData): NghichChuTianMechanic | undefined {
  const existing = getNghichChuTianMechanic(player)
  if (existing !== undefined) {
    return existing
  }

  if (!isNghichChuTianEligible(player)) {
    return undefined
  }

  const entry = discoverHiddenRealm(player, REALM_ID)
  if (entry === undefined) {
    return undefined
  }

  const mechanic: NghichChuTianMechanic = {
    kind: HIDDEN_MECHANIC_NGHICH_CHU_TIAN,
    completed: 0,
    pityByLevel: [],
    active: true,
  }
  entry.mechanic = mechanic
  return mechanic
}

export type NghichChuTianAttemptOutcome =
  | 'ineligible' // gated out (wrong realm/lineage/incomplete normal track)
  | 'complete' // already 36/36
  | 'insufficient' // cannot pay the authored attempt cost
  | 'success'
  | 'failure'

export interface NghichChuTianAttemptResult {
  outcome: NghichChuTianAttemptOutcome
  /** Nghich level after resolution (== completed count). */
  level: number
  /** Pity recorded against the level just attempted (post-write). */
  pity: number
  /** The canonical success chance that was rolled against (0 when the
   * attempt never reached the roll). */
  chance: number
}

/** One Nghich attempt: consume both authored costs IN FULL, resolve the
 * canonical per-level roll (pity threshold short-circuits the RNG), and
 * write pity/level. The ops surface owns materialBag plumbing; this
 * function owns the whole rule so a caller cannot skip the cost or the
 * pity write. Idempotent-safe on replayed calls: costs are checked
 * against CURRENT bag state every time. */
export function attemptNghichChuTian(
  player: PlayerData,
  materialBag: Pick<MaterialBag, 'getAmount' | 'has' | 'remove'>,
): NghichChuTianAttemptResult {
  const mechanic = getNghichChuTianMechanic(player) ?? maybeDiscoverNghichChuTian(player)

  // Completion reports first: a finished Nghich record outlives its
  // eligibility (the strict prefix moves on) and still reads 'complete'.
  const finishedLevel = mechanic?.completed ?? 0
  if (mechanic !== undefined && finishedLevel >= NGHICH_CHU_TIAN_TOTAL_STEPS) {
    return { outcome: 'complete', level: finishedLevel, pity: 0, chance: 0 }
  }

  if (mechanic === undefined || !mechanic.active || !isNghichChuTianEligible(player)) {
    return { outcome: 'ineligible', level: finishedLevel, pity: 0, chance: 0 }
  }

  const level = mechanic.completed

  const essenceCost = nghichChuTianEssenceCost(level)
  const stoneCost = nghichChuTianStoneCost(level)

  if (
    !materialBag.has(ZHOU_TIAN_CURRENCY_MATERIAL_ID, essenceCost) ||
    !materialBag.has(SPIRIT_STONE_MATERIAL_ID, stoneCost)
  ) {
    return {
      outcome: 'insufficient',
      level,
      pity: mechanic.pityByLevel[level] ?? 0,
      chance: nghichChuTianSuccessChance(level),
    }
  }

  // Sec.12.4 - failure consumes the FULL cost; success (incl. the
  // guaranteed pity attempt) consumes it too. Both removals are
  // preflighted above so partial debit cannot happen.
  materialBag.remove(ZHOU_TIAN_CURRENCY_MATERIAL_ID, essenceCost)
  materialBag.remove(SPIRIT_STONE_MATERIAL_ID, stoneCost)

  const chance = nghichChuTianSuccessChance(level)
  const pityLimit = nghichChuTianPityLimit(level)
  const pity = mechanic.pityByLevel[level] ?? 0
  const success = pity >= pityLimit || Math.random() < chance

  if (success) {
    mechanic.completed = level + 1
    // Current-level pity resets by construction: the counter lives on
    // the attempted level and never transfers (sec.12.5); the recorded
    // count stays as the level's fail history.
    if (mechanic.completed >= NGHICH_CHU_TIAN_TOTAL_STEPS) {
      mechanic.active = false
      completeHiddenBody(player, REALM_ID)
    }
    return { outcome: 'success', level: mechanic.completed, pity, chance }
  }

  // Dense write: pityByLevel must NEVER hold holes - JSON.stringify
  // serializes a sparse array's holes as null and the persisted-state
  // validator (integer entries) would then reject the whole save.
  while (mechanic.pityByLevel.length <= level) {
    mechanic.pityByLevel.push(0)
  }
  mechanic.pityByLevel[level] = pity + 1
  return { outcome: 'failure', level, pity: pity + 1, chance }
}

// Persisted-shape validator (HIDDEN_MECHANIC_STATE_VALIDATORS contract):
// kind already dispatched to this entry by the skeleton; the payload
// fields are checked here. Integers, ranges, and the active flag.
HIDDEN_MECHANIC_STATE_VALIDATORS[HIDDEN_MECHANIC_NGHICH_CHU_TIAN] = (
  payload: RealmHiddenMechanicState,
  emit: (issue: string) => void,
): void => {
  const { completed, pityByLevel, active } = payload

  if (!Number.isInteger(completed) || (completed as number) < 0 || (completed as number) > NGHICH_CHU_TIAN_TOTAL_STEPS) {
    emit(`mechanic.completed phai la so nguyen trong 0..${NGHICH_CHU_TIAN_TOTAL_STEPS}`)
  }

  if (!Array.isArray(pityByLevel)) {
    emit('mechanic.pityByLevel phai la array')
  } else if (pityByLevel.length > NGHICH_CHU_TIAN_TOTAL_STEPS) {
    emit(`mechanic.pityByLevel dai qua ${NGHICH_CHU_TIAN_TOTAL_STEPS}`)
  } else {
    for (const [index, count] of pityByLevel.entries()) {
      if (!Number.isInteger(count) || (count as number) < 0) {
        emit(`mechanic.pityByLevel[${index}] phai la so nguyen khong am`)
      }
    }
  }

  if (typeof active !== 'boolean') {
    emit('mechanic.active phai la boolean')
  }
}

// Frozen-completion reader (HIDDEN_MECHANIC_FINISHED_READERS contract):
// the mechanism is finished exactly when all 36 advancements completed.
HIDDEN_MECHANIC_FINISHED_READERS[HIDDEN_MECHANIC_NGHICH_CHU_TIAN] = (
  payload: NonNullable<RealmHiddenMechanicState>,
): boolean => (payload as NghichChuTianMechanic).completed >= NGHICH_CHU_TIAN_TOTAL_STEPS
