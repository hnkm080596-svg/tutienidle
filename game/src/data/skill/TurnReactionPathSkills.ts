import type { TurnSkillDefinition } from '../../core/battle/turn/TurnSkillAction'
import type { TurnBuffDefinition } from '../../core/battle/turn/TurnBuffTypes'
import { PHAP_TU_BASICS } from './TurnBasicAttacks'

// Future Systems Task 4 (2026-09-04) — Pháp Tu Reaction Path (hidden
// path, spec §3): bỏ hẳn book/AI tình huống. `special` cast 2 hành
// random KHÁC nhau mỗi lần (selector selectRandomDistinctElementPair —
// luôn có cơ hội kích reaction giữa 2 element khác nhau trên cùng
// target), `ultimate` là buff tự thân cường hóa dmg reaction.
//
// Pool = chính 5 basic attack elemental của Pháp Tu Thuần (PHAP_TU_BASICS)
// — không cần data damage riêng (spec: "reusing the SAME elemental damage
// components each element's real basic attack uses").
//
// `phap_tu_reaction_special` là MARKER definition — damage/targeting
// placeholder, KHÔNG BAO GIỜ resolve trực tiếp: TurnBattleSystem chặn
// id này và thay bằng 2 pick từ pool (Task 5).
//
// `reaction_empowerment` buff: structurally-correct but functionally-inert
// — `reactionEffectPercent` chưa được TurnBuffSystem's statModifier
// pipeline tiêu thụ cho turn reaction damage (chờ reaction turn-cutover
// thật, xem roadmap dòng ReactionManager). Số liệu giữ nguyên hệ sống
// (reactionEffectPercent tồn tại từ hệ sống).

export const REACTION_PATH_POOL: readonly TurnSkillDefinition[] = [
  PHAP_TU_BASICS.fire,
  PHAP_TU_BASICS.water,
  PHAP_TU_BASICS.wood,
  PHAP_TU_BASICS.metal,
  PHAP_TU_BASICS.earth,
]

export const REACTION_PATH_SPECIAL_ID = 'phap_tu_reaction_special'

export const PHAP_TU_REACTION_SPECIAL: TurnSkillDefinition = {
  id: REACTION_PATH_SPECIAL_ID,
  cooldownTurns: 4,
  resourceType: 'mana',
  resourceCost: 20,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
}

export const PHAP_TU_REACTION_ULTIMATE: TurnSkillDefinition = {
  id: 'phap_tu_reaction_ultimate',
  cooldownTurns: 6,
  resourceType: 'mana',
  resourceCost: 30,
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
  appliesBuff: { definitionId: 'reaction_empowerment', target: 'self' },
}

export const REACTION_EMPOWERMENT_BUFF: TurnBuffDefinition = {
  id: 'reaction_empowerment',
  name: 'Cộng Minh Phản Ứng',
  description: 'Cường hóa sát thương phản ứng nguyên tố N lượt (số liệu tune khi reaction turn-cutover).',
  polarity: 'buff',
  duration: 4,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'reactionEffectPercent', percent: 0.25 }],
}
