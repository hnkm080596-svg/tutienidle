// ReactionDefinitions.ts -- CANONICAL_REACTIONS (megaplan M4, spec
// sec.83-84). All 10 canonical Wuxing pairs: 5 sinh + 5 khac. Ids and
// selectionTiePriority are the LOCKED structure; payoff values are
// provisional pending balance. Payoff steps are pure DATA (CON-23) --
// emitPayoffOperations maps them; no engine-side per-reaction branches.
//
// Snapshot vars: P = parent stacks, A = attacker stacks, D = defender
// stacks -- all pre-consume (contract sec.38).
//
// Status/buff ids referenced by apply_status steps resolve to the four
// production payoff defs in data/buff/ReactionStatusBuffs.ts
// (canonical-seals S2 -- no test_* ids in production data).

import type { BuffDefinitionId } from '../../core/battle/contracts/ids'
import type { ReactionDefinition } from '../../core/reaction/ReactionDefinition'
import type { StackExpr } from '../../core/reaction/StackExpr'
import type { ReactionId } from '../../core/reaction/ReactionTypes'

const stacks = (role: 'parent' | 'child' | 'attacker' | 'defender'): StackExpr => ({
  op: 'stacks',
  role,
})
const c = (value: number): StackExpr => ({ op: 'const', value })
const add = (...args: StackExpr[]): StackExpr => ({ op: 'add', args })
const mul = (...args: StackExpr[]): StackExpr => ({ op: 'mul', args })
const min = (...args: StackExpr[]): StackExpr => ({ op: 'min', args })
const max = (...args: StackExpr[]): StackExpr => ({ op: 'max', args })
const ceilHalf = (arg: StackExpr): StackExpr => ({ op: 'ceil_half', arg })
const floorHalf = (arg: StackExpr): StackExpr => ({ op: 'floor_half', arg })

const P = stacks('parent')
const A = stacks('attacker')
const D = stacks('defender')

/** Presentation display names (canonical-seals S5.3) -- the UI floats
    these on reaction_resolved; ids stay the internal key. */
export const REACTION_DISPLAY_NAMES: Record<string, string> = {
  duong_viem: 'Dưỡng Viêm',
  luyen_tho: 'Luyện Thổ',
  duong_kim: 'Dưỡng Kim',
  tu_thuy: 'Tụ Thủy',
  nhuan_moc: 'Nhuận Mộc',
  tuc_viem: 'Tức Viêm',
  dung_kim: 'Dung Kim',
  doan_moc: 'Đoạn Mộc',
  xuyen_tho: 'Xuyên Thổ',
  tran_thuy: 'Trấn Thủy',
}

export const REACTION_STATUS_BUFF_IDS = {
  bleed: 'reaction_bleed' as BuffDefinitionId,
  defenseBreak: 'defense_break' as BuffDefinitionId,
  defenseErosion: 'defense_erosion' as BuffDefinitionId,
  camCong: 'cam_cong' as BuffDefinitionId,
} as const

const sinh = (
  id: string,
  parent: ReactionDefinition['elements'] extends infer _ ? 'wood' | 'fire' | 'earth' | 'metal' | 'water' : never,
  child: typeof parent,
  selectionTiePriority: number,
  steps: ReactionDefinition['payoff']['steps'],
): ReactionDefinition => ({
  id: id as ReactionId,
  relation: 'sinh',
  selectionTiePriority,
  elements: { parent, child },
  payoff: { steps },
})

const khac = (
  id: string,
  attacker: Parameters<typeof sinh>[1],
  defender: typeof attacker,
  selectionTiePriority: number,
  steps: ReactionDefinition['payoff']['steps'],
): ReactionDefinition => ({
  id: id as ReactionId,
  relation: 'khac',
  selectionTiePriority,
  elements: { attacker, defender },
  payoff: { steps },
})

export const CANONICAL_REACTIONS: readonly ReactionDefinition[] = [
  // ---------------------------------------------------------------------
  // Sinh cycle -- consume ALL parent stacks; child kept + converted.
  // ---------------------------------------------------------------------
  sinh('duong_viem', 'wood', 'fire', 10, [
    { kind: 'add_child_stacks', stacks: ceilHalf(P) },
    {
      kind: 'add_child_modifier',
      modifierId: 'duong_viem',
      channel: 'periodic_damage',
      value: add(c(1), mul(c(0.05), P)),
    },
  ]),
  sinh('luyen_tho', 'fire', 'earth', 20, [
    { kind: 'add_child_stacks', stacks: ceilHalf(P) },
    { kind: 'push_gauge', fractionOfMax: mul(c(-0.03), P) },
  ]),
  sinh('duong_kim', 'earth', 'metal', 30, [
    { kind: 'add_child_stacks', stacks: ceilHalf(P) },
    {
      kind: 'add_child_modifier',
      modifierId: 'duong_kim',
      channel: 'elemental_penetration',
      // Additive penetration POINTS (1pt = 1% net resistance) bound to
      // the Liet Thuong child's own periodic metal damage requests --
      // not a potency multiplier (S0.5P contract extension).
      operation: 'add',
      value: mul(c(4), P),
    },
  ]),
  sinh('tu_thuy', 'metal', 'water', 40, [
    { kind: 'add_child_stacks', stacks: ceilHalf(P) },
    {
      kind: 'extend_child_duration',
      turns: floorHalf(P),
      maxRemaining: 5,
    },
  ]),
  sinh('nhuan_moc', 'water', 'wood', 50, [
    { kind: 'add_child_stacks', stacks: ceilHalf(P) },
    {
      kind: 'add_child_modifier',
      modifierId: 'nhuan_moc',
      channel: 'periodic_damage',
      value: add(c(1), mul(c(0.05), P)),
    },
  ]),

  // ---------------------------------------------------------------------
  // Khac cycle -- consume BOTH participants.
  // ---------------------------------------------------------------------
  khac('tuc_viem', 'water', 'fire', 60, [
    {
      kind: 'reaction_damage',
      coefficient: add(mul(c(0.2), add(A, D)), mul(c(0.08), D)),
      damageProfile: 'reaction',
      element: 'attacker',
    },
    { kind: 'push_gauge', fractionOfMax: mul(c(-0.03), A) },
  ]),
  khac('dung_kim', 'fire', 'metal', 70, [
    {
      kind: 'reaction_damage',
      coefficient: mul(c(0.35), add(A, D)),
      damageProfile: 'reaction',
      element: 'attacker',
    },
    {
      kind: 'apply_status',
      definitionId: REACTION_STATUS_BUFF_IDS.defenseBreak,
      stacks: A,
      durationOverride: min(c(3), ceilHalf(D)),
    },
  ]),
  khac('doan_moc', 'metal', 'wood', 80, [
    {
      kind: 'reaction_damage',
      coefficient: mul(c(0.15), add(A, D)),
      damageProfile: 'reaction',
      element: 'attacker',
    },
    {
      kind: 'apply_status',
      definitionId: REACTION_STATUS_BUFF_IDS.bleed,
      stacks: add(c(1), floorHalf(A)),
      modifier: {
        modifierId: 'doan_moc',
        channel: 'potency',
        value: add(c(1), mul(c(0.05), D)),
      },
    },
  ]),
  khac('xuyen_tho', 'wood', 'earth', 90, [
    {
      kind: 'reaction_damage',
      coefficient: mul(c(0.15), add(A, D)),
      damageProfile: 'reaction',
      element: 'attacker',
    },
    {
      kind: 'apply_status',
      definitionId: REACTION_STATUS_BUFF_IDS.defenseErosion,
      stacks: A,
    },
    {
      kind: 'heal_from_damage',
      fraction: mul(c(0.05), D),
      capRatio: 0.25,
      healTarget: 'source',
    },
  ]),
  khac('tran_thuy', 'earth', 'water', 100, [
    {
      kind: 'reaction_damage',
      coefficient: mul(c(0.1), add(A, D)),
      damageProfile: 'reaction',
      element: 'attacker',
    },
    { kind: 'push_gauge', fractionOfMax: mul(c(-0.04), A) },
    {
      kind: 'apply_status',
      definitionId: REACTION_STATUS_BUFF_IDS.camCong,
      // D in 1..3 -> one blocked declare; D in 4..5 -> two. The holder's
      // declare runs holder_turn_end BEFORE action validation, so N
      // suppressed declares need engine duration N+1 (remaining 1
      // expires in the very declare it should suppress) -- clamp(D-1,
      // 2, 3).
      durationOverride: min(c(3), max(c(2), add(D, c(-1)))),
      when: { role: 'attacker', op: 'gte', value: 3 },
    },
  ]),
]
