export interface StageEnemyEntry {
  enemyId: string

  weight: number

  // 0..1 — cơ hội lần spawn đó là bản Elite (buff stat + rewards
  // riêng, xem core/enemy/EnemyStatInput.ts's applyEliteMultiplier()
  // và Enemy.eliteRewards) thay vì bản thường. Mặc định 0 (không có
  // Elite) — tối giản, chỉ đủ để Phá Cảnh Tâm Pháp có nguồn rơi thật.
  eliteChance?: number
}

export interface Stage {
  id: string

  name: string

  description: string

  requiredRealmId?: string

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — CHỈ còn dùng để
  // HIỂN THỊ số "Tầng N" (xem StageSelectPanel.vue). Gate mở/khoá THẬT
  // SỰ chạy hoàn toàn qua GameManager.isStageUnlocked() (thứ tự
  // zone.stageIds + player.completedStageIds) — field này KHÔNG được
  // đọc bởi logic gate; đổi thứ tự stage trong Zones.ts thì nhớ đồng
  // bộ số hiển thị ở đây theo, không tự khớp.
  requiredRealmLevel?: number

  // One zone contains three realm chapters; every chapter has ten floors.
  chapter?: number

  floor?: number

  enemyPool: StageEnemyEntry[]

  // Tổng số quái phải spawn hết (và đánh chết hết) để thắng màn.
  totalEnemyCount: number

  // Nhịp spawn mặc định — quái mới spawn theo nhịp này SONG SONG với
  // quái đang sống (không đợi chết mới spawn tiếp), xem
  // GameManager.updateStageProgress(). Sân trống quái giữa chừng thì
  // spawn ngay bất kể còn bao nhiêu giây trong nhịp này.
  spawnIntervalSeconds: number

  // Core Loop Foundation checklist (Mục BOSS) — không khai = stage
  // này không có Boss (chỉ enemyPool ngẫu nhiên như cũ). Khai thì
  // LƯỢT SPAWN CUỐI CÙNG (spawnedCount === totalEnemyCount - 1) LUÔN
  // LÀ Boss (không roll enemyPool cho lượt đó) — xem
  // GameManager.pickEnemyForSpawn().
  bossEnemyId?: string

  // Auto-farm Hoàn Mỹ (2026-09-04 spec) — số turn tối đa để đạt điều
  // kiện "Hoàn Mỹ" (kết hợp với ngưỡng HP đội mất <=75%, hardcode ở
  // GameManager). undefined = stage này chưa định nghĩa ngưỡng, không
  // bao giờ đạt Hoàn Mỹ (an toàn — không mở khoá auto-farm ngoài ý
  // muốn cho stage chưa balance). Content work, set theo từng stage.
  perfectClearTurnLimit?: number
}
