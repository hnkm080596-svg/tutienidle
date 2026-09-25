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
import { GRID_COLUMN_COUNT } from '../../core/battle/BattleGrid'
import { MAX_THE } from '../../core/combat/CombatTypes'
import {
  DAN_THE_BUFF,
  HO_MON_MARKER,
  PHAN_CHAN_BUFF,
  PHAN_MON_MARKER,
  TRAN_KINH_WEAKEN_RATIO,
  TRO_MON_MARKER,
  UNG_THE_BUFF,
} from '../buff/TheTuBuffs'

// The Tu beta (the-tu-body-pathway-design) - the two body_pathway roots
// are NATIVE TurnSkillDefinitions (not Skill objects; body has no
// cast-leveled skills). Kit resolution reads the owned root at
// participant build: cuong_chien / tran_the are an excludesNode mutex
// pair, no root -> GENERIC_PHYSICAL_BASIC only (INV-3). Beta window =
// Luyen Khi -> Truc Co: roots grant the Basic only; the Truc Co
// special node grants the Special (Loan Dau / Phan Chan); NO Ultimate
// exists in beta (Bat Tu Ba The / Son Nhac stay authored, unreachable).
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

// --- Cuong Chien (Might -> single-target) - root 'cuong_chien' ---

/**
 * Cuong Quyen - the Cuong Chien Basic: single-target physical at high
 * Might conversion. Beta design: NEVER an HP cost, and NO missing-HP
 * scaling at Luyen Khi (missing-HP is the Truc Co Huyet Cuong passive
 * baked onto the clone when Loan Dau is owned - kit-local, never on
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
 * Loan Dau - the Truc Co Special: pay `sacrificeMaxHpRatio` x MAX HP
 * first (the authority floors the payment at leaving 1 HP - never a
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
 * Bat Tu Ba The - LEGACY (post-beta content): parked authored def. The
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

// --- Tran The (Max HP -> AoE) - root 'tran_the' ---

/**
 * Tran Ap - the Tran The Basic: physical AoE across all valid enemies,
 * primary scaling = caster MAX HP (sourceMaxHpRatio rides the raw base
 * pre-mitigation). Trong The node levels add sourceMaxHpRatio on the
 * clone; the Tran Kinh node adds the tran_kinh weaken application.
 * all_lanes reads anchor.col +/- columnRadius on every row - enemy
 * slots sit 2 columns apart, so the full-grid radius is what actually
 * makes this hit every valid enemy (default radius would band ~1 col).
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
  targeting: { shape: 'all_lanes', columnRadius: GRID_COLUMN_COUNT },
}

/**
 * Phan Chan - the Truc Co Special: a REAL castable action dealing NO
 * direct damage. The cast applies Khieu Khich (taunt) + Chan An (mark)
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
 * Son Nhac - LEGACY (post-beta content): parked authored def (team
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

// --- ung_the (The Tu An - Ung The beta) ---
// Kit at path choice is ONLY the basic Tham The: Phan rides it as a
// BASELINE reactive (phan_mon marker always on). Quan The (the Truc Co
// special) is not in the kit until the major_quan_the node grants its
// skill core - its ownership also plants the Ho/Tro markers. No
// Ultimate exists in beta (Bach Ung is parked post-beta content).

export const THAM_THE: TurnSkillDefinition = {
  id: 'tham_the',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
}

// Tu The - LEGACY-SUPERSEDED: parked authored def. Removed from the kit
// + way.coreSkillIds by the Ung The beta (like parked bat_tu_ba_the);
// the def + its buff stay authored for post-beta revival.
export const TU_THE: TurnSkillDefinition = {
  id: 'tu_the',
  cooldownTurns: 5,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'tu_the', target: 'self' }],
}

// Bach Ung - LEGACY-SUPERSEDED: parked future content (ultimate slot
// stays empty in beta); the def + its buff stay authored.
export const BACH_UNG: TurnSkillDefinition = {
  id: 'bach_ung',
  cooldownTurns: 8,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'bach_ung', target: 'self' }],
}

/**
 * Quan The - the Truc Co Special: self-cast, NO damage. On cast it
 * applies the quan_the marker (every enemy satisfies isObserved while
 * it sits; FIXED_TURNS(4) counts HOLDER turns) and grants a flat The
 * seed via theGainOnLandedCast - the ONLY thing Core Level scales
 * (baked per-participant at kit build).
 */
export const QUAN_THE: TurnSkillDefinition = {
  id: 'quan_the',
  cooldownTurns: 6,
  targetScope: 'self',
  targeting: { shape: 'single' },
  appliesBuffs: [{ definitionId: 'quan_the', target: 'self' }],
  theGainOnLandedCast: 25,
}

// Reactive payloads (spec 6.2) - real TurnSkillDefinitions resolved as
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
 * Trong Phan Kich - the post-evasion heavy-counter payload variant
 * (spec 8.2 "post-evasion heavy counter"). Never in the registry slot
 * rotation: buildTheTuAnKit clones it into reactivePayloads and swaps
 * the phan_mon marker's onEvade queuedAction to this id only when the
 * evadeCounterMultiplierBonus node channel is owned. Base multiplier
 * equals phan_kich's - the node bonus is the whole delta.
 */
export const TRONG_PHAN_KICH: TurnSkillDefinition = {
  id: 'trong_phan_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1, levelScaling: 0.05 },
  targeting: { shape: 'single' },
  progressionOwnerId: 'tham_the',
}

/**
 * Ung The beta ownership inputs (design authority Part V/Part XIII):
 * `quanThe` = the major_quan_the node granted the Quan The skill core
 * (level > 0); `quanTheCoreLevel` scales ONLY the cast's initial The
 * gain - Core Level is the sole scaling axis the node can reach.
 */
export interface TheTuAnKitOwnership {
  quanThe: boolean
  quanTheCoreLevel: number
}

const ZERO_AN_MODS: HiddenBodyMechanicModifierValues = {
  observationGainBonus: 0,
  phanKinhArmorPierce: 0,
  interceptWardRatio: 0,
  evadeCounterMultiplierBonus: 0,
  danTheBonus: 0,
}

/** Core Level adds this much The to Quan The's authored base gain each level. */
export const QUAN_THE_THE_PER_LEVEL = 10

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
  mods: HiddenBodyMechanicModifierValues = ZERO_AN_MODS,
  owned: TheTuAnKitOwnership = { quanThe: false, quanTheCoreLevel: 1 },
): TheTuAnKit {
  const kit: TheTuAnKit = {
    basic: structuredClone(THAM_THE),
    special: owned.quanThe ? structuredClone(QUAN_THE) : undefined,
    ultimate: undefined,
    reactivePayloads: {
      // Phan is BASELINE on Tham The (design Part IV): the payload
      // clone always exists; the phan_mon marker is always planted.
      [PHAN_KICH.id]: structuredClone(PHAN_KICH),
    },
    maxThe: MAX_THE,
  }

  kit.basic.grantsBuffsAtBuild = [
    structuredClone(UNG_THE_BUFF),
    structuredClone(PHAN_MON_MARKER),
    ...(owned.quanThe
      ? [structuredClone(HO_MON_MARKER), structuredClone(TRO_MON_MARKER)]
      : []),
  ]

  // Thau The - observed-action income bonus bakes onto the marker
  // clone's authored field; the engine reads it, never the constant.
  const ungThe = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'ung_the')
  for (const payload of defPayloads<TheEconomyPayload>(ungThe, 'the_economy')) {
    payload.gainOnObservedAction =
      (payload.gainOnObservedAction ?? 0) + mods.observationGainBonus
  }

  if (kit.special !== undefined) {
    // Quan The Core Level = the ONLY scaling axis (design Part V):
    // it raises the cast's initial The gain and nothing else.
    kit.special.theGainOnLandedCast =
      (kit.special.theGainOnLandedCast ?? 0) + QUAN_THE_THE_PER_LEVEL * Math.max(0, owned.quanTheCoreLevel - 1)

    // Ho Bich - a committed intercept wards the rescued ally.
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

    // Tro payload exists only while Quan The is owned.
    const troKich = structuredClone(TRO_KICH)
    if (mods.danTheBonus > 0) {
      // Dan The rider - a landed Tro Kich applies the one-shot mark
      // through the existing appliesAilments channel (landed-only).
      troKich.appliesAilments = [
        ...(troKich.appliesAilments ?? []),
        { buffDefinitionId: DAN_THE_BUFF.id, chance: 1 },
      ]
    }
    kit.reactivePayloads[TRO_KICH.id] = troKich
  }

  // Trong Phan - evade-context heavy counter payload swap on the marker
  // plus the payload clone (base phan_kich multiplier + node bonus).
  if (mods.evadeCounterMultiplierBonus > 0) {
    const marker = (kit.basic.grantsBuffsAtBuild ?? []).find((def) => def.id === 'phan_mon')
    for (const payload of defPayloads<ReactiveProcPayload>(marker, 'reactive_proc')) {
      if (payload.trigger === 'onEvade' && payload.queuedAction !== undefined) {
        payload.queuedAction = { ...payload.queuedAction, payloadSkillId: TRONG_PHAN_KICH.id }
      }
    }
    const heavy = structuredClone(TRONG_PHAN_KICH)
    if (heavy.damage !== undefined) {
      heavy.damage = {
        ...heavy.damage,
        multiplier: heavy.damage.multiplier + mods.evadeCounterMultiplierBonus,
      }
    }
    kit.reactivePayloads[TRONG_PHAN_KICH.id] = heavy
  }

  // Phan Kinh - armor-bypass rider on the counter payload clones (same
  // instances.each.armorPierce channel the Cuong Chien Pha Kinh node
  // uses; bypassChance 0 => never full-bypass, always partial pierce).
  if (mods.phanKinhArmorPierce > 0) {
    for (const payload of Object.values(kit.reactivePayloads)) {
      if (payload.id === PHAN_KICH.id || payload.id === TRONG_PHAN_KICH.id) {
        payload.instances = {
          count: payload.instances?.count ?? 1,
          each: {
            ...(payload.instances?.each ?? {}),
            armorPierce: { bypassChance: 0, pierceFraction: mods.phanKinhArmorPierce },
          },
        }
      }
    }
  }

  return kit
}

export interface TheTuKit {
  basic: TurnSkillDefinition
  /** Beta window: the Truc Co special is present ONLY when the owning
      realm-gated node granted its core (undefined at Luyen Khi). */
  special?: TurnSkillDefinition
  /** Beta window: no Ultimate exists (Bat Tu Ba The / Son Nhac are
      post-beta content). Slot stays undefined. */
  ultimate?: TurnSkillDefinition
}

/** The Tu Reimagined (plan Task 16) - the An kit also carries the
 * reactive payload clones the typed follow-up queue resolves. Task 20:
 * `maxThe` is the participant's proc-fuel cap (MAX_THE + node bonus),
 * stamped onto the entity by the adapter at participant build. */
export interface TheTuAnKit {
  basic: TurnSkillDefinition
  /** Beta window: Quan The exists only while its skill core is owned. */
  special?: TurnSkillDefinition
  /** Beta window: no Ultimate exists (Bach Ung is post-beta content). */
  ultimate?: TurnSkillDefinition
  reactivePayloads: Record<string, TurnSkillDefinition>
  maxThe: number
}

/** The Tu beta - per-root authored defs; slot grant is decided by
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
 * collectBodyKitModifiers totals baked in (review P0.2/INV-5 - the
 * registry defs are never mutated; each battle builds fresh copies).
 *
 * Beta ownership gates (design: Basic at Luyen Khi, Special at Truc
 * Co): `owned.special` controls the special slot; the ultimate slot is
 * never produced in beta. Huyet Cuong is kit-local: the missing-HP
 * bonus lands on the Cuong Chien clones ONLY when Loan Dau is owned.
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
      // Merge, don't replace: a future instances-bearing basic keeps its
      // authored count/extra riders and gains the armorPierce entry.
      kit.basic.instances = {
        count: kit.basic.instances?.count ?? 1,
        each: {
          ...(kit.basic.instances?.each ?? {}),
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
      // Huyet Sat - paid-HP payoff on the sacrifice's coefficient.
      kit.special.damageBonusPerPaidHpPoint =
        (kit.special.damageBonusPerPaidHpPoint ?? 0) + mods.loanDauPaidHpBonus
    }
  } else {
    // Trong The - Max-HP conversion on the AoE basic.
    if (kit.basic.damage !== undefined) {
      kit.basic.damage = {
        ...kit.basic.damage,
        sourceMaxHpRatio:
          (kit.basic.damage.sourceMaxHpRatio ?? 0) + mods.tranApMaxHpRatioBonus,
      }
    }
    // Tran Kinh rider - the tran_kinh weaken application exists only
    // while the node is owned; node levels add stacks (statModifier
    // flat scales x stacks).
    if (mods.tranKinhWeakenRatio > 0) {
      kit.basic.appliesAilments = [
        ...(kit.basic.appliesAilments ?? []),
        {
          buffDefinitionId: 'tran_kinh',
          chance: 1,
          stacks:
            1 +
            Math.round(mods.tranKinhWeakenRatio / TRAN_KINH_WEAKEN_RATIO),
        },
      ]
    }

    // Chan Cot + Tran An - reflect coefficient / mark amplification on
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
