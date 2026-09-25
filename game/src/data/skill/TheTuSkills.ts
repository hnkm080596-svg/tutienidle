import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { BuffDefinition } from '../../core/buff2/BuffDefinition'
import type { BuffDefinitionId } from '../../core/battle/contracts/ids'
import type {
  ReactiveProcPayload,
  ReactiveTriggerPayload,
} from '../../core/proc/ProcCapabilities'
import type { TheEconomyPayload } from '../../core/the-tu/TheTuCapabilities'
import type { BodyKitModifierValues } from '../../core/the-tu/TheTuKitModifiers'
import type { HiddenBodyMechanicModifierValues } from '../../core/the-tu/TheTuAnMechanicModifiers'
import { THE_PROC_COST, THE_PROC_GAIN } from '../../core/the-tu/TheEconomy'
import { MAX_THE } from '../../core/combat/CombatTypes'
import {
  HO_MON_MARKER,
  PHAN_CHAN_BUFF,
  PHAN_MON_MARKER,
  TRO_MON_MARKER,
  UNG_THE_BUFF,
} from '../buff/TheTuBuffs'

// The Tu beta (the-tu-body-pathway-design) — the two body_pathway roots
// are NATIVE TurnSkillDefinitions (not Skill objects; body has no
// cast-leveled skills). Kit resolution reads the owned root at
// participant build: cuong_chien / tran_the are an excludesNode mutex
// pair, no root -> GENERIC_PHYSICAL_BASIC only (INV-3). Beta window =
// Luyện Khí -> Trúc Cơ: roots grant the Basic only; the Trúc Cơ
// special node grants the Special (Loạn Đấu / Phản Chấn); NO Ultimate
// exists in beta (Bất Tử Bá Thể / Sơn Nhạc stay authored, unreachable).
//
// Tunable first-pass constants (design sec.75: numbers are tunable,
// semantics/topology are locked):
export const CUONG_QUYEN_MULTIPLIER = 1.4
export const LOAN_DAU_MULTIPLIER = 1.2
export const LOAN_DAU_SACRIFICE_RATIO = 0.3
export const LOAN_DAU_PAID_HP_BONUS = 0.006
export const LOAN_DAU_HITS = 3
export const HUYET_CUONG_PER_PERCENT = 0.015
export const HUYET_CUONG_CAP = 1.5
export const TRAN_AP_MULTIPLIER = 0.4
export const TRAN_AP_MAXHP_RATIO = 0.3
export const SON_NHAC_WARD_RATIO = 0.25

// --- Cuong Chien (Might -> single-target) — root 'cuong_chien' ---

/**
 * Cuong Quyen — the Cuồng Chiến Basic: single-target physical at high
 * Might conversion. Beta design: NEVER an HP cost, and NO missing-HP
 * scaling at Luyện Khí (missing-HP is the Trúc Cơ Huyết Cuồng passive
 * baked onto the clone when Loạn Đấu is owned — kit-local, never on
 * normal attacks or other paths).
 */
export const CUONG_QUYEN: TurnSkillDefinition = {
  id: 'cuong_quyen',
  cooldownTurns: 0,
  damage: {
    kind: 'physical',
    multiplier: CUONG_QUYEN_MULTIPLIER,
    // M-QI-05 - damage-bearing native core: +5% coefficient per level.
    levelScaling: 0.05,
  },
  targeting: { shape: 'single' },
}

/**
 * Loan Dau — the Trúc Cơ Special: pay `sacrificeMaxHpRatio` x MAX HP
 * first (the authority floors the payment at leaving 1 HP — never a
 * self-kill), THEN resolve an ordered multi-hit into the same target;
 * the new missing-HP state carries into the hits and the ACTUAL paid
 * amount feeds damageBonusPerPaidHpPoint (never the nominal ratio).
 */
export const LOAN_DAU: TurnSkillDefinition = {
  id: 'loan_dau',
  cooldownTurns: 4,
  sacrificeMaxHpRatio: LOAN_DAU_SACRIFICE_RATIO,
  damageBonusPerPaidHpPoint: LOAN_DAU_PAID_HP_BONUS,
  damage: {
    kind: 'physical',
    multiplier: LOAN_DAU_MULTIPLIER,
    levelScaling: 0.05,
  },
  targeting: { shape: 'single' },
  instances: { count: LOAN_DAU_HITS },
}

/**
 * Bat Tu Ba The — LEGACY (post-beta content): parked authored def. The
 * beta kit never grants it (ultimate slot stays empty); the def + buff
 * remain for the later-realm pass.
 */
/** Base holder-turn duration of the bat_tu_ba_the buff (nodes add via durationOverride). */
export const BAT_TU_BA_THE_TURNS = 3

export const BAT_TU_BA_THE: TurnSkillDefinition = {
  id: 'bat_tu_ba_the',
  cooldownTurns: 8,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'bat_tu_ba_the', target: 'self' }],
}

// --- Tran The (Max HP -> AoE) — root 'tran_the' ---

/**
 * Tran Ap — the Trấn Thể Basic: physical AoE across all valid enemies,
 * primary scaling = caster MAX HP (sourceMaxHpRatio rides the raw base
 * pre-mitigation). Trọng Thế node levels add sourceMaxHpRatio on the
 * clone; the Trấn Kình node adds the tran_kinh weaken application.
 */
export const TRAN_AP: TurnSkillDefinition = {
  id: 'tran_ap',
  cooldownTurns: 0,
  damage: {
    kind: 'physical',
    multiplier: TRAN_AP_MULTIPLIER,
    sourceMaxHpRatio: TRAN_AP_MAXHP_RATIO,
    levelScaling: 0.05,
  },
  targeting: { shape: 'all_lanes' },
}

/**
 * Phan Chan — the Trúc Cơ Special: a REAL castable action dealing NO
 * direct damage. The cast applies Khiêu Khích (taunt) + Chấn Ấn (mark)
 * to every valid enemy; learning it also plants the permanent
 * phan_chan reflect passive via grantsBuffsAtBuild (the once-per-
 * hostile-action reflect, holder maxHp x ratio, marked at the higher
 * ratio).
 */
export const PHAN_CHAN: TurnSkillDefinition = {
  id: 'phan_chan',
  cooldownTurns: 6,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [
    { definitionId: 'khiem_khich', target: 'all_enemies' },
    { definitionId: 'chan_an', target: 'all_enemies' },
  ],
  grantsBuffsAtBuild: [PHAN_CHAN_BUFF],
}

/**
 * Son Nhac — LEGACY (post-beta content): parked authored def (team
 * protection + Taunt + self DR). Unreachable in beta.
 */
export const SON_NHAC: TurnSkillDefinition = {
  id: 'son_nhac',
  cooldownTurns: 6,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [
    { definitionId: 'son_nhac', target: 'self' },
    {
      definitionId: 'son_nhac_ho_the',
      target: 'allies_except_self',
      externalWardGrant: { sourceMaxHpRatio: SON_NHAC_WARD_RATIO },
    },
    { definitionId: 'khiem_khich', target: 'all_enemies' },
  ],
}

// --- ung_the (The Tu An) — fixed kit granted at path choice (spec 6.1) ---
// The kit itself is NOT root-gated: roots plant the reactive-mechanic
// markers that make the kit's proc windows live (Tasks 15-18).

export const THAM_THE: TurnSkillDefinition = {
  id: 'tham_the',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
}

export const TU_THE: TurnSkillDefinition = {
  id: 'tu_the',
  cooldownTurns: 5,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'tu_the', target: 'self' }],
}

export const BACH_UNG: TurnSkillDefinition = {
  id: 'bach_ung',
  cooldownTurns: 8,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'bach_ung', target: 'self' }],
}

// Reactive payloads (spec 6.2) — real TurnSkillDefinitions resolved as
// bypass-turn actions through the follow-up queue (Tasks 16-18). They
// are never slotted; the *_mon markers reference them by id.
export const PHAN_KICH: TurnSkillDefinition = {
  id: 'phan_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
  // M-QI-05 - internal payload: inherits the parent Core's level
  // (tham_the owns every hidden-body reactive channel in the current
  // model), never resolves its own (nonexistent) core.
  progressionOwnerId: 'tham_the',
}

export const TRO_KICH: TurnSkillDefinition = {
  id: 'tro_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0.7, levelScaling: 0.05 },
  targeting: { shape: 'single' },
  progressionOwnerId: 'tham_the',
}

/**
 * Trong Phan Kich — the post-evasion heavy-counter payload variant
 * (spec 8.2 "post-evasion heavy counter"). Never in the registry slot
 * rotation: buildTheTuAnKit clones it into reactivePayloads and swaps
 * the phan_mon marker's onEvade queuedAction to this id only when the
 * evadeCounterMultiplierBonus node channel is owned. Base multiplier
 * equals phan_kich's — the node bonus is the whole delta.
 */
export const TRONG_PHAN_KICH: TurnSkillDefinition = {
  id: 'trong_phan_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
  progressionOwnerId: 'tham_the',
}

export type TheTuAnRootId = 'ho_mon' | 'phan_mon' | 'tro_mon'

const THE_TU_AN_ROOT_MARKERS: Record<TheTuAnRootId, BuffDefinition> = {
  ho_mon: HO_MON_MARKER,
  phan_mon: PHAN_MON_MARKER,
  tro_mon: TRO_MON_MARKER,
}

/**
 * Participant-build factory for ung_the (plan Task 14): returns
 * participant-local CLONES of the fixed kit with the marker set baked
 * into basic.grantsBuffsAtBuild — ung_the always, plus one marker per
 * owned root (non-mutex, T9). The ops' existing grantsBuffsAtBuild seam
 * applies them to the participant's pool; registry defs never mutate.
 *
 * Task 20 (review P1.7): `mods` is the collectHiddenBodyMechanicModifiers
 * total — trunk economy lands on the ung_the marker's theEconomy fields
 * + every reactiveProc's theCost/theGainOnSuccess; branch riders land on
 * their marker's own fields (intercept ward, evade payload swap, Tro
 * heal/non-damaging). maxThe rides the kit for the adapter to stamp on
 * the participant's entity.
 */
const ZERO_AN_MODS: HiddenBodyMechanicModifierValues = {
  maxTheBonus: 0,
  procCostDelta: 0,
  procGainBonus: 0,
  evadeGainBonus: 0,
  takenGainBonus: 0,
  basicGainBonus: 0,
  roundGainBonus: 0,
  interceptTheGainBonus: 0,
  interceptWardRatio: 0,
  evadeCounterMultiplierBonus: 0,
  counterChoangChance: 0,
  troHealTriggeringAllyRatio: 0,
  troCostDelta: 0,
  troAnyAction: 0,
}

// buff2 M4 -- node adjustments bake onto the clone's capability PAYLOADS
// (the def-level `capabilities[]` grants) -- the retired `effects[]`
// lane is gone; buff2 consumers read registry/clone payloads directly.
// Payloads are validated at registry registration and these are clones
// of registered defs, so the schema-type reads below are exact (same
// narrowing the capability modules do internally for ActiveGrant).
function defPayloads<T>(
  definition: BuffDefinition | undefined,
  type: string,
): T[] {
  return (definition?.capabilities ?? [])
    .filter((grant) => grant.type === type)
    .map((grant) => grant.payload as T)
}

export function buildTheTuAnKit(
  ownedRoots: readonly TheTuAnRootId[],
  mods: HiddenBodyMechanicModifierValues = ZERO_AN_MODS,
): TheTuAnKit {
  const kit: TheTuAnKit = {
    basic: structuredClone(THAM_THE),
    special: structuredClone(TU_THE),
    ultimate: structuredClone(BACH_UNG),
    reactivePayloads: {},
    maxThe: MAX_THE + mods.maxTheBonus,
  }

  kit.basic.grantsBuffsAtBuild = [
    structuredClone(UNG_THE_BUFF),
    ...ownedRoots.map((root) => structuredClone(THE_TU_AN_ROOT_MARKERS[root])),
  ]

  // Trunk economy — node bonuses bake onto the marker clone's authored
  // income fields; the engine reads these, never the constants.
  const ungThe = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'ung_the')
  for (const payload of defPayloads<TheEconomyPayload>(ungThe, 'the_economy')) {
    payload.gainOnBasicHit = (payload.gainOnBasicHit ?? 0) + mods.basicGainBonus
    payload.gainOnEvade = (payload.gainOnEvade ?? 0) + mods.evadeGainBonus
    payload.gainOnHitTaken = (payload.gainOnHitTaken ?? 0) + mods.takenGainBonus
    payload.gainPerRound = (payload.gainPerRound ?? 0) + mods.roundGainBonus
  }

  // Every reactive_proc gets the trunk cost/gain adjustments; branch
  // riders land on their own marker's fields below.
  for (const marker of kit.basic.grantsBuffsAtBuild ?? []) {
    for (const payload of defPayloads<ReactiveProcPayload>(marker, 'reactive_proc')) {
      const troDelta = marker.id === 'tro_mon' ? mods.troCostDelta : 0
      payload.theCost = Math.max(0, (payload.theCost ?? THE_PROC_COST) + mods.procCostDelta + troDelta)
      const interceptBonus = marker.id === 'ho_mon' ? mods.interceptTheGainBonus : 0
      payload.theGainOnSuccess =
        (payload.theGainOnSuccess ?? THE_PROC_GAIN) + mods.procGainBonus + interceptBonus
    }
  }

  // Ho branch — intercept riders.
  if (mods.interceptWardRatio > 0) {
    const marker = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'ho_mon')
    for (const payload of defPayloads<ReactiveProcPayload>(marker, 'reactive_proc')) {
      if (payload.mechanic === 'intercept') {
        payload.grantsWardToOriginalTarget = {
          buffDefinitionId: 'ho_ve' as BuffDefinitionId,
          sourceMaxHpRatio: mods.interceptWardRatio,
        }
      }
    }
  }

  // Phan branch — evade-context heavy counter payload swap.
  if (mods.evadeCounterMultiplierBonus > 0 && ownedRoots.includes('phan_mon')) {
    const marker = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'phan_mon')
    for (const payload of defPayloads<ReactiveProcPayload>(marker, 'reactive_proc')) {
      if (payload.trigger === 'onEvade' && payload.queuedAction) {
        payload.queuedAction = { ...payload.queuedAction, payloadSkillId: TRONG_PHAN_KICH.id }
      }
    }
  }

  // Reactive payloads are participant-local clones resolved by the typed
  // follow-up queue (plan Task 16). A root that isn't owned means the
  // mechanic never checks AND no payload exists to resolve.
  if (ownedRoots.includes('phan_mon')) {
    kit.reactivePayloads[PHAN_KICH.id] = structuredClone(PHAN_KICH)

    if (mods.evadeCounterMultiplierBonus > 0) {
      const heavy = structuredClone(TRONG_PHAN_KICH)
      if (heavy.damage) {
        heavy.damage = { ...heavy.damage, multiplier: heavy.damage.multiplier + mods.evadeCounterMultiplierBonus }
      }
      kit.reactivePayloads[TRONG_PHAN_KICH.id] = heavy
    }

    // Break rider — the counter payload gains a choang application
    // through the existing appliesAilments channel (same mechanism as
    // bach_ung's payloadAilments merge).
    if (mods.counterChoangChance > 0) {
      for (const payload of Object.values(kit.reactivePayloads)) {
        if (payload.id === PHAN_KICH.id || payload.id === TRONG_PHAN_KICH.id) {
          payload.appliesAilments = [
            ...(payload.appliesAilments ?? []),
            { buffDefinitionId: 'choang', chance: Math.min(1, mods.counterChoangChance) },
          ]
        }
      }
    }
  }
  if (ownedRoots.includes('tro_mon')) {
    kit.reactivePayloads[TRO_KICH.id] = structuredClone(TRO_KICH)
  }

  // Tro branch — marker riders (heal the triggering ally; non-damaging
  // window opt-in). The cost delta already landed in the shared loop.
  const troMarker = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'tro_mon')
  for (const payload of defPayloads<ReactiveProcPayload>(troMarker, 'reactive_proc')) {
    if (payload.mechanic !== 'follow_up') continue
    if (mods.troHealTriggeringAllyRatio > 0) {
      payload.healsTriggeringAllyMaxHpRatio = mods.troHealTriggeringAllyRatio
    }
    if (mods.troAnyAction > 0) {
      payload.firesOnNonDamagingAction = true
    }
  }

  return kit
}

export interface TheTuKit {
  basic: TurnSkillDefinition
  /** Beta window: the Trúc Cơ special is present ONLY when the owning
      realm-gated node granted its core (undefined at Luyện Khí). */
  special?: TurnSkillDefinition
  /** Beta window: no Ultimate exists (Bất Tử Bá Thể / Sơn Nhạc are
      post-beta content). Slot stays undefined. */
  ultimate?: TurnSkillDefinition
}

/** The Tu Reimagined (plan Task 16) — the An kit also carries the
 * reactive payload clones the typed follow-up queue resolves. Task 20:
 * `maxThe` is the participant's proc-fuel cap (MAX_THE + node bonus),
 * stamped onto the entity by the adapter at participant build. */
export interface TheTuAnKit {
  basic: TurnSkillDefinition
  special: TurnSkillDefinition
  ultimate: TurnSkillDefinition
  reactivePayloads: Record<string, TurnSkillDefinition>
  maxThe: number
}

/** The Tu beta — per-root authored defs; slot grant is decided by
    ownership flags at build (root -> basic always; TC node -> special). */
export const THE_TU_KIT_BY_ROOT: Record<
  'cuong_chien' | 'tran_the',
  { basic: TurnSkillDefinition; special: TurnSkillDefinition }
> = {
  cuong_chien: { basic: CUONG_QUYEN, special: LOAN_DAU },
  tran_the: { basic: TRAN_AP, special: PHAN_CHAN },
}

export type TheTuRootId = keyof typeof THE_TU_KIT_BY_ROOT

/**
 * Participant-build factory: returns participant-local CLONES with
 * collectBodyKitModifiers totals baked in (review P0.2/INV-5 — the
 * registry defs are never mutated; each battle builds fresh copies).
 *
 * Beta ownership gates (design: Basic at Luyện Khí, Special at Trúc
 * Cơ): `owned.special` controls the special slot; the ultimate slot is
 * never produced in beta. Huyết Cuồng is kit-local: the missing-HP
 * bonus lands on the Cuồng Chiến clones ONLY when Loạn Đấu is owned.
 */
export function buildTheTuKit(
  root: TheTuRootId,
  mods: BodyKitModifierValues,
  owned: { special?: boolean } = {},
): TheTuKit {
  const source = THE_TU_KIT_BY_ROOT[root]
  const kit: TheTuKit = {
    basic: structuredClone(source.basic),
    special: owned.special === true ? structuredClone(source.special) : undefined,
  }

  if (root === 'cuong_chien') {
    // Trong Quyen + Pha Kinh (basic-local riders).
    if (kit.basic.damage !== undefined) {
      kit.basic.damage = {
        ...kit.basic.damage,
        multiplier: kit.basic.damage.multiplier + mods.cuongQuyenCoefficientBonus,
      }
    }
    if (mods.cuongQuyenArmorPierce > 0) {
      kit.basic.instances = {
        count: 1,
        each: {
          armorPierce: { bypassChance: 0, pierceFraction: mods.cuongQuyenArmorPierce },
        },
      }
    }

    // Huyet Cuong (kit-local missing-HP passive) opens WITH the TC
    // special: bake onto both clones only when Loan Dau is owned.
    if (kit.special !== undefined) {
      for (const def of [kit.basic, kit.special]) {
        if (def.damage !== undefined) {
          def.damage = {
            ...def.damage,
            missingHpBonusPerMissingPercent:
              HUYET_CUONG_PER_PERCENT + mods.missingHpBonusBonus,
            missingHpBonusCap: HUYET_CUONG_CAP,
          }
        }
      }
      // Huyet Sat — paid-HP payoff on the sacrifice's coefficient.
      kit.special.damageBonusPerPaidHpPoint =
        (kit.special.damageBonusPerPaidHpPoint ?? 0) + mods.loanDauPaidHpBonus
    }
  } else {
    // Trong The — Max-HP conversion on the AoE basic.
    if (kit.basic.damage !== undefined) {
      kit.basic.damage = {
        ...kit.basic.damage,
        sourceMaxHpRatio:
          (kit.basic.damage.sourceMaxHpRatio ?? 0) + mods.tranApMaxHpRatioBonus,
      }
    }
    // Tran Kinh rider — the tran_kinh weaken application exists only
    // while the node is owned; node levels add stacks (statModifier
    // flat scales x stacks).
    if (mods.tranKinhStacksBonus > 0) {
      kit.basic.appliesAilments = [
        ...(kit.basic.appliesAilments ?? []),
        {
          buffDefinitionId: 'tran_kinh',
          chance: 1,
          stacks: 1 + Math.floor(mods.tranKinhStacksBonus),
        },
      ]
    }

    // Chan Cot + Tran An — reflect coefficient / mark amplification on
    // the participant-local phan_chan buff CLONE (registry def never
    // mutates; the clone lands via grantsBuffsAtBuild).
    const passiveBuff: BuffDefinition | undefined =
      kit.special?.grantsBuffsAtBuild?.find((def) => def.id === 'phan_chan')
    const reflect = defPayloads<ReactiveTriggerPayload>(passiveBuff, 'reactive_trigger').find(
      (payload) => payload.reflectsDamage !== undefined,
    )
    if (reflect?.reflectsDamage !== undefined) {
      reflect.reflectsDamage = {
        ...reflect.reflectsDamage,
        maxHpRatio: reflect.reflectsDamage.maxHpRatio + mods.reflectMaxHpRatioBonus,
        ...(reflect.reflectsDamage.markedMaxHpRatio !== undefined
          ? {
              markedMaxHpRatio:
                reflect.reflectsDamage.markedMaxHpRatio + mods.reflectMarkedRatioBonus,
            }
          : {}),
      }
    }
  }

  return kit
}
