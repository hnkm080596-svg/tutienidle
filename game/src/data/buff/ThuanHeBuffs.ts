import type { BuffDefinition } from '@/core/buff/BuffDefinition'

export const THUAN_HE_BUFFS: BuffDefinition[] = [
  // ==================================================================
  // Pháp Tu Thuần Hệ (spec 2026-09-03 §7) — buff mới của 5 chuỗi Thuần.
  // Ailment chuỗi TÁI DÙNG engine cũ (bong/te_cong/trung_doc/chay_mau/
  // thach_hoa/troi_chan/choang) — buff mới chỉ ở đây, không thêm vào
  // bảng reaction.
  // ==================================================================

  // Thủy C "Thanh Tuyền Dưỡng Linh" — hồi Pháp Lực.
  {
    id: 'thanh_tuyen',
    name: 'Thanh Tuyền',
    description: 'Suối thiêng Thanh Tuyền nuôi linh khí — Pháp Lực hồi nhanh hơn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    // Task 3 (D17): the bespoke manaRegenPercent stat retired — the +10%
    // is now a percent modifier on the live manaRegenPerTurn stat, and
    // both MP-pool grants carry domain:'phap_tu' for the Task-7 gate.
    effects: [
      { type: 'statModifier', stat: 'manaRegenPerTurn', flat: 8, domain: 'phap_tu' },
      { type: 'statModifier', stat: 'manaRegenPerTurn', percent: 0.1, domain: 'phap_tu' },
    ],
  },

  // Biến thể Thủy C2 "Dưỡng Linh · Băng Giáp" — Thủy phòng thủ.
  {
    id: 'bang_giap',
    name: 'Băng Giáp',
    description: 'Giáp băng kết tụ — khiên bền hơn, hồi khiên nhanh hơn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 50 },
      { type: 'statModifier', stat: 'wardRegenPerTurn', flat: 5 },
    ],
  },

  // Thủy D "Hồi Lưu Thôn Nộ" — tự buff hấp thụ (leech). leechPercent
  // không áp cho true damage Detonate (N7) — Thủy không có Detonate nên OK.
  {
    id: 'hoi_luu',
    name: 'Hồi Lưu',
    description: 'Vòng nước hồi lưu cuốn sinh lực về bản thân — đòn đánh hút máu.',
    polarity: 'buff',
    duration: 4,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'leechPercent', flat: 0.2 }],
  },

  // Biến thể Mộc C1 "Căn Trì · Cấm Bộ" — root BẢN DÀI của troi_chan
  // (2.5s → 4s), chỉ dùng cho biến thể này.
  {
    id: 'cau_mang_can',
    name: 'Câu Mang Căn',
    description: 'Rễ Câu Mang quấn chặt — không thể di chuyển.',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'refresh',
    effects: [{ type: 'cc', ccEffect: 'root' }],
  },

  // Kim B "Thu Giáp Kim Thân" — tự hoá thép. The Tu Reimagined (spec
  // 2026-09-15 T12): generic thorns stat retired — defense is the payload.
  {
    id: 'kim_giap',
    name: 'Kim Giáp',
    description: 'Thép Nhục Thu bọc thân — phòng ngự tăng mạnh.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'defense', percent: 0.15 },
    ],
  },

  // Thổ C "Địa Trụ Thừa Thiên" — cột đất đỡ đòn.
  {
    id: 'dia_tru',
    name: 'Địa Trụ',
    description: 'Cột đất thiêng chống trời — khiên dày, hồi khiên.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 60 },
      { type: 'statModifier', stat: 'wardRegenPerTurn', flat: 6 },
    ],
  },

  // Ult Thổ "Hậu Thổ Thành Lũy" — +6% defense/tầng, tầng = số địch bị
  // nhốt (stacksPerAffectedTarget E-2), max 8.
  {
    id: 'thanh_luy',
    name: 'Thành Lũy',
    description: 'Thành đất Hậu Thổ vây quanh — mỗi địch bị nhốt thêm 6% phòng thủ.',
    polarity: 'buff',
    duration: 8,
    stackMode: 'stack',
    maxStacks: 8,
    effects: [{ type: 'statModifier', stat: 'defense', percent: 0.06 }],
  },

  // Biến thể Thổ C "Địa Trụ · Bích" (spec §2.5, review round 1) — khiên
  // THUẦN nuôi E nổ to: +100 wardMax/+8 regen, KHÔNG thorns. Buff riêng
  // (không mượn bang_giap của Thủy — sai số liệu + đụng tên đa hành).
  {
    id: 'dia_tru_bich',
    name: 'Địa Trụ · Bích',
    description: 'Tường đất vững chãi — khiên dày và hồi nhanh, đổi lại không phản đòn.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 100 },
      { type: 'statModifier', stat: 'wardRegenPerTurn', flat: 8 },
    ],
  },

  // Biến thể Thổ C "Địa Trụ · Thứ" (spec §2.5, review round 1) — phản
  // đòn: +40 wardMax/+25% wardBreakDamagePercent. The Tu Reimagined
  // (spec 2026-09-15 T12): generic thorns stat retired — the retaliate
  // fantasy rides Khiên Nổ (ward-break kickback on the attacker),
  // keeping Thứ distinct from Bích's pure-shield line.
  {
    id: 'dia_tru_thu',
    name: 'Địa Trụ · Thứ',
    description: 'Đất hóa gai nhọn — khiên mỏng hơn nhưng vỡ ra đòn chết người chạm.',
    polarity: 'buff',
    duration: 6,
    stackMode: 'refresh',
    effects: [
      { type: 'statModifier', stat: 'wardMax', flat: 40 },
      { type: 'statModifier', stat: 'wardBreakDamagePercent', flat: 0.25 },
    ],
  },

  // Node Thế Mãn (spec §4/E-7) — engine ÁP/GỠ theo trạng thái Thế đầy
  // (E-7 sync was TheResourceSystem.updateTheManBuff — retired M13, not
  // yet ported to the turn engine / UltimateSystem trigger reset).
  // duration Infinity: buff KHÔNG tự hết hạn; id phải khớp chính xác
  // theManBuffId(element) = `the_man_<element>` (was TheResourceSystem.ts).
  {
    id: 'the_man_fire',
    name: 'Thế Mãn (Hỏa)',
    description: 'Hỏa Thế tràn đầy — Thiêu Đốt lan potency mạnh hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'ailmentPotencyPercent', percent: 0.15 }],
  },
  {
    id: 'the_man_water',
    name: 'Thế Mãn (Thủy)',
    description: 'Thủy Thế tràn đầy — Pháp Lực tuôn trào.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'manaRegenPerTurn', flat: 6, domain: 'phap_tu' }],
  },
  {
    id: 'the_man_wood',
    name: 'Thế Mãn (Mộc)',
    description: 'Mộc Thế tràn đầy — độc tố bám lâu hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'ailmentDurationPercent', percent: 0.2 }],
  },
  {
    id: 'the_man_metal',
    name: 'Thế Mãn (Kim)',
    description: 'Kim Thế tràn đầy — sát khí bén hơn, chí mạng cao hơn.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'criticalRate', percent: 0.08 }],
  },
  {
    id: 'the_man_earth',
    name: 'Thế Mãn (Thổ)',
    description: 'Thổ Thế tràn đầy — thân thể vững như núi.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'defense', percent: 0.1 }],
  },
]
