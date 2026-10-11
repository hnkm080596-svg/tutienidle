// Alchemy (2026-08-25, resource-professions-rework plan sec8) - Dan Phong
// moi: moi dan phuong nhan DUNG mot Linh Thao rieng (co nien dai) +
// Go nhien lieu + Linh Thach. Khong con Recipe/CraftingSystem cho dan.
// gp123 6E: nhien lieu phai CUNG realm + CUNG age voi thao duoc chon.
//
// sec8.2: snapshot recipe/nguyen lieu/level phong luc bat dau; nguyen lieu
// reserve/tru atomically luc start de khong dung mot stack cho nhieu job.
// sec8.3: totalSuccessPercent = herbAgeBasePercent + roomBonus[level];
// guaranteedPills = floor(total/100); extraPillChance = total % 100.

import type { PillBag } from '../pill/PillBag'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { HerbAge } from '../production/ProductionTypes'
import type { ItemQuality } from '../item/ItemQuality'
import { HERB_AGE_BASE_SUCCESS_PERCENT } from '../production/ProductionBalance'
import { rollPillQualityWithHerb } from '../pill/PillQuality'
import { buildProfessionMaterialId } from '../profession/ProfessionMaterial'
import { mulberry32 } from '../production/ProductionBalance'
import { betaRecipeFamilyOfId, scopeHiddenPillFamilyOfId } from '../betaScope'
import { witnessDigest } from '../math/witnessDigest'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'

/** Bien the nguyen lieu cua thao - stack cu the trong Bag. */
export interface AlchemyHerbVariant {
  /** Material id day du (kem hau to nien dai hoac bien the legacy). */
  materialId: string

  /** Khoa tra HERB_AGE_BASE_SUCCESS_PERCENT - truc HerbAge 5 bac (6E C1). */
  age: HerbAge

  /** Nhan hien thi bien the (vd "Bach Nien"). */
  label: string
}

export interface AlchemyRecipe {
  id: string

  /** Dan phuong san xuat (Pill.id). */
  pillId: string

  /** Canh gioi cua dan phuong - nhom UI + gate. */
  realmId: string

  /**
   * Thao DUY NHAT duoc chap nhan (plan sec8.1 - khong cho thay thao khac
   * chi vi cung realm/nien dai). Nguoi choi chon bien the nien dai co
   * san trong Bag.
   */
  herbVariants: readonly AlchemyHerbVariant[]

  herbAmount: number

  /**
   * Realm cua go nhien lieu (gp123 6E) - go phai CUNG realm nay VA
   * CUNG age voi thao duoc chon (resolveFuelWood).
   */
  fuelWoodRealmId: string

  fuelWoodAmount: number

  spiritStoneCost: number

  baseDurationSeconds: number

  /**
   * Nguyen lieu dac biet ngoai thao/go (spec dot-pha-loi-kiep sec4.1b -
   * vd Yeu Dan cua Thong Mach Dan/Truc Co Dan). undefined = recipe
   * generated theo PILL_FAMILIES, khong co nguyen lieu phu.
   */
  specialIngredients?: { materialId: string; amount: number }[]

  /**
   * M10 (ARCH-008) - retired pill family (Hoi Xuan Dan): the recipe stays
   * resolvable so in-flight jobs from old saves settle normally, but a new
   * job is rejected with reason 'retired' and the recipe is hidden from
   * the craft list.
   */
  retired?: boolean

  /**
   * M-F-CEILING - realm this recipe's breakthrough prepares for (e.g.
   * Truc Co Dan tags 'foundation_establishment'). Breakthrough-scoped
   * recipes are suppressed by release policy
   * (isBreakthroughAcquisitionEnabled) while the transition into that
   * realm is closed; untagged recipes are never release-suppressed.
   */
  breakthroughRealmId?: string
}

export interface ActiveAlchemyJob {
  jobId: string

  recipeId: string

  pillId: string

  /** Bien the thao da reserve (snapshot sec8.2). */
  herbMaterialId: string

  startedAtMs: number

  completesAtMs: number

  /** Level Dan Phong luc bat dau - nang cap giua job chi tac dong job ke tiep. */
  roomLevelAtStart: number

  /**
   * QUEUE REWORK (2026-10-11) - a queue entry is one ORDER of
   * `quantity` pills brewed sequentially, per-unit deadline
   * `startedAtMs + (index+1) * perUnitMs` where
   * `perUnitMs = (completesAtMs - startedAtMs) / quantity`. Every unit
   * rolls the authored success split independently at its own deadline.
   * OPTIONAL: records persisted before the rework carry neither field
   * and mean exactly {quantity: 1, unitsDone: 0} - the deadline math
   * defaults them rather than mutating the record, so a legacy job
   * restores verbatim (stamps + legacy digest untouched).
   */
  quantity?: number

  /**
   * Units whose roll already ran and whose pills already delivered
   * (progress = unitsDone/quantity). Persisted because delivery is
   * bookkeeping - a missing counter would re-deliver rolled units.
   * Absent = 0 (see quantity).
   */
  unitsDone?: number

  /**
   * F-ALCH-JOB-FORGE - the reservation witness startJob stamps the
   * same moment it burns the inputs. Settle and save validation replay
   * it: a job that never ran the atomic reserve cannot mint the pill.
   */
  reservation: AlchemyJobReservation
}

/**
 * F-ALCH-JOB-FORGE (qa-fixpoint wave 2) - provenance witness for an
 * in-flight job. The persisted job used to carry only the outcome
 * claim (which pill, when it lands); nothing witnessed that startJob
 * actually reserved the inputs, so a fabricated finished job settled
 * the pill for free. The reservation snapshots exactly what the
 * atomic reserve burned - canonical fuel wood id, the scaled costs,
 * herb + specials, and the cost scale applied - folded with the job
 * identity into one digest. A fabricated job can mimic the shape but
 * cannot name the inputs a real startJob reserved; validation/settle
 * re-derive every field from the save's own recipe and reject
 * (reject-not-clamp: witness-mismatch settles as a failed job, never
 * as a rewritten one). A fully self-consistent forged bundle stays
 * possible - the same-value residual class owned by the future
 * online-authority layer.
 */
export interface AlchemyJobReservation {
  /** Canonical fuel wood id reserved: `<realm>_wood_<age>`. */
  readonly woodId: string

  readonly fuelWoodAmount: number

  /** Spirit stone cost the caller deducted - startJob's own formula. */
  readonly spiritStoneCost: number

  readonly herbAmount: number

  readonly specialIngredients: readonly { materialId: string; amount: number }[]

  /** Cost scale the start applied (talent surcharge snapshot, >= 1). */
  readonly costScale: number

  /** FNV-1a fold over the job identity + every reserved input. */
  readonly digest: number
}

/** Everything the reservation digest binds - job identity plus the
 * reserved inputs, in one fixed order shared by writer and verifier.
 * QUEUE REWORK: batch fields fold in too - `quantity` decides how much
 * the batch reserved and `unitsDone` how much already delivered, so
 * both are mint/refund-relevant. Jobs persisted before the rework
 * (fields absent on the raw save entry) replay under the legacy fold
 * exactly as before - a legacy record IS a one-unit batch. */
export function alchemyJobReservationDigest(
  job: Pick<
    ActiveAlchemyJob,
    'jobId' | 'recipeId' | 'pillId' | 'herbMaterialId' | 'startedAtMs' | 'completesAtMs' | 'roomLevelAtStart'
  > & { quantity?: number; unitsDone?: number },
  reservation: Omit<AlchemyJobReservation, 'digest'>,
): number {
  const batchFields = job.quantity === undefined ? [] : [job.quantity, job.unitsDone ?? 0]

  return witnessDigest([
    job.jobId,
    job.recipeId,
    job.pillId,
    job.herbMaterialId,
    job.startedAtMs,
    job.completesAtMs,
    job.roomLevelAtStart,
    ...batchFields,
    reservation.woodId,
    reservation.fuelWoodAmount,
    reservation.spiritStoneCost,
    reservation.herbAmount,
    reservation.costScale,
    reservation.specialIngredients.map((special) => `${special.materialId}:${special.amount}`).join(','),
  ])
}

/**
 * Replay a job's reservation witness against the authored recipe.
 * Returns the reservation field whose binding fails, 'digest' when
 * the atomic fold mismatches, or null when the reservation replays a
 * producible startJob reserve. `allowedCostScales` narrows the cost
 * scale to the authored producible set when the caller can supply it
 * (save validation); settle passes none and only replays the
 * recipe-derived bindings + digest.
 */
export function verifyAlchemyJobReservation(
  job: Pick<
    ActiveAlchemyJob,
    'jobId' | 'recipeId' | 'pillId' | 'herbMaterialId' | 'startedAtMs' | 'completesAtMs' | 'roomLevelAtStart'
  > & { reservation: unknown },
  recipe: AlchemyRecipe | undefined,
  allowedCostScales?: ReadonlySet<number>,
): string | null {
  const reservation = job.reservation

  if (typeof reservation !== 'object' || reservation === null) {
    return 'reservation'
  }

  const witness = reservation as AlchemyJobReservation

  if (!Number.isFinite(witness.costScale) || witness.costScale <= 0) {
    return 'costScale'
  }

  if (allowedCostScales !== undefined && !allowedCostScales.has(witness.costScale)) {
    return 'costScale'
  }

  // r27-COR-2 + r27-AUT-1: the digest fold reads
  // specialIngredients.map(special => special.materialId) - shape the
  // collection AND each element BEFORE folding so a malformed
  // reservation reports its field instead of throwing through the save
  // validator (which would surface as an uncoded adapter throw and
  // escape the data-refuse classification).
  if (
    !Array.isArray(witness.specialIngredients) ||
    !witness.specialIngredients.every(
      (special) =>
        typeof special === 'object' &&
        special !== null &&
        typeof special.materialId === 'string' &&
        Number.isFinite(special.amount),
    )
  ) {
    return 'specialIngredients'
  }

  // The digest is recipe-independent - it binds the job identity and
  // every reserved input atomically, so it replays even when the
  // recipe no longer resolves (data changed between save and load).
  if (witness.digest !== alchemyJobReservationDigest(job, witness)) {
    return 'digest'
  }

  if (recipe === undefined) {
    return null
  }

  if (witness.herbAmount !== recipe.herbAmount) {
    return 'herbAmount'
  }

  if (witness.fuelWoodAmount !== Math.ceil(recipe.fuelWoodAmount * witness.costScale)) {
    return 'fuelWoodAmount'
  }

  if (witness.spiritStoneCost !== Math.ceil(recipe.spiritStoneCost * witness.costScale)) {
    return 'spiritStoneCost'
  }

  const expectedSpecials = recipe.specialIngredients ?? []
  const witnessSpecials = witness.specialIngredients

  if (
    witnessSpecials.length !== expectedSpecials.length ||
    expectedSpecials.some(
      (expected, index) =>
        witnessSpecials[index]?.materialId !== expected.materialId ||
        witnessSpecials[index]?.amount !== expected.amount,
    )
  ) {
    return 'specialIngredients'
  }

  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)

  if (!variant) {
    return 'herbMaterialId'
  }

  // 6E - the canonical fuel wood id is derivable: same realm as the
  // recipe, same age as the reserved herb variant.
  if (witness.woodId !== buildProfessionMaterialId('wood', recipe.fuelWoodRealmId, variant.age)) {
    return 'woodId'
  }

  return null
}

export interface AlchemySettlementEvent {
  jobId: string

  pillId: string

  pills: number

  success: boolean

  /** R9 (AR-34) receipt - amount that actually entered the pill bag. */
  delivered: number

  /** R9 (AR-34) receipt - amount lost to a full pill bag (0 = fit). */
  overflow: number

  /** QUEUE REWORK - units rolled in this settle pass (batch aggregate). */
  unitsProcessed?: number

  /** QUEUE REWORK - true when this pass finished the whole batch. */
  jobDone?: boolean

  // M-PILL-GRADE: chat da roll cua tung don vi mint thanh cong trong
  // pass nay (1 muc moi don vi - don vi mint nhieu vien ghi 1 chat).
  // Receipt-only: pill bag moi la chung cu can the, event chi de UI
  // hien ket qua. Don vi khong mint duoc (extraPillChance truot xuong
  // 0) khong co muc.
  mintedGrades?: ItemQuality[]
}

export function jobSuccessPercent(
  job: ActiveAlchemyJob,
  recipe: AlchemyRecipe,
  successBonusPercentPoints = 0,
): number {
  const variant = recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)

  const base = HERB_AGE_BASE_SUCCESS_PERCENT[variant?.age ?? 'decade']

  const bonus = alchemyRoomSuccessBonus(job.roomLevelAtStart)

  // Optional flat percent-point bonus (content sources may pass one) -
  // added before the guaranteed/extra split, cap 300 preserved (plan sec6).
  return Math.min(base + bonus + successBonusPercentPoints, 300)
}

/** Bang bonus ty le thanh dan theo level Dan Phong - TACH BIET bang speed (sec8.3).
 * Dan Phong maxLevel 9 (buildings.ts) - bang phai du 9 entry; truoc day
 * chi 5 entry khien level 6-9 ket o gia tri level 5 (review 2026-08-28,
 * economy-ecosystem-plan T5). */
export const ALCHEMY_SUCCESS_BONUS_PERCENT: readonly number[] = [0, 5, 10, 15, 20, 25, 30, 35, 40]

/**
 * Bonus % thanh dan theo level Dan Phong - index clamp 1..length. Nguon
 * su that DUY NHAT cho ca settle (jobSuccessPercent) lan preview
 * (GameManager.previewAlchemyOutcome) de hai duong khong bao gio lech
 * (review 2026-08-28: preview dung `?? 0` khong clamp, settle clamp).
 */
export function alchemyRoomSuccessBonus(roomLevel: number): number {
  const index = Math.min(Math.max(roomLevel, 1), ALCHEMY_SUCCESS_BONUS_PERCENT.length) - 1

  return ALCHEMY_SUCCESS_BONUS_PERCENT[index] ?? 0
}

/** He so toc do luyen theo level Dan Phong (sec8.2) - du 9 level (T5). */
export const ALCHEMY_SPEED_MULTIPLIERS: readonly number[] = [
  1.0, 1.15, 1.32, 1.52, 1.75, 2.01, 2.31, 2.66, 3.06,
]

export function alchemySecondsFor(recipe: AlchemyRecipe, roomLevel: number): number {
  const multiplier = ALCHEMY_SPEED_MULTIPLIERS[Math.min(Math.max(roomLevel, 1), ALCHEMY_SPEED_MULTIPLIERS.length) - 1] ?? 1

  return Math.ceil(recipe.baseDurationSeconds / multiplier)
}

/**
 * QUEUE REWORK - a queue entry is one batch of up to this many pills.
 * Bound matches one material stack (StackLimits): a bigger batch could
 * never be funded by the bag anyway, so it can only come from a crafted
 * save or a bad caller - deny it.
 */
export const ALCHEMY_MAX_BATCH_QUANTITY = MAX_STACK_AMOUNT

/**
 * Units whose per-unit deadline has passed at `nowMs` - the sequential
 * model: unit k (0-based) is due at startedAtMs + (k+1) * perUnitMs with
 * perUnitMs = span/quantity. Deadline-counted, not tick-bookkeeping:
 * cancel treats deadline-passed units as already burned even when no
 * tick has run their roll yet (anti-exploit - no roll dodging by
 * cancelling inside the window).
 */
export function unitsProcessedAt(
  job: Pick<ActiveAlchemyJob, 'startedAtMs' | 'completesAtMs' | 'quantity'>,
  nowMs: number,
): number {
  const quantity = job.quantity ?? 1
  const perUnitMs = (job.completesAtMs - job.startedAtMs) / quantity

  let due = 0

  while (due < quantity && job.startedAtMs + (due + 1) * perUnitMs <= nowMs) {
    due += 1
  }

  return due
}

/**
 * Units that already STARTED brewing at `nowMs` - sequential furnace:
 * unit k (0-based) enters the cauldron at startedAtMs + k * perUnitMs.
 * Cancel refunds only units NOT yet started (owner ruling 2026-10-11):
 * a unit sitting in the cauldron mid-brew is already burned, same as a
 * deadline-passed one.
 */
export function unitsStartedAt(
  job: Pick<ActiveAlchemyJob, 'startedAtMs' | 'completesAtMs' | 'quantity'>,
  nowMs: number,
): number {
  if (nowMs < job.startedAtMs) {
    return 0
  }

  const quantity = job.quantity ?? 1
  const perUnitMs = (job.completesAtMs - job.startedAtMs) / quantity

  return Math.min(quantity, Math.floor((nowMs - job.startedAtMs) / perUnitMs) + 1)
}

let jobCounter = 0

function nextJobId(): string {
  jobCounter += 1

  return `alchemy_${Date.now().toString(36)}_${jobCounter}`
}

/**
 * Nhien lieu lo (gp123 6E - design rule): go phai CUNG realm voi recipe
 * VA CUNG age voi thao duoc chon - KHONG cheapest-first scan, khong
 * xuyen realm, khong thay the age. Chi chap nhan
 * `<realmId>_wood_<requiredAge>`; thieu -> null (job tu choi
 * `missing_fuel_wood`).
 */
export function resolveFuelWood(
  bag: MaterialBag,
  realmId: string,
  amount: number,
  requiredAge: AlchemyHerbVariant['age'],
): string | null {
  const candidate = buildProfessionMaterialId('wood', realmId, requiredAge)

  return bag.has(candidate, amount) ? candidate : null
}

/**
 * QUEUE REWORK - per-unit special-ingredient profile equality for the
 * enqueue merge check: same recipe means same specials in practice,
 * but the comparison is structural so a recipe edit mid-queue can
 * never fold mismatched inputs into an existing order.
 */
function sameSpecialIngredients(
  a: readonly { materialId: string; amount: number }[],
  b: readonly { materialId: string; amount: number }[],
): boolean {
  return a.length === b.length && a.every((entry, index) => entry.materialId === b[index]?.materialId && entry.amount === b[index]?.amount)
}

export class AlchemySystem {
  private jobs: ActiveAlchemyJob[] = []

  private pendingEvents: AlchemySettlementEvent[] = []

  /**
   * M1 (ARCH-001) - restore REPLACES the job list with detached copies:
   * the payload is a value, so mutating it afterwards must not leak into
   * live state (A3).
   */
  restoreJobs(jobs: ActiveAlchemyJob[], restoreNowMs: number = Date.now()): void {
    // r29-COR-F1: the shift only fires under a sane restore clock -
    // a non-finite or exact-integer-domain-overflow restoreNowMs from
    // an ungated caller must not re-anchor every began-pair
    // (restoreNowMs = -Infinity turns shiftMs into +Infinity and
    // mints the whole queue on the next honest tick). Bad clock ->
    // verbatim restore: post-dated jobs stay parked (deny), honest
    // pairs were never shifted anyway.
    // r30-AUT-3: tightened to [0, 2^52) - a negative re-anchor
    // deep-pasts the queue (next tick mints), and a stamp re-grounded
    // at >= 2^52 exceeds the persisted timestamp domain so the next
    // save write self-refuses. Both read as bad clock -> verbatim.
    const clockOk = Number.isFinite(restoreNowMs) && restoreNowMs >= 0 && restoreNowMs < 2 ** 52
    this.jobs = jobs.flatMap((job) => {
      // r31-COR-F-NEG-MINT: persisted stamps live in [0, 2^52) - a
      // crafted negative pair would verbatim-restore as already-due and
      // settle on the next honest tick (mint); a >= 2^52 stamp wedges
      // the next write. Drop at the boundary (same rule as unknown
      // siteIds in restoreStates).
      // r32-AUT-1/2: ordering parity with the validator pin and the
      // sibling lane advance - an INVERTED pair (completes <= started)
      // is already-due the moment it lands (next tick mints), and the
      // shift arm mints a fresh inverted pair because a negative span
      // passes the headroom trivially. Drop inverted pairs outright:
      // impossible-authored content, never shift them.
      if (
        !Number.isFinite(job.startedAtMs) ||
        !Number.isFinite(job.completesAtMs) ||
        job.startedAtMs < 0 ||
        job.startedAtMs >= 2 ** 52 ||
        job.completesAtMs < 0 ||
        job.completesAtMs >= 2 ** 52 ||
        job.completesAtMs <= job.startedAtMs
      ) {
        return []
      }
      // QUEUE REWORK - batch fields: a record WITHOUT them is a
      // pre-rework save (a one-unit order) and restores VERBATIM -
      // stamps and legacy digest untouched; the deadline math defaults
      // quantity/unitsDone to 1/0 instead of rewriting the record.
      // Exactly-one-absent or impossible values are crafted (an honest
      // writer emits both fields or neither): drop like any malformed
      // record.
      const batchFieldsAbsent = job.quantity === undefined && job.unitsDone === undefined

      if (
        !batchFieldsAbsent &&
        (!Number.isInteger(job.quantity) ||
          (job.quantity ?? 0) < 1 ||
          (job.quantity ?? 0) > ALCHEMY_MAX_BATCH_QUANTITY ||
          !Number.isInteger(job.unitsDone) ||
          (job.unitsDone ?? -1) < 0 ||
          (job.unitsDone ?? 0) >= (job.quantity ?? 0))
      ) {
        return []
      }

      // r28-COR-Low: the fold reads reservation.specialIngredients.map
      // - only re-derive when the witness is actually foldable, or a
      // defined-but-malformed reservation throws before the normalize
      // arm below can run.
      const resSpecials =
        typeof job.reservation === 'object' && job.reservation !== null
          ? job.reservation.specialIngredients
          : undefined

      const foldable =
        Array.isArray(resSpecials) &&
        resSpecials.every((special) => typeof special === 'object' && special !== null)

      // r26-COR-1/AUT-1: a job post-dating the restore clock is
      // impossible-authored - startedAtMs is a began-time pinned
      // <= playerLastSavedAt at admission, so only a uniformly-shifted
      // (skewed-clock/crafted) pair reaches here. Re-ground it at the
      // restore clock, shifting completesAtMs by the same delta so the
      // authored span stays exact: the job resumes as live in-flight
      // instead of idling past the next save marker and self-bricking
      // every write. Honest stamps are untouched.
      // r31-COR-F-HEADROOM (sibling): the minted completesAtMs =
      // restoreNowMs + authored span must fit the persisted domain too
      // - a restore clock within span of the bound would re-ground a
      // stamp the next save write self-refuses. Keep the pair verbatim
      // (parked) instead.
      if (
        clockOk &&
        job.startedAtMs > restoreNowMs &&
        restoreNowMs + (job.completesAtMs - job.startedAtMs) < 2 ** 52
      ) {
        const shiftMs = job.startedAtMs - restoreNowMs
        const shifted = { ...job, startedAtMs: job.startedAtMs - shiftMs, completesAtMs: job.completesAtMs - shiftMs }
        // The reservation digest folds startedAtMs/completesAtMs into
        // the witness - re-derive it over the shifted stamps so the
        // witness still replays. Safe: an attacker could always
        // self-consistent-digest (documented residual).
        // (foldable hoisted - the batch-field normalize below shares it)
        job = foldable
          ? {
              ...shifted,
              reservation: {
                ...(job.reservation as AlchemyJobReservation),
                digest: alchemyJobReservationDigest(shifted, job.reservation as AlchemyJobReservation),
              },
            }
          : shifted

      }

      return [
        {
          ...job,
          reservation: {
            ...job.reservation,
            // r27-INT-Low: tolerate a non-array specials field - the
            // normalize arm must never throw on an ungated payload.
            specialIngredients: Array.isArray(job.reservation?.specialIngredients)
              ? job.reservation.specialIngredients.map((special) => ({ ...special }))
              : [],
          },
        },
      ]
    })
  }

  getJobs(): ActiveAlchemyJob[] {
    return [...this.jobs]
  }

  drainSettlementEvents(): AlchemySettlementEvent[] {
    const events = this.pendingEvents

    this.pendingEvents = []

    return events
  }

  hasActiveJob(): boolean {
    return this.jobs.length > 0
  }

  /**
   * Bat dau job - validation TRUOC, tru TOAN BO sau khi hop le
   * (atomic reserve, plan sec7.2/sec8.2). Tra ve loi cu the cho UI preview.
   */
  startJob(
    recipe: AlchemyRecipe,
    herbMaterialId: string,
    bag: MaterialBag,
    registry: MaterialRegistry,
    spiritStone: number,
    roomLevel: number,
    nowMs: number,
    maxConcurrentJobs: number,
    // M3 (talent v4 sec4.2) - Hoa Hau Thong Than counter-cost: multiplies
    // fuel wood + spirit stone requirements; herb/specials stay base.
    costMultiplier = 1,
    // QUEUE REWORK - batch size: one queue entry brews `quantity` units
    // sequentially, each rolling its own deadline. Defaults to 1 so
    // legacy call sites mint the same one-unit job as before.
    quantity = 1,
  ): { ok: boolean; reason?: string; spiritStoneCost?: number } {
    // r29-INT-2: nowMs guard parity with tick - a non-finite or
    // out-of-domain clock bakes a NaN/huge deadline
    // the tick guard never inspects (it guards the clock ARGUMENT,
    // not stored stamps): NaN settles for free on the next finite
    // tick (mint), +Infinity parks a live slot forever. Deny at
    // origination - before any cost/burn arithmetic below.
    // r30-AUT-3: the domain is [0, 2^52) - the minted stamps must fit
    // the persisted timestamp bound, and a negative clock would mint
    // an already-due job (free instant pill).
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      return { ok: false, reason: 'invalid_clock' }
    }

    // QUEUE REWORK - batch size is persisted and folds into the
    // reservation digest, so validate it at origination: a non-integer,
    // non-positive or over-cap quantity could never come from an honest
    // caller (UI clamps to affordable materials, capped by the stack
    // bound the reservation itself obeys).
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > ALCHEMY_MAX_BATCH_QUANTITY) {
      return { ok: false, reason: 'invalid_quantity' }
    }

    const perUnitSeconds = alchemySecondsFor(recipe, roomLevel)

    const batchSeconds = perUnitSeconds * quantity

    // r31-COR-F-HEADROOM: headroom on the minted due too - completesAtMs
    // = nowMs + authored span, so a clock within span of the bound mints
    // a stamp the next save write self-refuses (wedge). The !(...) form
    // denies NaN spans as well. QUEUE REWORK: span scales by quantity.
    if (!(nowMs + Math.max(0, batchSeconds * 1000) < 2 ** 52)) {
      return { ok: false, reason: 'invalid_clock' }
    }

    // BETA SCOPE LOCK v2 sec.12 - recipe families outside
    // BETA_ENABLED_RECIPE_FAMILIES are dormant: their definitions stay in
    // the registry but jobs cannot start via ANY entry path (the domain
    // fails closed, not just the ops layer). In-flight/loaded jobs for
    // dormant families PARK at the tick delivery seam - the record stays
    // intact, no pill lands, no event/toast fires (see tick()).
    if (betaRecipeFamilyOfId(recipe.id) === null) {
      return { ok: false, reason: 'scope_hidden' }
    }

    // M10 (ARCH-008) - retired pill families (Hoi Xuan Dan) cannot start
    // new jobs; in-flight jobs still settle via the resolvable recipe.
    if (recipe.retired === true) {
      return { ok: false, reason: 'retired' }
    }

    // Scope-hidden families keep their in-flight jobs PARKED (record
    // intact, no delivery - see tick()) but may not occupy the live slot
    // budget - a restored dormant job rendered nowhere would otherwise
    // reject every beta recipe job_slots_full with no visible cause or
    // cancel path.
    const liveJobs = this.jobs.filter((job) => betaRecipeFamilyOfId(job.recipeId) !== null)

    if (liveJobs.length >= Math.max(1, maxConcurrentJobs)) {
      return { ok: false, reason: 'job_slots_full' }
    }

    const variant = recipe.herbVariants.find((candidate) => candidate.materialId === herbMaterialId)

    if (!variant) {
      return { ok: false, reason: 'wrong_herb' }
    }

    if (!registry.has(herbMaterialId)) {
      return { ok: false, reason: 'wrong_herb' }
    }

    // Counter-cost is a surcharge - clamp >= 1 so bad data can't make jobs free.
    const costScale = Math.max(1, costMultiplier)

    // QUEUE REWORK - reservation stays PER-UNIT (digest-bound amounts
    // cancel/tick refund or burn one unit at a time); the batch checks
    // and burns the per-unit amounts x quantity up front.
    const perUnitFuelWoodAmount = Math.ceil(recipe.fuelWoodAmount * costScale)
    const perUnitSpiritStoneCost = Math.ceil(recipe.spiritStoneCost * costScale)

    const fuelWoodAmount = perUnitFuelWoodAmount * quantity
    const spiritStoneCost = perUnitSpiritStoneCost * quantity
    const herbAmount = recipe.herbAmount * quantity

    // 6E - nhien lieu CUNG age voi thao da chon (variant luon co age
    // theo type - post-C2 moi thao deu `profession.age`).
    const woodId = resolveFuelWood(bag, recipe.fuelWoodRealmId, fuelWoodAmount, variant.age)

    if (!woodId) {
      return { ok: false, reason: 'missing_fuel_wood' }
    }

    if (!bag.has(herbMaterialId, herbAmount)) {
      return { ok: false, reason: 'missing_herb' }
    }

    if (spiritStone < spiritStoneCost) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    // Nguyen lieu dac biet (spec dot-pha-loi-kiep sec4.1b) - check du
    // TAT CA truoc khi reserve bat cu thu gi (giu atomic sec7.2).
    for (const special of recipe.specialIngredients ?? []) {
      if (!bag.has(special.materialId, special.amount * quantity)) {
        return { ok: false, reason: 'missing_special_ingredient' }
      }
    }

    // Reserve atomic - tru toan bo sau khi moi check pass.
    bag.remove(herbMaterialId, herbAmount)

    bag.remove(woodId, fuelWoodAmount)

    for (const special of recipe.specialIngredients ?? []) {
      bag.remove(special.materialId, special.amount * quantity)
    }

    const jobId = nextJobId()
    const completesAtMs = nowMs + batchSeconds * 1000
    // Reservation keeps PER-UNIT amounts (single source the per-unit
    // settle and the partial-cancel refund both replay); quantity binds
    // the batch through the digest fold on the job side.
    const specialIngredients = (recipe.specialIngredients ?? []).map((special) => ({ ...special }))

    // F-ALCH-JOB-FORGE - stamp the reservation witness at the same
    // atomic point the inputs burn: only a real startJob reserve can
    // produce this record.
    const reservation: AlchemyJobReservation = {
      woodId,
      fuelWoodAmount: perUnitFuelWoodAmount,
      spiritStoneCost: perUnitSpiritStoneCost,
      herbAmount: recipe.herbAmount,
      specialIngredients,
      costScale,
      digest: alchemyJobReservationDigest(
        {
          jobId,
          recipeId: recipe.id,
          pillId: recipe.pillId,
          herbMaterialId,
          startedAtMs: nowMs,
          completesAtMs,
          roomLevelAtStart: roomLevel,
          quantity,
          unitsDone: 0,
        },
        {
          woodId,
          fuelWoodAmount: perUnitFuelWoodAmount,
          spiritStoneCost: perUnitSpiritStoneCost,
          herbAmount: recipe.herbAmount,
          specialIngredients,
          costScale,
        },
      ),
    }

    this.jobs.push({
      jobId,
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId,
      startedAtMs: nowMs,
      completesAtMs,
      roomLevelAtStart: roomLevel,
      quantity,
      unitsDone: 0,
      reservation,
    })

    // Caller deducts exactly the cost validated here - the batch total
    // (per-unit cost x quantity), single formula.
    return { ok: true, spiritStoneCost }
  }

  /**
   * QUEUE REWORK (owner ruling 2026-10-11) - the player-facing enqueue
   * path: every "Luyen Dan" click reserves ONE unit immediately. If the
   * LAST queue entry is the same order (same recipe + herb variant +
   * room level + identical per-unit cost profile) the click merges into
   * it (+1 quantity, deadline span extends by one per-unit) instead of
   * occupying a new slot - A B A queues three entries because the last
   * entry before the third click is B. A merge is denied only by an
   * exhausted batch cap or timestamp headroom, in which case the click
   * falls through to a fresh order.
   *
   * Merge safety: the order's reservation stores PER-UNIT amounts, so
   * refund/settle replay is unchanged by quantity growth; the digest
   * is re-folded over the extended record. Merge requires the same
   * resolved inputs - a room upgrade or talent change between clicks
   * produces a different cost profile and lands as a NEW order (the
   * new unit can never inherit stale pricing/timing).
   *
   * Returns the same contract as startJob plus `merged` so callers can
   * distinguish extend-from-create if they ever need to.
   */
  enqueueJob(
    recipe: AlchemyRecipe,
    herbMaterialId: string,
    bag: MaterialBag,
    registry: MaterialRegistry,
    spiritStone: number,
    roomLevel: number,
    nowMs: number,
    maxConcurrentJobs: number,
    costMultiplier = 1,
  ): { ok: boolean; reason?: string; spiritStoneCost?: number; merged?: boolean } {
    // Same origination denials as startJob BEFORE any merge - a parked
    // dormant-family order at the tail must not absorb clicks (the
    // domain fails closed at every origination path), and a bad clock
    // never reaches the amount arithmetic below.
    if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs >= 2 ** 52) {
      return { ok: false, reason: 'invalid_clock' }
    }

    if (betaRecipeFamilyOfId(recipe.id) === null) {
      return { ok: false, reason: 'scope_hidden' }
    }

    if (recipe.retired === true) {
      return { ok: false, reason: 'retired' }
    }

    const variant = recipe.herbVariants.find((candidate) => candidate.materialId === herbMaterialId)

    if (!variant || !registry.has(herbMaterialId)) {
      return { ok: false, reason: 'wrong_herb' }
    }

    const last = this.jobs[this.jobs.length - 1]

    const mergeCandidate =
      last !== undefined &&
      last.recipeId === recipe.id &&
      last.herbMaterialId === herbMaterialId &&
      last.roomLevelAtStart === roomLevel &&
      (last.quantity ?? 1) < ALCHEMY_MAX_BATCH_QUANTITY

    if (mergeCandidate) {
      // Compute this click's per-unit cost profile the same way
      // startJob derives it - merge only when the order's reservation
      // already describes exactly these inputs.
      const perUnitSeconds = alchemySecondsFor(recipe, roomLevel)
      const costScale = Math.max(1, costMultiplier)
      const perUnitFuelWoodAmount = Math.ceil(recipe.fuelWoodAmount * costScale)
      const perUnitSpiritStoneCost = Math.ceil(recipe.spiritStoneCost * costScale)
      const perUnitMs = perUnitSeconds * 1000

      const mergeable =
        perUnitFuelWoodAmount === last.reservation.fuelWoodAmount &&
        perUnitSpiritStoneCost === last.reservation.spiritStoneCost &&
        recipe.herbAmount === last.reservation.herbAmount &&
        costScale === last.reservation.costScale &&
        sameSpecialIngredients(recipe.specialIngredients ?? [], last.reservation.specialIngredients) &&
        last.completesAtMs + perUnitMs < 2 ** 52

      if (mergeable) {
        const woodId = resolveFuelWood(bag, recipe.fuelWoodRealmId, perUnitFuelWoodAmount, variant.age)

        // Burn this click's single-unit inputs atomically before the
        // record grows - same all-checks-then-remove order as startJob.
        if (!woodId) {
          return { ok: false, reason: 'missing_fuel_wood' }
        }

        if (!bag.has(herbMaterialId, recipe.herbAmount)) {
          return { ok: false, reason: 'missing_herb' }
        }

        if (spiritStone < perUnitSpiritStoneCost) {
          return { ok: false, reason: 'missing_spirit_stone' }
        }

        for (const special of recipe.specialIngredients ?? []) {
          if (!bag.has(special.materialId, special.amount)) {
            return { ok: false, reason: 'missing_special_ingredient' }
          }
        }

        bag.remove(herbMaterialId, recipe.herbAmount)
        bag.remove(woodId, perUnitFuelWoodAmount)

        for (const special of recipe.specialIngredients ?? []) {
          bag.remove(special.materialId, special.amount)
        }

        const quantity = (last.quantity ?? 1) + 1
        const extended: ActiveAlchemyJob = {
          ...last,
          quantity,
          unitsDone: last.unitsDone ?? 0,
          completesAtMs: last.completesAtMs + perUnitMs,
        }

        extended.reservation = {
          ...last.reservation,
          digest: alchemyJobReservationDigest(extended, last.reservation),
        }

        this.jobs[this.jobs.length - 1] = extended

        return { ok: true, spiritStoneCost: perUnitSpiritStoneCost, merged: true }
      }
    }

    const created = this.startJob(
      recipe,
      herbMaterialId,
      bag,
      registry,
      spiritStone,
      roomLevel,
      nowMs,
      maxConcurrentJobs,
      costMultiplier,
      1,
    )

    return { ...created, merged: false }
  }

  /**
   * QUEUE REWORK - huy mot batch: refund chi cac vien CHUA DOT
   * (deadline chua den luc huy); vien da qua deadline coi nhu lo da
   * dot - ke ca chua toi tick roll - nen khong hoan (chong exploit ne
   * roll). Spirit stone khong nam trong reservation ids -> caller
   * (ops layer) tu refund phan stone cua so unprocessed.
   * Returns unprocessedUnits so the caller mirrors the stone refund.
   */
  cancelJob(
    jobId: string,
    bag: MaterialBag,
    registry: MaterialRegistry,
    nowMs: number = Date.now(),
  ): { ok: true; unprocessedUnits: number } | { ok: false } {
    const job = this.jobs.find((candidate) => candidate.jobId === jobId)

    if (!job) {
      return { ok: false }
    }

    // Clock out of the persisted domain cannot count deadlines - deny
    // the whole cancel rather than refund under a bogus timestamp
    // (refund is mint-adjacent: bad clock = deny direction).
    if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs >= 2 ** 52) {
      return { ok: false }
    }

    const unprocessedUnits = (job.quantity ?? 1) - unitsStartedAt(job, nowMs)

    if (unprocessedUnits > 0) {
      const refund = (materialId: string, amount: number) => {
        if (amount <= 0) {
          return
        }

        // The reservation already proved these ids were reservable at
        // start; a registry miss mid-session can only come from data
        // churn - skip that line (same deny direction as settle).
        if (!registry.has(materialId)) {
          return
        }

        bag.add(registry.get(materialId), amount * unprocessedUnits)
      }

      refund(job.herbMaterialId, job.reservation.herbAmount)

      refund(job.reservation.woodId, job.reservation.fuelWoodAmount)

      for (const special of job.reservation.specialIngredients) {
        refund(special.materialId, special.amount)
      }
    }

    this.jobs = this.jobs.filter((candidate) => candidate.jobId !== jobId)

    return { ok: true, unprocessedUnits }
  }

  /**
   * Settle theo cong thuc sec8.3 TUNG VIEN: moi unit qua deadline roll
   * rieng (guaranteedPills + mot roll extraPillChance), mint tung vien -
   * khong con job mint ca batch mot lan (QUEUE REWORK). unitsDone la
   * bookkeeping da giao; event gap gop ket qua cac unit roll trong mot
   * pass de khong spam toast. Idempotent - unit da unitsDone khong roll lai.
   */
  tick(
    nowMs: number,
    pillBag: PillBag,
    resolvePill: (pillId: string) => { id: string } | undefined,
    random: () => number = Math.random,
    successBonusPercentPoints = 0,
    // M3 - Hoa Hau Thong Than: successful jobs yield pills x multiplier.
    pillYieldMultiplier = 1,
  ): void {
    // r28-AUT-2: nowMs guard parity with advanceWorkerLanes
    // (WorkerLaneAdvance.ts:150-151) - a non-finite or
    // out-of-domain clock would treat every in-flight
    // job as due (NaN < completesAtMs is false -> settle arm) and mint
    // the whole queue, or park all jobs forever. Zero-advance result:
    // jobs preserved untouched (deny direction).
    // r30-AUT-3: [0, 2^52) - a clock outside the persisted domain
    // would bake stamps the next save write self-refuses.
    if (!Number.isFinite(nowMs) || nowMs < 0 || nowMs >= 2 ** 52) {
      return
    }

    const remaining: ActiveAlchemyJob[] = []

    for (const job of this.jobs) {
      // BETA SCOPE LOCK - a carried dormant-family job stays inert at
      // the delivery seam: startJob gates origination but restore and
      // settle used to trust persisted intent. The record parks (data
      // intact) - no pill lands and no event/toast fires. Only AUTHORED
      // dormant recipes park: an unknown/corrupt recipeId falls through
      // to the recipe-miss failure arm instead of parking forever.
      // F-TC6-4: retired is NOT an exemption - hoi_xuan_dan is retired
      // AND scope-hidden, and dormancy is the stronger claim (the
      // retired contract predates the scope lock).
      if (scopeHiddenPillFamilyOfId(job.recipeId) !== null) {
        remaining.push(job)

        continue
      }

      // QUEUE REWORK - sequential units: roll only the units whose
      // per-unit deadline already passed (deadline math, not
      // bookkeeping), minus the units already delivered.
      const unitsDue = unitsProcessedAt(job, nowMs)

      const unitsToRoll = unitsDue - (job.unitsDone ?? 0)

      if (unitsToRoll <= 0) {
        remaining.push(job)

        continue
      }

      const recipe = this.recipeLookup?.(job.recipeId)

      // F-A7-3: settle re-derives the deliverable from the authored
      // recipe - job.pillId is only a denormalized snapshot, so a forged
      // job claiming a different pill can never mint it.
      const pill = recipe !== undefined ? resolvePill(recipe.pillId) : undefined

      if (!recipe || !pill) {
        // Recipe/pill khong resolve duoc (data doi/xoa giua save va load) -
        // TRUOC DAY job bi xoa im lang, mat trang nguyen lieu da reserve ma
        // khong co event nao (review 2026-08-28). Gio phat event that bai de
        // UI thong bao; nguyen lieu da dot KHONG hoan tra (job coi nhu luyen
        // that bai - dung semantic sec8.3, khong tao refund exploit).
        // Batch: the order cannot continue without its recipe - drop the
        // whole entry (remaining units' inputs stay burned, deny).
        this.pendingEvents.push({
          jobId: job.jobId,
          pillId: job.pillId,
          pills: 0,
          success: false,
          delivered: 0,
          overflow: 0,
          unitsProcessed: 0,
          jobDone: true,
        })

        continue
      }

      // F-ALCH-JOB-FORGE - settle replays the reservation witness
      // startJob stamped when it burned the inputs. A fabricated job
      // (persisted record that never reserved materials) cannot
      // produce the witness and settles as a failed job instead of
      // minting the pill for free - same arm as a recipe/pill miss,
      // burned inputs never refund.
      if (verifyAlchemyJobReservation(job, recipe) !== null) {
        this.pendingEvents.push({
          jobId: job.jobId,
          pillId: job.pillId,
          pills: 0,
          success: false,
          delivered: 0,
          overflow: 0,
          unitsProcessed: 0,
          jobDone: true,
        })

        continue
      }

      const totalPercent = jobSuccessPercent(job, recipe, successBonusPercentPoints)

      const guaranteedPills = Math.floor(totalPercent / 100)

      const extraPillChance = totalPercent % 100

      // QUEUE REWORK - each due unit rolls independently (owner ruling:
      // mint per unit, never the whole batch at once). The settle pass
      // aggregates the results into one event so a long-offline batch
      // does not spam one toast per pill.
      let pills = 0

      let delivered = 0

      let overflow = 0

      // M-PILL-GRADE: dot thao duoc da reserve quyet dinh so bac chat
      // day them (van_nien +1, thuong_co +2) - doc lap voi truc ty le
      // thanh o tren, realm khong lien quan.
      const herbAge =
        recipe.herbVariants.find((candidate) => candidate.materialId === job.herbMaterialId)?.age ??
        'decade'

      const mintedGrades: ItemQuality[] = []

      for (let unit = 0; unit < unitsToRoll; unit += 1) {
        let unitPills = guaranteedPills

        if (random() * 100 < extraPillChance) {
          unitPills += 1
        }

        unitPills = Math.floor(unitPills * Math.max(0, pillYieldMultiplier))

        if (unitPills > 0) {
          // Chat roll doc lap tung don vi (ruling 1) - chi tieu rng khi
          // don vi nay that su mint de giu thu tu tieu rng on dinh.
          const quality = rollPillQualityWithHerb(random, herbAge)

          mintedGrades.push(quality)

          // R9 (AR-34): surface the delivery receipt instead of ignoring it.
          const unitOverflow = pillBag.add(
            pill as Parameters<typeof pillBag.add>[0],
            unitPills,
            quality,
          )

          delivered += unitPills - unitOverflow

          overflow += unitOverflow
        }

        pills += unitPills
      }

      const unitsDone = unitsDue

      const jobDone = unitsDone >= (job.quantity ?? 1)

      // The digest folds unitsDone - re-derive it over the advanced
      // record so the witness still replays next settle (same rule as
      // the restore shift arm). quantity is stamped too: a settled
      // legacy record becomes fully batch-shaped (the save validator
      // requires both-or-neither).
      if (!jobDone) {
        const advanced = { ...job, quantity: job.quantity ?? 1, unitsDone }

        remaining.push({
          ...advanced,
          reservation: {
            ...job.reservation,
            digest: alchemyJobReservationDigest(advanced, job.reservation),
          },
        })
      }

      this.pendingEvents.push({
        jobId: job.jobId,
        pillId: recipe.pillId,
        pills,
        success: pills > 0,
        delivered,
        overflow,
        unitsProcessed: unitsToRoll,
        jobDone,
        ...(mintedGrades.length > 0 ? { mintedGrades } : {}),
      })
    }

    this.jobs = remaining
  }

  /** Offline settle - job hoan thanh trong qua khu settle dung mot lan. */
  settleOffline(
    pillBag: PillBag,
    resolvePill: (pillId: string) => { id: string } | undefined,
    nowMs: number = Date.now(),
    successBonusPercentPoints = 0,
    pillYieldMultiplier = 1,
    rng: () => number = Math.random,
  ): number {
    const before = this.jobs.length

    this.tick(nowMs, pillBag, resolvePill, rng, successBonusPercentPoints, pillYieldMultiplier)

    return before - this.jobs.length
  }

  /** Wiring recipe lookup tu GameManager de tick resolve snapshot recipe. */
  private recipeLookup?: (recipeId: string) => AlchemyRecipe | undefined

  setRecipeLookup(lookup: (recipeId: string) => AlchemyRecipe | undefined): void {
    this.recipeLookup = lookup
  }
}

export { mulberry32 as alchemyMulberry32 }
