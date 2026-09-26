import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// buff2 migration (M4): refresh -> stacking{onReapplyStacks:'keep',
// onReapplyDuration:'refresh'}; stack -> onReapplyStacks:'add';
// holder_turns / permanent lifetime; statModifier -> statModifiers[].
//
// Phap Tu Reimagine (2026-09-26 spec): the chain-era defs retired with
// their skills -- bang_giap, hoi_luu, cau_mang_can, thanh_luy,
// dia_tru_bich, dia_tru_thu, and the five the_man_<element> marks are
// gone. thanh_tuyen survives as the water Phap Trang window; kim_giap
// and dia_tru are still referenced by companion kits
// (data/companion/Companions.ts).

export const THUAN_HE_BUFFS: BuffDefinition[] = [
  // Thuy special "Thanh Tuyen Duong Linh" -- mana regen Phap Trang
  // window (spec D13; keeps its authored 6-turn duration).
  {
    id: 'thanh_tuyen',
    name: 'Thanh Tuyền',
    description: 'Suối thiêng Thanh Tuyền nuôi linh khí — Pháp Lực hồi nhanh hơn.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    // Task 3 (D17): the bespoke manaRegenPercent stat retired — the +10%
    // is now a percent modifier on the live manaRegenPerTurn stat, and
    // both MP-pool grants carry domain:'spell' for the Task-7 gate.
    statModifiers: [
      { stat: 'manaRegenPerTurn', flat: 8, domain: 'spell' },
      { stat: 'manaRegenPerTurn', percent: 0.1, domain: 'spell' },
    ],
    dispellable: false,
  },

  // Kim B "Thu Giap Kim Than" - tu hoa thep. Now authored only for the
  // companion kit (Companions.ts). The Tu Reimagined (spec
  // 2026-09-15 T12): generic thorns stat retired — defense is the payload.
  {
    id: 'kim_giap',
    name: 'Kim Giáp',
    description: 'Thép Nhục Thu bọc thân — phòng ngự tăng mạnh.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [{ stat: 'defense', percent: 0.15 }],
    dispellable: false,
  },

  // Tho C "Dia Tru Thua Thien" - cot dat do don. Now authored only for
  // the companion kit (Companions.ts).
  {
    id: 'dia_tru',
    name: 'Địa Trụ',
    description: 'Cột đất thiêng chống trời — khiên dày, hồi khiên.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [
      { stat: 'wardMax', flat: 60 },
      { stat: 'wardRegenPerTurn', flat: 6 },
    ],
    dispellable: false,
  },
]
