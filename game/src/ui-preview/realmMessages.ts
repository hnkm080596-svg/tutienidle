export const realmMessages = { vi: {
  // Mirrors the production `realm.*` + `panels.realm.*` +
  // `panels.wheel.slots.realm` + `dongFu.aria` keys the fidelity
  // components resolve through i18n.
  realm: {
    title: 'ĐƯỜNG ĐĂNG TIÊN', subtitle: 'Mười tám tầng\nMột đường đăng tiên',
    floorLabel: 'Tầng {floor}', floorCount: 'Tầng {floor} / {total}',
    cultivation: 'Tu vi', breakthroughTitle: 'Đột Phá {target}',
    viewing: 'Đang xem mốc tầng {floor}',
  },
  panels: {
    wheel: { slots: { realm: 'Cảnh Giới' } },
    realm: {
      sections: { progress: 'Tiến Độ Tu Luyện', passives: 'Thiên Phú Cảnh Giới ({realm})' },
      meta: { rateLabel: 'Tốc Độ Tu Luyện' },
      requirements: { met: 'Đã đạt', unmet: 'Chưa đạt' },
    },
  },
  dongFu: { aria: 'Về Động Phủ' },
  name: 'Kiến Cơ', progress: 'Tiến Độ Tu Luyện', cultivation: 'Tu vi', rate: 'Tốc độ', rateValue: '+120 / phút',
  breakthrough: 'Đột Phá', level: 'Cấp độ yêu cầu', chapter: 'Tiến độ chương', levelValue: 'Cấp 30', chapterValue: '8 / 10',
  preview: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay', notice: 'Chỉ xem trước UI — chưa thực hiện đột phá.', navNotice: '{name} — chưa có bản duyệt trong màn này.',
  nav: { realm: 'Cảnh Giới', character: 'Nhân Vật', inventory: 'Túi Đồ', skill: 'Kỹ Năng', technique: 'Tâm Pháp', body: 'Luyện Thể', alchemy: 'Luyện Đan', equipment: 'Trang Bị', exploration: 'Thám Hiểm' },
} } as const
