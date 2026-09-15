import type { ElementType } from '../../core/element/ElementType'
import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { DamageScalingConfig } from '../../core/combat/DamageCalculator'
import type { PhapTuUltimateVariant } from '../../core/phap-tu/PhapTuRoutes'

// Phap Tu Reimagined Task 10 — the god-ult (Phap Tuong) payload table.
// These are native TurnSkillDefinitions, NOT Skill objects: the legacy
// Skill entries in PhapTuChainSkills.ts carry realtime-only fields
// (grantsZone, swordZone*, hitCount, remove_buff) the turn engine never
// executes — the payload below keeps only what the engine resolves.
//
// Shape per entry:
// - consumesAllThe: the empowered form burns the ENTIRE currentThe pool
//   at commit (captured into execution.theBurned for Task 13 theScaling)
// - cooldownTurns 0: the payload owns no cooldown — the equipped chain-E
//   slot's cooldown governs (root identity, INV-18)
// - id = the god-ult id (tat_phuong_giang_the …) for presentation; it
//   never appears in cast counts.
//
// Route variants (RouteProfile.empoweredUlt): 'detonate' gains
// detonateDoT and 'nuke' gains theScaling in Task 13 — the base payload
// below is shared until then. Water folds its authored hitCount x8 into
// the multiplier (0.6 x 8 = 4.8); wood merges its add_stack +2 into the
// ailment stacks like the converter does; metal keeps its engine-native
// consumesAilmentId detonate (chay_mau x80).

const ATTUNEMENT_SCALING: DamageScalingConfig = {
  manaScalingRatio: 0.001,
  attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
}

const FIRE_PAYLOAD: TurnSkillDefinition = {
  id: 'tat_phuong_giang_the',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: {
    kind: 'elemental',
    components: [{ kind: 'element', element: 'fire', ratio: 1 }],
    multiplier: 4,
    scaling: { ...ATTUNEMENT_SCALING },
  },
  targeting: { shape: 'all_lanes', columnRadius: 1 },
  appliesAilment: { buffDefinitionId: 'bong', chance: 1 },
  appliesAilments: [{ buffDefinitionId: 'bong', chance: 1 }],
}

const WATER_PAYLOAD: TurnSkillDefinition = {
  id: 'bat_thu_can_quet',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: {
    kind: 'elemental',
    components: [{ kind: 'element', element: 'water', ratio: 1 }],
    multiplier: 4.8,
    scaling: { ...ATTUNEMENT_SCALING },
  },
  targeting: { shape: 'all_lanes' },
  appliesAilment: { buffDefinitionId: 'te_cong', chance: 1 },
  appliesAilments: [{ buffDefinitionId: 'te_cong', chance: 1 }],
}

const WOOD_PAYLOAD: TurnSkillDefinition = {
  id: 'kien_moc_thong_thien',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: {
    kind: 'elemental',
    components: [{ kind: 'element', element: 'wood', ratio: 1 }],
    multiplier: 4,
    scaling: { ...ATTUNEMENT_SCALING },
  },
  targeting: { shape: 'all_lanes' },
  appliesAilment: { buffDefinitionId: 'troi_chan', chance: 1 },
  appliesAilments: [
    { buffDefinitionId: 'troi_chan', chance: 1 },
    // debuff 1 stack + authored add_stack +2 = 3 (converter merge rule).
    { buffDefinitionId: 'trung_doc', chance: 1, stacks: 3 },
  ],
}

const METAL_PAYLOAD: TurnSkillDefinition = {
  id: 'kim_phat_thu_sat',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: {
    kind: 'elemental',
    components: [{ kind: 'element', element: 'metal', ratio: 1 }],
    multiplier: 6,
    scaling: { ...ATTUNEMENT_SCALING },
  },
  targeting: { shape: 'single' },
  consumesAilmentId: 'chay_mau',
  damagePerStack: 80,
}

const EARTH_PAYLOAD: TurnSkillDefinition = {
  id: 'hau_tho_thanh_luy',
  cooldownTurns: 0,
  consumesAllThe: true,
  damage: {
    kind: 'elemental',
    components: [{ kind: 'element', element: 'earth', ratio: 1 }],
    multiplier: 4,
    scaling: { ...ATTUNEMENT_SCALING },
  },
  targeting: { shape: 'all_lanes' },
  appliesAilment: { buffDefinitionId: 'troi_chan', chance: 1 },
  appliesAilments: [{ buffDefinitionId: 'troi_chan', chance: 1 }],
  appliesBuff: { definitionId: 'thanh_luy', target: 'target' },
}

/**
 * The empowered payload lookup: element x route variant. Both variants
 * share the base payload until Task 13 differentiates detonateDoT /
 * theScaling — the table shape is the seam Task 10 wires.
 */
export const PHAP_TU_EMPOWERED_ULTS: Record<ElementType, Record<PhapTuUltimateVariant, TurnSkillDefinition>> = {
  fire: { detonate: FIRE_PAYLOAD, nuke: FIRE_PAYLOAD },
  water: { detonate: WATER_PAYLOAD, nuke: WATER_PAYLOAD },
  wood: { detonate: WOOD_PAYLOAD, nuke: WOOD_PAYLOAD },
  metal: { detonate: METAL_PAYLOAD, nuke: METAL_PAYLOAD },
  earth: { detonate: EARTH_PAYLOAD, nuke: EARTH_PAYLOAD },
}
