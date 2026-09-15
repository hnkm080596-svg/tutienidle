import type { BuffDefinition } from '@/core/buff/BuffDefinition'

// Kiem Tu Reimagined (spec 2026-09-15 §3) — buffs/debuffs authored for
// the Kiem Pho orb kit. `kiem_thuong` is the NEW physical-typed DoT:
// orb_chem (Chem) stacks it on hit, dot.element 'physical' keeps the
// bleed on the armor side of the pipeline (unlike the elemental DoTs).
export const KIEM_PHO_BUFFS: BuffDefinition[] = [
  {
    id: 'kiem_thuong',
    name: 'Kiếm Thương',
    description: 'Vết kiếm rách toạc — mất máu mỗi lượt, cộng dồn tối đa 3 tầng.',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'stack',
    maxStacks: 3,
    effects: [
      {
        type: 'dot',
        dpsRatio: 0.25,
        element: 'physical',
      },
    ],
  },
]
