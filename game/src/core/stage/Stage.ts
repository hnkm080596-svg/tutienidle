export interface StageEnemyEntry {
  enemyId: string

  weight: number

  // 0..1 - chance to attach the tinh_anh tag to that spawn (spec v3 B9):
  // stat buff via applyEliteMultiplier (core/enemy/EnemyStatInput.ts),
  // applied through applyEnemyTags (core/enemy/EnemyTag.ts) on the active
  // channel only. Default 0 (never tagged).
  eliteChance?: number
}

export interface Stage {
  id: string

  name: string

  description: string

  requiredRealmId?: string

  // Luyen Khi tang 1-10 content pass (2026-08-14) - CHI con dung de
  // HIEN THI so "Tang N" (xem StageSelectPanel.vue). Gate mo/khoa THAT
  // SU chay hoan toan qua GameManager.isStageUnlocked() (thu tu
  // zone.stageIds + player.completedStageIds) - field nay KHONG duoc
  // doc boi logic gate; doi thu tu stage trong Zones.ts thi nho dong
  // bo so hien thi o day theo, khong tu khop.
  requiredRealmLevel?: number

  // One zone contains three realm chapters; every chapter has ten floors.
  chapter?: number

  floor?: number

  enemyPool: StageEnemyEntry[]

  // Tong so quai phai spawn het (va danh chet het) de thang man.
  totalEnemyCount: number

  /**
   * Turn-Based Wave Redesign (2026-09-06) - so quai spawn DONG THOI moi
   * wave, theo thu tu. sum(waves) PHAI bang totalEnemyCount (test bat
   * bien enforce dieu nay cho moi stage - xem EffectiveWaves.test.ts).
   * Stage floor 10 (solo boss) van khai waves binh thuong (du lieu tho,
   * khong override) - effectiveWaves() moi la ham ap override thanh [1],
   * y het cach effectiveTotalEnemyCount() da lam cho totalEnemyCount.
   */
  waves: number[]

  // Nhip spawn mac dinh - quai moi spawn theo nhip nay SONG SONG voi
  // quai dang song (khong doi chet moi spawn tiep), xem
  // GameManager.updateStageProgress(). San trong quai giua chung thi
  // spawn ngay bat ke con bao nhieu giay trong nhip nay.
  spawnIntervalSeconds: number

  // Core Loop Foundation checklist (Muc BOSS) - khong khai = stage
  // nay khong co Boss (chi enemyPool ngau nhien nhu cu). Khai thi
  // LUOT SPAWN CUOI CUNG (spawnedCount === totalEnemyCount - 1) LUON
  // LA Boss (khong roll enemyPool cho luot do) - xem
  // GameManager.pickEnemyForSpawn().
  bossEnemyId?: string

  // Auto-farm Hoan My (2026-09-04 spec) - so ROUND toi da de dat dieu
  // kien "Hoan My" (spec v3 D1: every party member alive at victory;
  // the count is battle.roundsElapsed - ATB rounds, NOT actor actions;
  // the HP-loss threshold was removed). undefined = stage nay chua dinh nghia nguong, khong
  // bao gio dat Hoan My (an toan - khong mo khoa auto-farm ngoai y
  // muon cho stage chua balance). Content work, set theo tung stage.
  perfectClearTurnLimit?: number
}
