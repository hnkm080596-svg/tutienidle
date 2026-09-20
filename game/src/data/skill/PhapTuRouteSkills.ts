import type { Skill } from '../../core/skill/Skill'

// Phap Tu Hoa An route kit (spec 2026-09-17-hoa-an-ailment-system-spec
// sec.62/74, unparked for the canonical-seals batch). These are ordinary
// Phap Tu route skills: they apply the canonical hoa_an seal and their
// seal interactions are SAME-SOURCE (spec sec.7 -- a caster's seal
// skills touch only their own instance). They react only while a
// van_phap_than_hoa aura holder casts them (Ngo Dao seam) -- the skills
// themselves are route-agnostic.
//
// Route mechanics ride the generic seams -- no skill-local route logic:
//   - application factor / +1 stack: RouteProfile via
//     PHAP_TU_ROUTE_SKILL_IDS membership (applyRouteToEffectiveSkill /
//     applyRouteToTurnSkill).
//   - route-gated payloads: per-interaction `routes` (Xich Viem's
//     DoT-only next-tick modifier).
// Numbers follow the chain cadence (B cd2/1.0, C cd3/1.2, D cd4/1.4,
// E cd6/1.8; dmg B 1.1 / C 1.3 / D 1.5 / E 2.4) with the chain scaling
// package (manaScalingRatio 0.001 + attunement 0.004).
export const PHAP_TU_ROUTE_SKILLS: Skill[] = [
  // -- Dan Hoa Quyet (B) -- the seal applicator: damage -> apply 1
  // Hoa An (spec sec.62). DoT route makes it stronger via the generic
  // profile (chance x1.25, +1 stack); no route weakens it (x0.50).
  {
    id: 'dan_hoa_quyet',
    name: 'Dẫn Hỏa Quyết',
    description: 'Dẫn hỏa quy vào kinh mạch địch — đòn Hỏa đắp một tầng Hỏa Ấn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      // Spec sec.12 authored example: base application chance 70%.
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.7 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
    buildTag: 'dot',
  },

  // -- Xich Viem Xuyen Tam (C) -- pierce scaling off own stacks.
  // Shared/no: query same-source Hoa An stacks -> scale direct damage,
  // never consume, never modify. DoT (routes gate): add next-tick
  // modifier x1.5, uses = 1 (spec sec.62/74).
  {
    id: 'xich_viem_xuyen_tam',
    name: 'Xích Viêm Xuyên Tâm',
    description: 'Lửa đỏ xuyên tim — Hỏa Ấn của chính mình càng sâu, đòn xuyên càng mạnh.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.3,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        scalesWithAilmentStacks: { ailmentId: 'hoa_an', damagePerStack: 0.15 },
        ailmentInteractions: [
          {
            kind: 'add_modifier',
            buffId: 'hoa_an',
            routes: ['dot'],
            modifier: {
              id: 'xich_viem_next_tick',
              channel: 'next_periodic_damage',
              operation: 'multiply',
              value: 1.5,
              reapply: 'replace',
              priority: 0,
              lifetime: { type: 'uses', remaining: 1 },
            },
          },
        ],
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
    buildTag: 'dot',
  },

  // -- Phan Thien Hoa Vuc (D) -- fire domain: apply -> manual tick x1
  // -> potency x1.5 for 2 target turns -> extend +2 turns (spec
  // sec.62/74, authored order). Manual tick keeps duration (sec.33);
  // holder_turns lifetime is not decremented by the manual tick
  // (sec.35).
  {
    id: 'phan_thien_hoa_vuc',
    name: 'Phần Thiên Hỏa Vực',
    description: 'Thiêu đốt cả một vùng trời — Hỏa Ấn tức khắc bùng phát rồi cháy mạnh hơn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        ailmentInteractions: [
          { kind: 'trigger_periodic', buffId: 'hoa_an' },
          {
            kind: 'add_modifier',
            buffId: 'hoa_an',
            modifier: {
              id: 'phan_thien_potency',
              channel: 'potency',
              operation: 'multiply',
              value: 1.5,
              reapply: 'replace',
              priority: 0,
              lifetime: { type: 'holder_turns', remaining: 2 },
            },
          },
          { kind: 'extend_duration', buffId: 'hoa_an', turns: 2 },
        ],
      },
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.7 },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
    buildTag: 'dot',
  },

  // -- Cuu Tieu Viem Bao (E) -- the no payoff: query same-source Hoa
  // An stacks -> burst -> consume the caster's OWN instance (spec
  // sec.62). 'own' scope: another caster's Hoa An on the target is
  // untouched (sec.7/sec.68 ownership).
  {
    id: 'cuu_tieu_viem_bao',
    name: 'Cửu Tiêu Viêm Bạo',
    description: 'Chín tầng lửa trời sụp xuống — nổ tung chính Hỏa Ấn mình đã gieo.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'hoa_an',
        damagePerStack: 35,
        consumesAilmentScope: 'own',
      },
    ],
    resourceType: 'none',
    unlocked: false,
    equipped: false,
    buildTag: 'burst',
  },
]
