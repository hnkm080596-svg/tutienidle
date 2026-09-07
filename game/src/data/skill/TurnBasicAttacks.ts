// Turn-Based Combat Completion (Task 5) — mapping nội dung THẬT lên
// TurnSkillDefinition cho 8 builds + enemy special, theo Slice 2 spec §3
// ("straight field copy, not a redesign"):
// - Kiếm Tu: 'tram' (Huy Kiếm, dealDamage value 1 physical, resourceType none)
// - 5 Pháp Tu Thuần: skill đầu mỗi chuỗi CHAIN_SKILL_IDS, mỗi skill 1
//   component element ratio 1 (Skills.ts L140/374/319/450/532)
// - Thể Tu + Phàm Nhân (chưa chọn đạo): KHÔNG dùng Skill object — hệ sống
//   dùng generic melee (basic attack qua attack stat), map thành
//   TurnSkillDefinition physical multiplier 1 tương đương
// - Enemy: hầu như chỉ basic attack (attack stat) — chung generic physical.
//   Riêng Thủy Giáp Long author specialAttacks[0] = Nuốt Sáng (everyNth 4,
//   damageMultiplier 2.5) — mọiNth counter là trách nhiệm của caller
//   (GameManager adapter), định nghĩa skill ở đây chỉ là shape damage.
import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'

export const KIEM_TU_BASIC: TurnSkillDefinition = {
  id: 'tram',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

// Phase A1 (2026-09-07) — each entry gains appliesAilment with the EXACT
// chance authored on the same skill's legacy Skill definition in Skills.ts
// (ailmentChance): fire 0.5, water 0.5, wood 1.0, metal 0.4, earth 1.0.
// These make elemental reactions (TurnReactionManager) reachable in real
// turn-based combat.
export const PHAP_TU_BASICS: Record<'fire' | 'water' | 'wood' | 'metal' | 'earth', TurnSkillDefinition> = {
  fire: { id: 'hoa_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'bong', chance: 0.5 } },
  water: { id: 'thuy_tien_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'te_cong', chance: 0.5 } },
  wood: { id: 'doc_chuong', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'wood', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'trung_doc', chance: 1 } },
  metal: { id: 'diem_kim_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'metal', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'chay_mau', chance: 0.4 } },
  earth: { id: 'tho_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'earth', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'thach_hoa', chance: 1 } },
}

/** Thể Tu + Phàm Nhân — generic melee, hệ sống không dùng Skill object. */
export const GENERIC_PHYSICAL_BASIC: TurnSkillDefinition = {
  id: 'generic_physical',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

export const BASIC_ATTACKS_BY_BUILD: Record<string, TurnSkillDefinition> = {
  kiem_tu: KIEM_TU_BASIC,
  phap_tu_fire: PHAP_TU_BASICS.fire,
  phap_tu_water: PHAP_TU_BASICS.water,
  phap_tu_wood: PHAP_TU_BASICS.wood,
  phap_tu_metal: PHAP_TU_BASICS.metal,
  phap_tu_earth: PHAP_TU_BASICS.earth,
  the_tu: GENERIC_PHYSICAL_BASIC,
  pham_nhan: GENERIC_PHYSICAL_BASIC,
}

/**
 * Enemy specialAttacks[0] của Thủy Giáp Long (Enemies.ts:1764) — đòn thứ 4
 * "Nuốt Sáng" (×2.5 damage nước). Turn-based: caller (GameManager adapter)
 * đếm everyNth theo lượt của enemy; damage multiplier đích thực nằm ở
 * damage.multiplier (enemy attack stat × 2.5 qua resolveActionHit).
 */
export const THUY_GIAP_LONG_WATER_SURGE: TurnSkillDefinition = {
  id: 'water_surge',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 2.5 },
  targeting: { shape: 'single' },
}

export const REQUIRED_BUILD_IDS = [
  'kiem_tu',
  'phap_tu_fire',
  'phap_tu_water',
  'phap_tu_wood',
  'phap_tu_metal',
  'phap_tu_earth',
  'the_tu',
  'pham_nhan',
] as const
