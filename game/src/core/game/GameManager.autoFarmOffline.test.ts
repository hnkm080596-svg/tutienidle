import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'

// Auto-farm spec Task 5 - offline catch-up: sau restore, auto-farm dang
// chay roll reward cho SO CYCLES da troi offline (dung cung chu ky online),
// lastCheckedMs tien dung phan da settle (leftover giu lai).
// 2026-10-05, Minh ruling "offline 50%": window offline duoc nhan
// OFFLINE_EFFICIENCY (0.5) truoc khi floor thanh cycles - moi kenh cycle
// mint (stones/materials/mastery/insight) deu tra nua live rate, va phan
// du chua du cycle cung chi mang nua gia tri sang tick live tiep theo.

const OFFLINE_DUMMY = defineEnemy({
  id: 'offline_dummy',
  name: 'Offline Dummy',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 10,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  },
  rewards: { techniqueMastery: 0, spiritStone: 5 },
})

const OFFLINE_STAGE = {
  id: 'farm_stage',
  name: 'Farm Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: 'offline_dummy', weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

// QI band mints deterministically: stage mastery roll 35-45 ->
// round(x * 0.018) = 1 insight per kill, always - the persisted
// idleSkillInsightDaily.minted counter then reads as exact kill/cycle
// count (2 kills per cycle below), which spiritStone rolls cannot pin.
const QI_DUMMY = defineEnemy({
  id: 'qi_dummy',
  name: 'QI Dummy',
  level: 10,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 100,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  },
  rewards: { techniqueMastery: 0, spiritStone: 5 },
})

const QI_STAGE = {
  id: 'qi_farm_stage',
  name: 'QI Farm Stage',
  description: '',
  floor: 1,
  requiredRealmId: 'qi_refining',
  enemyPool: [{ enemyId: 'qi_dummy', weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

function harnessWithFarm() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  gameManager.catalogOps.registerEnemyTemplates([OFFLINE_DUMMY, QI_DUMMY])
  gameManager.catalogOps.registerStages([OFFLINE_STAGE, QI_STAGE])

  return { gameManager, player }
}

describe('GameManager — auto-farm offline catch-up (restore)', () => {
  it('settleAutoFarmOffline roll đúng số cycles trôi (x0.5) + lastCheckedMs tiến đúng phần đã settle', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('farm_stage')
    player.perfectClearSeconds['farm_stage'] = 100 // cycle = 100s

    // 240s offline x OFFLINE_EFFICIENCY 0.5 = 120s hieu luc =
    // 1 cycle (100s) + 20s du. Truoc ruling: 1 cycle + 20s du tu 120s.
    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs: Date.now() - 240_000,
    }

    const before = gameManager.getBattleRewardSummary().spiritStone

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 240)

    // Dung 1 cycle roll -> co linh thach (full rate se roll 2 cycles).
    expect(gameManager.getBattleRewardSummary().spiritStone).toBeGreaterThan(before)

    // Anchor = now - 20s: phan du cua window HIEU LUC (da x0.5) carry
    // sang tick live, khong phai 120s raw remainder.
    expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThanOrEqual(Date.now() - 21_000)
    expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(Date.now())
  })

  it('KHÔNG có autoFarmStage → no-op an toàn', () => {
    const { gameManager, player } = harnessWithFarm()

    expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)).not.toThrow()
  })

  it('elapsed không đủ 1 cycle hieu luc → anchor mang DUNG nua remainder', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('farm_stage')
    player.perfectClearSeconds['farm_stage'] = 100

    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs: Date.now() - 10_000,
    }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 10)

    // 10s offline x 0.5 = 5s hieu luc < 100s cycle -> 0 cycles roll;
    // anchor = now - 5s (remainder da halve). Truoc ruling: lastCheckedMs
    // giu nguyen -> toan bo 10s duoc tick live tra tiep full rate.
    const anchor = player.autoFarmStage!.lastCheckedMs
    expect(anchor).toBeGreaterThanOrEqual(Date.now() - 6_000)
    expect(anchor).toBeLessThanOrEqual(Date.now() - 4_000)
  })

  it('elapsed NaN → no-op an toàn, lastCheckedMs khong bi poison', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('farm_stage')
    player.perfectClearSeconds['farm_stage'] = 100
    const lastCheckedMs = Date.now() - 10_000
    player.autoFarmStage = {
      stageId: 'farm_stage',
      lastCheckedMs,
    }

    expect(() =>
      gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, Number.NaN),
    ).not.toThrow()
    expect(player.autoFarmStage?.lastCheckedMs).toBe(lastCheckedMs)
  })

  it('offline tra DUNG 50%: 400s offline -> 2 cycles insight (full rate = 4)', () => {
    const { gameManager, player } = harnessWithFarm()

    player.perfectClearStageIds.push('qi_farm_stage')
    player.perfectClearSeconds['qi_farm_stage'] = 100 // cycle = 100s
    player.autoFarmStage = {
      stageId: 'qi_farm_stage',
      lastCheckedMs: Date.now() - 400_000,
    }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 400)

    // 400s x 0.5 = 200s hieu luc -> floor(200/100) = 2 cycles x
    // 2 quai x 1 insight = minted 4. Full rate se mint 8. Ledger
    // idleSkillInsightDaily la counter minted thuc te cua kenh idle.
    expect(player.idleSkillInsightDaily?.minted).toBe(4)
  })

  // Remediation Task 3 (2026-09-05) - unbounded offline settlement: settle
  // nhieu ngay offline voi cycle ngan phai CHAN theo DEFAULT_MAX_OFFLINE_
  // SECONDS (24h - cung nguon GameClock), khong roll hang nghin cycles.
  describe('Remediation Task 3 — bounded offline settlement', () => {
    it('elapsed nhiều ngày → roll CHỈ đúng số cycles trong cap 24h (x0.5)', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      player.perfectClearSeconds['farm_stage'] = 100 // cycle = 100s

      const startMs = Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 ngay truoc

      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs: startMs,
      }

      gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 3 * 24 * 60 * 60) // 3 ngay

      // Cap 24h x 0.5 = 12h hieu luc / 100s = 432 cycles - KHONG phai
      // 3 ngay/100s = 2592, cung khong phai 24h/100s = 864.
      // B5 (T1-12): the anchor rebases to now minus the UNSETTLED
      // remainder - the whole capped window settled, so the anchor sits
      // at ~now, NOT startMs + cap (the old encoding left it days stale
      // and let the next online tick re-pay the same window).
      expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThan(Date.now() - 50_000)
      expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(Date.now())
    })

    it('cycleSeconds cực nhỏ (1s) → vẫn bounded, không roll 100k+ cycles', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      player.perfectClearSeconds['farm_stage'] = 1 // cycle = 1s

      // Bat moc 1 LAN - tranh race Date.now() giua setup va assert.
      const startMs = Date.now() - 24 * 60 * 60 * 1000 // dung 24h truoc
      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs: startMs,
      }

      gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 24 * 60 * 60)

      // 24h x 0.5 = 12h / 1s = 43_200 cycles van roll. B5 (T1-12): anchor
      // rebase ve now - remainder (remainder = 0 vi 12h chia het 1s) nen
      // moc nam ~now - khong phai startMs + 24h nhu encoding cu.
      expect(player.autoFarmStage?.lastCheckedMs).toBeGreaterThan(Date.now() - 1000)
      expect(player.autoFarmStage?.lastCheckedMs).toBeLessThanOrEqual(Date.now())
    })

    it('cycleSeconds <= 0 / non-finite → no-op an toàn, không loop vô hạn', () => {
      const { gameManager, player } = harnessWithFarm()

      player.perfectClearStageIds.push('farm_stage')
      // Save hong/malformed: perfectClearSeconds co the 0 hoac NaN.
      player.perfectClearSeconds['farm_stage'] = 0
      // Bat moc 1 LAN - so sanh Date.now() 2 lan bi race vai ms (flaky).
      const lastCheckedMs = Date.now() - 120_000
      player.autoFarmStage = {
        stageId: 'farm_stage',
        lastCheckedMs,
      }

      expect(() => gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 120)).not.toThrow()
      expect(player.autoFarmStage?.lastCheckedMs).toBe(lastCheckedMs)
    })

    it('corrupt small-positive lastCheckedMs → settle pays one capped window, next online tick does NOT pay a second (audit T1-12)', () => {
      vi.useFakeTimers()
      try {
        const { gameManager, player } = harnessWithFarm()

        // tickAutoFarm reads activePlayer via tickOps.update - harnessWithFarm
        // does NOT set it (unlike GameManager.autoFarm.test.ts:53), so set it.
        gameManager.setActivePlayer(player)
        player.perfectClearStageIds.push('farm_stage')
        player.perfectClearSeconds['farm_stage'] = 100 // cycle = 100s

        // Arm through the real entry point - the Mission B tick gate pays
        // only while the ops' lease marker still owns the slot object.
        expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, 'farm_stage')).toBe(true)

        // Corrupt save shape: epoch+1ms survives validation (finite, >= 0).
        player.autoFarmStage!.lastCheckedMs = 1

        // Cycle counter: getBattleRewardSummary().spiritStone aggregates reward
        // rolls without needing a material registry (same read as
        // GameManager.autoFarm.test.ts:118-120).
        const before = gameManager.getBattleRewardSummary().spiritStone

        gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(player, 24 * 60 * 60)

        // The settle covered the whole capped window (24h x 0.5 = 12h
        // hieu luc), so the anchor must sit INSIDE it - not still at epoch.
        const anchor = player.autoFarmStage!.lastCheckedMs
        expect(anchor).toBeGreaterThan(Date.now() - 24 * 60 * 60 * 1000)
        expect(Number.isFinite(anchor)).toBe(true)

        const afterSettle = gameManager.getBattleRewardSummary().spiritStone
        expect(afterSettle).toBeGreaterThan(before)

        // One online tick at most pays the sub-cycle remainder - never
        // another 24h batch (432 cycles x 2 enemies x band stones).
        gameManager.tickOps.update(0.1)

        const tickDelta = gameManager.getBattleRewardSummary().spiritStone - afterSettle
        expect(tickDelta).toBeLessThanOrEqual(2 * 5) // <= 1 cycle worth
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
