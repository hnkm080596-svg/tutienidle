import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// Kiem Tu Reimagined (spec 2026-09-15 §3) — buffs/debuffs authored for
// the Kiem Pho orb kit. `kiem_thuong` is the NEW physical-typed DoT:
// orb_chem (Chem) stacks it on hit, dot.element 'physical' keeps the
// bleed on the armor side of the pipeline (unlike the elemental DoTs).
// buff2 migration (M4): stack -> onReapplyStacks:'add'; dot -> periodic.
export const KIEM_PHO_BUFFS: BuffDefinition[] = [
  {
    id: 'kiem_thuong',
    name: 'Kiếm Thương',
    description: 'Vết kiếm rách toạc — mất máu mỗi lượt, cộng dồn tối đa 3 tầng.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'kiem_thuong.dot',
        type: 'damage',
        element: 'physical',
        damageProfile: 'legacy_dot',
        coefficient: 0.25,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  },
]
