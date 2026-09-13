import type { BuffDefinition } from '@/core/buff/BuffDefinition'

export const TALENT_BUFFS: BuffDefinition[] = [
  // --- Talent v4 combat (spec 2026-09-03-talent-catalog-v4-design.md
  // §4.1) — buff "bùng nổ" của nhịp tích → ngưỡng → bùng (E1
  // convert-on-max + passiveConvertsTo). Số liệu first-pass, chờ
  // playtest (spec §5). ---

  // Kiếm Quang — Kiếm Vực 8s: đòn đánh gần như chắc chắn chí mạng
  // (criticalRate flat lớn vượt trần mọi avoidance hợp lý).
  {
    id: 'kiem_vuc',
    name: 'Kiếm Vực',
    description: 'Mười tầng Kiếm Mạch hợp nhất — kiếm khí bao trùm, mọi đòn đều chí mạng.',
    polarity: 'buff',
    duration: 8,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'criticalRate', flat: 1 }],
  },
  // Trọng Kích — bùng nổ chuỗi crit: +30% sát thương cuối 8s.
  {
    id: 'trong_kich_burst',
    name: 'Trọng Kích Bùng Nổ',
    description: 'Ba đường kiếm khớp nhau — đòn kế như sét tái giáng.',
    polarity: 'buff',
    duration: 8,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'finalDamagePercent', percent: 0.3 }],
  },
  // Thạch Giáp — Thạch Nham 5s: −50% sát thương nhận vào.
  {
    id: 'thach_nham',
    name: 'Thạch Nham',
    description: 'Mười lớp giáp đá ngưng thành nham thể — đao kiếm khó phạm.',
    polarity: 'buff',
    duration: 5,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'finalDamageReductionPercent', percent: 0.5 }],
  },
  // Vô Ảnh — Sát Na 6s: +30% chí mạng + 20% tốc đánh.
  {
    id: 'sat_na',
    name: 'Sát Na',
    description: 'Năm lần tránh kiếm hợp thành một sát na — thân pháp quỷ dị.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'criticalRate', percent: 0.3 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
  // Bất Tử Th thể v4 — Tử Sinh Ngộ 10s sau khi guard cứu sống:
  // +30% sát thương cuối + 20% né chí mạng.
  {
    id: 'tu_sinh_ngo',
    name: 'Tử Sinh Ngộ',
    description: 'Chết một lần trong trận, ngộ ra một kiếp — sát thương bùng, tâm thần lạnh.',
    polarity: 'buff',
    duration: 10,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'finalDamagePercent', percent: 0.3 },
      { type: 'statModifier', stat: 'criticalAvoidance', percent: 0.2 },
    ],
  },
]
