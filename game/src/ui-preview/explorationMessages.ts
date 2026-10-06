// Preview message scope: bare keys are fixture labels only; the
// namespaced `exploration.*` / `dongFu.*` / `autoFarm.*` /
// `panels.stageSelect.*` blocks mirror the production locale keys the
// fidelity surface resolves so the preview stays honest.
export const explorationMessages = { vi: {
  zone: 'Thanh Vân', realm: { mortal: 'Phàm Nhân', qi: 'Luyện Khí', foundation: 'Trúc Cơ' },
  stageTitle: '{code} · Sườn Thanh Vân', bossTitle: '{code} · Đỉnh Thanh Vân',
  description: 'Mây phủ triền núi, linh khí vấn vít bên rừng tùng. Một đoạn đường trong hành trình khám phá Thanh Vân.',
  enemySummary: '10 quái', bossEnemySummary: 'Boss: Thủ Lĩnh Sơn Lâm',
  enemyLabel: 'Sói Linh · Lv.3 · Cận chiến', bossEnemyLabel: 'Thủ Lĩnh Sơn Lâm · Lv.10 · Cận chiến',
  stone: 'Linh thạch', mastery: 'Tâm pháp tinh thông', material: 'Linh Mộc',
  disabled: 'Cần phá ải trước đó.', modeHint: 'Chiến thủ công từng đợt, thưởng đầy đủ.',
  notice: 'Chỉ duyệt UI — chưa khởi tạo chiến đấu hoặc nhận thưởng.',
  navNotice: '{name} — chưa có bản duyệt trong màn này.',
  exploration: {
    title: 'Thám Hiểm',
    navigation: 'Chức năng',
    zones: 'Địa Giới',
    progress: 'Tiến Độ Thám Hiểm',
    preview: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
    stageLabel: '{chapter} · Tầng {stage} · {state}',
    boss: 'BOSS',
    enemies: 'Địch Nhân',
    rewards: 'Phần Thưởng',
    modes: 'Chế Độ',
    empty: 'Chọn một ải trên bản đồ.',
    noEnemy: 'Không có tin tức địch.',
    startFailed: 'Không thể bắt đầu. Kiểm tra lại điều kiện.',
    armedFarm: 'Đang tự động: {stage}',
    state: { cleared: 'Đã Phá', current: 'Tiền Tuyến', available: 'Có Thể Khiêu Chiến', locked: 'Chưa Mở' },
  },
  autoFarm: { stop: 'Dừng' },
  dongFu: { aria: 'Về Động Phủ' },
  panels: { stageSelect: {
    modes: { manual: 'Thủ Công', repeat: 'Lặp Lại', progress: 'Tấn Tiến', perfectFarm: 'Tự Động Hoàn Mỹ' },
    modeHints: { manual: 'Chiến thủ công từng đợt, thưởng đầy đủ.', repeat: 'Tự động đánh lại ải này.', progress: 'Tự động tiến đến ải xa nhất có thể.', perfectFarm: 'Tự động thu thưởng hoàn mỹ (cần hoàn mỹ ải).' },
    actions: { editBuild: 'Chỉnh Build', start: 'Bắt Đầu' },
  } },
  nav: { realm: 'Cảnh Giới', character: 'Tu Sĩ', inventory: 'Túi Đồ', skill: 'Kỹ Năng', technique: 'Tâm Pháp', body: 'Luyện Thể', alchemy: 'Luyện Đan', equipment: 'Trang Bị', exploration: 'Thám Hiểm', quest: 'Nhiệm Vụ', settings: 'Cài Đặt' },
} } as const
