// Turn-Based Combat Completion (Task 5) — mapping nội dung THẬT lên
// TurnSkillDefinition cho 8 builds + enemy special, theo Slice 2 spec §3
// ("straight field copy, not a redesign"):
// - Kiếm Tu: 'tram' (Huy Kiếm, dealDamage value 1 physical, resourceType none)
// - 5 Pháp Tu Thuần: skill đầu mỗi chuỗi PHAP_TU_KIT_IDS, mỗi skill 1
//   component element ratio 1 (Skills.ts L140/374/319/450/532)
// - Thể Tu + Phàm Nhân (chưa chọn đạo): KHÔNG dùng Skill object — hệ sống
//   dùng generic melee (basic attack qua might stat), map thành
//   TurnSkillDefinition physical multiplier 1 tương đương
// - Enemy: hầu như chỉ basic attack (might stat) — chung generic physical.
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
// These make elemental ailment application reachable in real turn-based
// combat.
//
// TEST FIXTURES ONLY — production Phap Tu basics resolve through the
// canonical Skill -> TurnSkillDefinition converter (GameManager
// resolvePlayerBasicAttack / resolveAnElementBasicPool); this static copy
// is not an authority and must not re-enter a production path (it has no
// authored manaScalingRatio/attributeScaling). doc_chuong mirrors the
// authored shape: ailment-only, no direct damage.
export const PHAP_TU_BASICS: Record<'fire' | 'water' | 'wood' | 'metal' | 'earth', TurnSkillDefinition> = {
  fire: { id: 'hoa_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'bong', chance: 0.5 } },
  water: { id: 'thuy_tien_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'te_cong', chance: 0.5 } },
  wood: { id: 'doc_chuong', cooldownTurns: 0, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'trung_doc', chance: 1 } },
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
}

/**
 * Enemy specialAttacks[0] của Thủy Giáp Long (Enemies.ts:1764) — đòn thứ 4
 * "Nuốt Sáng" (×2.5 damage nước). Turn-based: caller (GameManager adapter)
 * đếm everyNth theo lượt của enemy; damage multiplier đích thực nằm ở
 * damage.multiplier (enemy might stat × 2.5 qua resolveActionHit).
 */
export const THUY_GIAP_LONG_WATER_SURGE: TurnSkillDefinition = {
  id: 'water_surge',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 2.5 },
  targeting: { shape: 'single' },
}

// Builds whose basic is authored HERE as a static TurnSkillDefinition.
// Phap Tu paths are deliberately absent: their basics convert from the
// authored Skill at battle build (single authority — fail-fast on
// converter rejection, no static substitute). The Tu is absent too
// (M7 — dead row removed): both ways resolve their kit at battle build
// and fall back to GENERIC_PHYSICAL_BASIC directly, never via this map.
// Mortal (no cultivationPath) falls through to GENERIC_PHYSICAL_BASIC —
// the removed 'pham_nhan' row only ever mapped to that same fallback.
export const REQUIRED_BUILD_IDS = [
  'kiem_tu',
] as const
