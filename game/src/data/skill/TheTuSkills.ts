import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { BuffDefinition } from '../../core/buff/BuffTypes'
import type { TheTuKitModifierValues } from '../../core/the-tu/TheTuKitModifiers'
import type { TheTuAnMechanicModifierValues } from '../../core/the-tu/TheTuAnMechanicModifiers'
import { THE_PROC_COST, THE_PROC_GAIN } from '../../core/the-tu/TheEconomy'
import { MAX_THE } from '../../core/combat/CombatTypes'
import {
  HO_MON_MARKER,
  KHIEM_KHICH_TURNS,
  PHAN_CHINH_BUFF,
  PHAN_MON_MARKER,
  TRO_MON_MARKER,
  UNG_THE_BUFF,
} from '../buff/TheTuBuffs'

// The Tu Reimagined (spec 2026-09-15 section 5, plan Task 6) — the two
// Hien kits are NATIVE TurnSkillDefinitions (not Skill objects; the_tu
// has no cast-leveled skills). Kit resolution reads the owned root at
// participant build: cuong_chien / tran_the are an excludesNode mutex
// pair (INV-2), no root -> GENERIC_PHYSICAL_BASIC only (INV-3).
//
// Tunable first-pass constants (spec section 11: "playtest-tunable"):
export const CUONG_QUYEN_MISSING_HP_PER_PERCENT = 0.02
export const CUONG_QUYEN_MISSING_HP_CAP = 2.0
export const SON_NHAC_WARD_RATIO = 0.25

// --- Cuong Chien (Berserker) — root 'cuong_chien' ---

export const CUONG_QUYEN: TurnSkillDefinition = {
  id: 'cuong_quyen',
  cooldownTurns: 0,
  damage: {
    kind: 'physical',
    multiplier: 1,
    missingHpBonusPerMissingPercent: CUONG_QUYEN_MISSING_HP_PER_PERCENT,
    missingHpBonusCap: CUONG_QUYEN_MISSING_HP_CAP,
  },
  targeting: { shape: 'single' },
}

export const LOAN_DAU: TurnSkillDefinition = {
  id: 'loan_dau',
  cooldownTurns: 4,
  damage: {
    kind: 'physical',
    multiplier: 2,
    missingHpBonusPerMissingPercent: CUONG_QUYEN_MISSING_HP_PER_PERCENT,
    missingHpBonusCap: CUONG_QUYEN_MISSING_HP_CAP,
  },
  targeting: { shape: 'single' },
}

/**
 * Bat Tu Ba The — manual cast applies the buff for 3 holder-turns; the
 * passive lethal trigger (Task 9) consumes this same cooldown and grants
 * the SAME resolved duration (durationOverride baked at participant
 * build — review P0.2: passive and manual can never drift).
 * selectAction MAY auto-fire it at full HP (spec T11, accepted).
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

// --- Tran The (Tank) — root 'tran_the' ---

export const TRAN_AP: TurnSkillDefinition = {
  id: 'tran_ap',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0.8 },
  targeting: { shape: 'all_lanes' },
}

/**
 * Phan Chinh — passive emblem occupying the special slot (spec section
 * 5.2, K13 emblem precedent): never selectable, never cast; its
 * permanent Reflection buff lands at participant build through
 * grantsBuffsAtBuild. buildTheTuKit embeds the participant-local def
 * CLONE here so node-adjusted ratios reach the applied buff.
 */
export const PHAN_CHINH: TurnSkillDefinition = {
  id: 'phan_chinh',
  cooldownTurns: 0,
  emblemOnly: true,
  targetScope: 'self',
  targeting: { shape: 'single' },
  grantsBuffsAtBuild: [PHAN_CHINH_BUFF],
}

/**
 * Son Nhac — team protection + Taunt + self DR:
 * - self: son_nhac DR buff (fixed holder-turns)
 * - allies except self: son_nhac_ho_the marker + external ward grant
 *   (sourceMaxHpRatio x tank.maxHp, resolved in Task 11)
 * - all enemies: khiem_khich Taunt debuff (their own turns)
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
  damage: { kind: 'physical', multiplier: 1 },
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
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

export const TRO_KICH: TurnSkillDefinition = {
  id: 'tro_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 0.7 },
  targeting: { shape: 'single' },
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
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
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
 * Task 20 (review P1.7): `mods` is the collectTheTuAnMechanicModifiers
 * total — trunk economy lands on the ung_the marker's theEconomy fields
 * + every reactiveProc's theCost/theGainOnSuccess; branch riders land on
 * their marker's own fields (intercept ward, evade payload swap, Tro
 * heal/non-damaging). maxThe rides the kit for the adapter to stamp on
 * the participant's entity.
 */
const ZERO_AN_MODS: TheTuAnMechanicModifierValues = {
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

export function buildTheTuAnKit(
  ownedRoots: readonly TheTuAnRootId[],
  mods: TheTuAnMechanicModifierValues = ZERO_AN_MODS,
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
  const ungThe = kit.basic.grantsBuffsAtBuild.find((def) => def.id === 'ung_the')
  for (const effect of ungThe?.effects ?? []) {
    if (effect.type !== 'theEconomy') continue
    effect.gainOnBasicHit = (effect.gainOnBasicHit ?? 0) + mods.basicGainBonus
    effect.gainOnEvade = (effect.gainOnEvade ?? 0) + mods.evadeGainBonus
    effect.gainOnHitTaken = (effect.gainOnHitTaken ?? 0) + mods.takenGainBonus
    effect.gainPerRound = (effect.gainPerRound ?? 0) + mods.roundGainBonus
  }

  // Every reactiveProc gets the trunk cost/gain adjustments; branch
  // riders land on their own marker's fields below.
  for (const marker of kit.basic.grantsBuffsAtBuild) {
    for (const effect of marker.effects) {
      if (effect.type !== 'reactiveProc') continue
      const troDelta = marker.id === 'tro_mon' ? mods.troCostDelta : 0
      effect.theCost = Math.max(0, (effect.theCost ?? THE_PROC_COST) + mods.procCostDelta + troDelta)
      const interceptBonus = marker.id === 'ho_mon' ? mods.interceptTheGainBonus : 0
      effect.theGainOnSuccess =
        (effect.theGainOnSuccess ?? THE_PROC_GAIN) + mods.procGainBonus + interceptBonus
    }
  }

  // Ho branch — intercept riders.
  if (mods.interceptWardRatio > 0) {
    const marker = kit.basic.grantsBuffsAtBuild.find((def) => def.id === 'ho_mon')
    for (const effect of marker?.effects ?? []) {
      if (effect.type === 'reactiveProc' && effect.mechanic === 'intercept') {
        effect.grantsWardToOriginalTarget = {
          buffDefinitionId: 'ho_ve',
          sourceMaxHpRatio: mods.interceptWardRatio,
        }
      }
    }
  }

  // Phan branch — evade-context heavy counter payload swap.
  if (mods.evadeCounterMultiplierBonus > 0 && ownedRoots.includes('phan_mon')) {
    const marker = kit.basic.grantsBuffsAtBuild.find((def) => def.id === 'phan_mon')
    for (const effect of marker?.effects ?? []) {
      if (effect.type === 'reactiveProc' && effect.trigger === 'onEvade' && effect.queuedAction) {
        effect.queuedAction = { ...effect.queuedAction, payloadSkillId: TRONG_PHAN_KICH.id }
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
  const troMarker = kit.basic.grantsBuffsAtBuild.find((def) => def.id === 'tro_mon')
  for (const effect of troMarker?.effects ?? []) {
    if (effect.type !== 'reactiveProc' || effect.mechanic !== 'follow_up') continue
    if (mods.troHealTriggeringAllyRatio > 0) {
      effect.healsTriggeringAllyMaxHpRatio = mods.troHealTriggeringAllyRatio
    }
    if (mods.troAnyAction > 0) {
      effect.firesOnNonDamagingAction = true
    }
  }

  return kit
}

export interface TheTuKit {
  basic: TurnSkillDefinition
  special: TurnSkillDefinition
  ultimate: TurnSkillDefinition
}

/** The Tu Reimagined (plan Task 16) — the An kit also carries the
 * reactive payload clones the typed follow-up queue resolves. Task 20:
 * `maxThe` is the participant's proc-fuel cap (MAX_THE + node bonus),
 * stamped onto the entity by the adapter at participant build. */
export interface TheTuAnKit extends TheTuKit {
  reactivePayloads: Record<string, TurnSkillDefinition>
  maxThe: number
}

export const THE_TU_KIT_BY_ROOT: Record<'cuong_chien' | 'tran_the', TheTuKit> = {
  cuong_chien: { basic: CUONG_QUYEN, special: LOAN_DAU, ultimate: BAT_TU_BA_THE },
  tran_the: { basic: TRAN_AP, special: PHAN_CHINH, ultimate: SON_NHAC },
}

export type TheTuRootId = keyof typeof THE_TU_KIT_BY_ROOT

/**
 * Participant-build factory: returns participant-local CLONES with
 * collectTheTuKitModifiers totals baked in (review P0.2/INV-5 — the
 * registry defs are never mutated; each battle builds fresh copies).
 */
export function buildTheTuKit(root: TheTuRootId, mods: TheTuKitModifierValues): TheTuKit {
  const source = THE_TU_KIT_BY_ROOT[root]
  const kit: TheTuKit = {
    basic: structuredClone(source.basic),
    special: structuredClone(source.special),
    ultimate: structuredClone(source.ultimate),
  }

  if (root === 'cuong_chien') {
    for (const def of [kit.basic, kit.special]) {
      if (def.damage && def.damage.missingHpBonusPerMissingPercent !== undefined) {
        def.damage.missingHpBonusPerMissingPercent += mods.missingHpBonusBonus
      }
    }

    const batTuApplication = kit.ultimate.appliesBuffs?.find(
      (application) => application.definitionId === 'bat_tu_ba_the',
    )
    if (batTuApplication) {
      batTuApplication.durationOverride = BAT_TU_BA_THE_TURNS + mods.batTuDurationBonus
    }
  } else {
    const emblemBuff: BuffDefinition | undefined = kit.special.grantsBuffsAtBuild?.find(
      (def) => def.id === 'phan_chinh',
    )
    const reflect = emblemBuff?.effects.find(
      (effect) => effect.type === 'reactiveTrigger' && effect.reflectsDamage !== undefined,
    )
    if (reflect?.type === 'reactiveTrigger' && reflect.reflectsDamage) {
      reflect.reflectsDamage = {
        maxHpRatio: reflect.reflectsDamage.maxHpRatio + mods.reflectMaxHpRatioBonus,
        takenRatio: reflect.reflectsDamage.takenRatio + mods.reflectTakenRatioBonus,
      }
    }

    for (const application of kit.ultimate.appliesBuffs ?? []) {
      if (application.definitionId === 'son_nhac_ho_the' && application.externalWardGrant) {
        application.externalWardGrant = {
          sourceMaxHpRatio: application.externalWardGrant.sourceMaxHpRatio + mods.sonNhacWardRatioBonus,
        }
      }
      if (application.definitionId === 'khiem_khich') {
        application.durationOverride = KHIEM_KHICH_TURNS + mods.tauntTurnsBonus
      }
    }
  }

  return kit
}
