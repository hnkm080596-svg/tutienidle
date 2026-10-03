export const characterMessages = { vi: {
  title: 'Nhân Vật', brand: 'Tu Tiên Idle', preview: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
  notice: '{name} — đã chọn trong bản UI', home: 'Về Động Phủ',
  name: 'Thanh Vân', realm: 'Luyện Khí · Tầng 11', pathValue: 'Pháp Tu',
  // Mirrors the production `character.*` + `panels.wheel.slots.*` +
  // `dongFu.aria` keys the fidelity components resolve through i18n.
  character: {
    mainStats: 'Thuộc Tính Chính', points: '({count} điểm)', max: 'MAX', allocate: 'Cộng điểm',
    talent: 'Thiên Phú', elements: 'Ngũ Hành', path: 'Đạo lộ', power: 'Chiến Lực',
    details: 'Chi Tiết', combat: 'Chiến Đấu', other: 'Khác',
    statNotice: '{name}: {value}',
    elementNotice: '{name} · Lực {power} · Kháng {resistance} · Xuyên {penetration}',
    sources: {
      title: 'Thành Phần', base: 'Cơ Bản', bodyDelta: 'Luyện Thể',
      realm: 'Cảnh Giới', technique: 'Tâm Pháp', skill: 'Kỹ Năng',
      buff: 'Buff', debuff: 'Debuff', equipment: 'Trang Bị',
      talent: 'Thiên Phú', reincarnation: 'Luân Hồi', pill: 'Đan Dược',
      formation: 'Trận Pháp', talisman: 'Phù', attribute: 'Thuộc Tính',
    },
  },
  panels: { wheel: { slots: { character: 'Nhân Vật' } } },
  dongFu: { aria: 'Về Động Phủ' },
  nav: { realm: 'Cảnh Giới', character: 'Nhân Vật', inventory: 'Túi Đồ', skill: 'Kỹ Năng', alchemy: 'Luyện Đan', technique: 'Tâm Pháp', body: 'Luyện Thể', equipment: 'Trang Bị', exploration: 'Thám Hiểm', quest: 'Nhiệm Vụ', settings: 'Cài Đặt' },
  stat: { vitality: 'Thể Chất', strength: 'Căn Cốt', dexterity: 'Thân Pháp', attunement: 'Linh Căn', intelligence: 'Thần Thức' },
  element: { fire: 'Hỏa', wood: 'Mộc', earth: 'Thổ', water: 'Thủy', metal: 'Kim' },
  detail: { maxHp: 'Khí huyết', maxMp: 'Linh lực', might: 'Sức mạnh', defense: 'Phòng ngự', criticalRate: 'Tỉ lệ bạo kích', criticalDamage: 'ST bạo kích', accuracyRating: 'Độ chính xác', evasionRate: 'Tỉ lệ né', speed: 'Thân pháp (tốc độ)', leechPercent: 'Hút máu', criticalAvoidance: 'Kháng bạo kích', skillDamagePercent: 'ST kỹ năng', finalDamageReductionPercent: 'Giảm ST cuối', primordialPower: 'Hỗn Nguyên Lực' },
  elementInfo: '{name} · Lực {power} · Kháng {resistance} · Xuyên {penetration}',
} } as const
