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

  // Luyện Khí tầng 1-10 content pass (2026-08-14) — gate MỊN hơn
  // requiredRealmId (chỉ phân biệt đại-cảnh-giới): tầng CỤ THỂ trong
  // CHÍNH requiredRealmId đó. Chỉ có ý nghĩa khi player ĐANG ở đúng
  // requiredRealmId — nếu player đã vượt qua hẳn đại-cảnh-giới này rồi
  // thì field này bị bỏ qua (xem StageSelectPanel.vue's
  // isStageUnlocked()). Không khai = mở ngay tầng 1 (giữ nguyên hành
  // vi stage duy nhất trước đây).
  requiredRealmLevel?: number

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
}
