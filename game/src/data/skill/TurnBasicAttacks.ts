// Turn-Based Combat Completion (Task 5) - mapping noi dung THAT len
// TurnSkillDefinition cho 8 builds + enemy special, theo Slice 2 spec sec3
// ("straight field copy, not a redesign"):
// - Kiem Tu: 'tram' (Huy Kiem, dealDamage value 1 physical, resourceType none)
// - 5 Phap Tu Thuan: skill dau moi chuoi SPELL_KIT_IDS, moi skill 1
//   component element ratio 1 (Skills.ts L140/374/319/450/532)
// - The Tu + Pham Nhan (chua chon dao): KHONG dung Skill object - he song
//   dung generic melee (basic attack qua might stat), map thanh
//   TurnSkillDefinition physical multiplier 1 tuong duong
// - Enemy: hau nhu chi basic attack (might stat) - chung generic physical.
//   Rieng Thuy Giap Long author specialAttacks[0] = Nuot Sang (everyNth 4,
//   damageMultiplier 2.5) - moiNth counter la trach nhiem cua caller
//   (GameManager adapter), dinh nghia skill o day chi la shape damage.
import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { CultivationPathId } from '../../core/player/CultivationPathKit'

export const SWORD_BASIC: TurnSkillDefinition = {
  id: 'tram',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

// Phase A1 (2026-09-07) - each entry gains appliesAilment with the EXACT
// chance authored on the same skill's legacy Skill definition in Skills.ts
// (ailmentChance): fire 0.5, water 0.5, wood 1.0, metal 0.4, earth 1.0.
// These make elemental ailment application reachable in real turn-based
// combat.
//
// TEST FIXTURES ONLY - production Phap Tu basics resolve through the
// canonical Skill -> TurnSkillDefinition converter (GameManager
// resolvePlayerBasicAttack / resolveAnElementBasicPool); this static copy
// is not an authority and must not re-enter a production path (it has no
// authored manaScalingRatio/attributeScaling). doc_chuong mirrors the
// authored shape: ailment-only, no direct damage.
export const SPELL_BASICS: Record<'fire' | 'water' | 'wood' | 'metal' | 'earth', TurnSkillDefinition> = {
  fire: { id: 'hoa_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'hoa_an', chance: 0.5 } },
  water: { id: 'thuy_tien_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'han_tuc', chance: 0.5 } },
  wood: { id: 'doc_chuong', cooldownTurns: 0, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'doc_can', chance: 1 } },
  metal: { id: 'diem_kim_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'metal', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'liet_thuong', chance: 0.4 } },
  earth: { id: 'tho_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'earth', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'tran_an', chance: 1 } },
}

/** The Tu + Pham Nhan - generic melee, he song khong dung Skill object. */
export const GENERIC_PHYSICAL_BASIC: TurnSkillDefinition = {
  id: 'generic_physical',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

/**
 * Monster attack VFX sweep (2026-10-04) - the enemy participant's basic
 * def. Enemies share the generic physical basic; CombatEntity.
 * attackPresetId (authored on the Enemy template) stamps the skill's
 * presetId so the shared skill-presentation pipeline renders the
 * attack-type VFX instead of the arcane_impact fallback. Skill id stays
 * 'generic_physical' - cast-clip resolution and skill bookkeeping are
 * unchanged.
 */
export function enemyBasicAttackFor(entity: { attackPresetId?: import('../../core/battle/CombatAction').CombatVfxPresetId }): TurnSkillDefinition {
  return entity.attackPresetId
    ? { ...GENERIC_PHYSICAL_BASIC, presetId: entity.attackPresetId }
    : GENERIC_PHYSICAL_BASIC
}

export const BASIC_ATTACKS_BY_BUILD: Partial<Record<CultivationPathId, TurnSkillDefinition>> = {
  sword: SWORD_BASIC,
}

/**
 * Enemy specialAttacks[0] cua Thuy Giap Long (Enemies.ts:1764) - don thu 4
 * "Nuot Sang" (x2.5 damage nuoc). Turn-based: caller (GameManager adapter)
 * dem everyNth theo luot cua enemy; damage multiplier dich thuc nam o
 * damage.multiplier (enemy might stat x 2.5 qua resolveActionHit).
 */
export const THUY_GIAP_LONG_WATER_SURGE: TurnSkillDefinition = {
  id: 'water_surge',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 2.5 },
  targeting: { shape: 'single' },
}

// Builds whose basic is authored HERE as a static TurnSkillDefinition.
// Phap Tu paths are deliberately absent: their basics convert from the
// authored Skill at battle build (single authority - fail-fast on
// converter rejection, no static substitute). The Tu is absent too
// (M7 - dead row removed): both ways resolve their kit at battle build
// and fall back to GENERIC_PHYSICAL_BASIC directly, never via this map.
// Mortal (no cultivationPath) falls through to GENERIC_PHYSICAL_BASIC -
// the removed 'pham_nhan' row only ever mapped to that same fallback.
export const REQUIRED_BUILD_IDS: readonly CultivationPathId[] = [
  'sword',
] as const
