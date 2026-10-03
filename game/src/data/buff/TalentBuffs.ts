import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// buff2 migration (M4): refresh -> keep/refresh; statModifier -> statModifiers[].

export const TALENT_BUFFS: BuffDefinition[] = [
  // --- Talent v4 combat (spec 2026-09-03-talent-catalog-v4-design.md
  // sec4.1) - buff "bung no" cua nhip tich -> nguong -> bung (E1
  // convert-on-max + passiveConvertsTo). So lieu first-pass, cho
  // playtest (spec sec5). ---

  // Kiem Quang - Kiem Vuc 8s: don danh gan nhu chac chan chi mang
  // (criticalRate flat lon vuot tran moi avoidance hop ly).
  {
    id: 'kiem_vuc',
    name: 'Kiếm Vực',
    description: 'Mười tầng Kiếm Mạch hợp nhất — kiếm khí bao trùm, mọi đòn đều chí mạng.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 8, scaling: 'ailment_scaled' },
    statModifiers: [{ stat: 'criticalRate', flat: 1 }],
    dispellable: false,
  },
  // Trong Kich - bung no chuoi crit: +30% sat thuong cuoi 8s.
  {
    id: 'trong_kich_burst',
    name: 'Trọng Kích Bùng Nổ',
    description: 'Ba đường kiếm khớp nhau — đòn kế như sét tái giáng.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 8, scaling: 'ailment_scaled' },
    // CP-01 - flat, not percent: this rate stat's base is 0 so
    // percent*(0+0)=0 (silent no-op). Convention for rate stats is flat
    // fraction (TheTuBuffs/affixes/node riders).
    statModifiers: [{ stat: 'finalDamagePercent', flat: 0.3 }],
    dispellable: false,
  },
  // Thach Giap - Thach Nham 5s: -50% sat thuong nhan vao.
  {
    id: 'thach_nham',
    name: 'Thạch Nham',
    description: 'Mười lớp giáp đá ngưng thành nham thể — đao kiếm khó phạm.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    statModifiers: [{ stat: 'finalDamageReductionPercent', flat: 0.5 }],
    dispellable: false,
  },
  // Vo Anh - Sat Na 6s: +30% chi mang + 20% toc danh.
  {
    id: 'sat_na',
    name: 'Sát Na',
    description: 'Năm lần tránh kiếm hợp thành một sát na — thân pháp quỷ dị.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [
      { stat: 'criticalRate', percent: 0.3 },
      { stat: 'speed', percent: 0.2 },
    ],
    dispellable: false,
  },
  // Bat Tu The v4 - Tu Sinh Ngo 10s sau khi guard cuu song:
  // +30% sat thuong cuoi + 20% ne chi mang.
  {
    id: 'tu_sinh_ngo',
    name: 'Tử Sinh Ngộ',
    description: 'Chết một lần trong trận, ngộ ra một kiếp — sát thương bùng, tâm thần lạnh.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 10, scaling: 'ailment_scaled' },
    statModifiers: [
      { stat: 'finalDamagePercent', flat: 0.3 },
      { stat: 'criticalAvoidance', flat: 0.2 },
    ],
    dispellable: false,
  },
]
