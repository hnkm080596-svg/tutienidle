import type { BuffDefinition } from '@/core/buff2/BuffDefinition'
import type { BuffDefinitionId } from '@/core/battle/contracts/ids'

/** S3.1 -- the Ngo Dao aura definition id, shared by the entry grant
    and the resurrection re-grant seam (plan sec.9.4). */
export const VAN_PHAP_THAN_HOA_ID = 'van_phap_than_hoa' as BuffDefinitionId

// ReactionStatusBuffs.ts -- canonical-seals/reaction megaplan S2 (plan
// sec.8.2). The four secondary payoff statuses the ten canonical
// reactions apply. Shared locked shape: kind 'debuff', no element tag
// (non-elemental status -- never enters the ElementalStateRegistry, so
// these can never react), per_source, ailment resistance (payoff applies
// are resistible), dispellable, fixed scaling, holder_turns clock, no
// removeOnSourceDeath (payoff debuffs persist through caster death,
// consistent with the seals).

export const REACTION_STATUS_BUFFS: BuffDefinition[] = [
  {
    id: 'defense_break',
    name: 'Phá Giáp',
    description: 'Giáp bị đánh vỡ — mỗi tầng giảm 4% phòng thủ.',
    kind: 'debuff',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    // Base only -- Dung Kim always supplies durationOverride
    // min(3, ceil(D/2)).
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'ailment' },
    // percent multiplies stacks at StatCalculator: each stack = -4%
    // defense; the reaction applies A stacks.
    statModifiers: [{ stat: 'defense', percent: -0.04 }],
    dispellable: true,
  },
  {
    id: 'defense_erosion',
    name: 'Xói Giáp',
    description: 'Giáp bị bào mòn dần — mỗi tầng giảm 4% phòng thủ.',
    kind: 'debuff',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    // Longer-lived than break's override: erosion is the persistent
    // variant; the reaction applies A stacks with no override.
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'fixed' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'defense', percent: -0.04 }],
    dispellable: true,
  },
  {
    id: 'cam_cong',
    name: 'Cấm Công',
    description: 'Bị phong tỏa công kích — không thể dùng hành động tấn công.',
    kind: 'debuff',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    // Base only -- Tran Thuy always supplies durationOverride
    // clamp(D - 2, 1, 2).
    lifetime: { clock: 'holder_turns', duration: 1, scaling: 'fixed' },
    application: { resistance: 'ailment' },
    // NOT stun: heal/buff/cleanse/defend/utility stay legal and the
    // holder still takes turns.
    forbiddenActionTags: ['attack'],
    dispellable: true,
  },
  {
    id: 'reaction_bleed',
    name: 'Xuất Huyết',
    description: 'Vết thương rỉ máu — mất máu theo sát thương vật lý mỗi lượt.',
    kind: 'debuff',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'fixed' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'reaction_bleed.dot',
        type: 'damage',
        // 'physical' -- a non-elemental wound rides armor mitigation,
        // not a wuxing element (the def itself carries no element tag).
        element: 'physical',
        damageProfile: 'legacy_dot',
        coefficient: 0.2,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    // Doan Moc applies 1+floor(A/2) stacks plus a child potency modifier
    // {id:'doan_moc', value:1+0.05*D}. This def MUST NOT enter the
    // ElementalStateRegistry.
    dispellable: true,
  },
  // S3.1 -- the Ngo Dao aura: NOT a payoff status and NOT an elemental
  // seal (no `element`, never enters ElementalStateRegistry). The
  // hidden An entity sources it party-wide at battle entry; each live
  // instance grants its holder `elemental_reaction_enabled`, which the
  // live-grant ReactionTriggerGate reads (plan sec.9). per_source +
  // keep/keep is the structural backstop for one instance per
  // (source, holder); removeOnSourceDeath:false keeps surviving
  // allies' instances when the An source dies; dispellable:false keeps
  // it cleanse-immune.
  {
    id: VAN_PHAP_THAN_HOA_ID,
    name: 'Vạn Pháp Thân Hòa',
    description:
      'Thuận theo thiên địa ngũ hành - các pháp thuật ngũ hành của người được hộ trợ sinh ra phản ứng.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
    lifetime: { clock: 'permanent', scaling: 'fixed', removeOnSourceDeath: false },
    application: { resistance: 'none' },
    capabilities: [
      {
        id: 'van_phap_than_hoa.reaction',
        type: 'elemental_reaction_enabled',
        payload: {},
      },
    ],
    dispellable: false,
  },
]
