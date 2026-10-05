// QA FIXPOINT r11 - INT (blind adversarial integration) evidence probes,
// POST-FIX pins.
//
// These tests pin the POST-FIX aggregate contract for findings in
// game/docs/qa/2026-10-05-fixpoint-r11-int.md.
//
//   INT-11-01  a forged/future quests.lastDailyResetAtMs still passes
//              shape validation but QuestManager.restore now clamps it
//              to Date.now() ("just reset") - the frozen-board hole is
//              closed and no free reset is granted. Latent in beta
//              (dailyQuest feature flag off).
//   INT-11-02  settleAutoFarmOffline now writes the anchor BEFORE the
//              mint loop AND bounds the payable window by
//              (now - lastCheckedMs): a mid-settle throw propagates
//              with the anchor consumed, so the same-payload restore
//              retry settles ~0 cycles - underpay on crash, never
//              double-pay.

import { describe, expect, it } from 'vitest'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { defineEnemy } from '@/core/enemy/Enemy'
import { utcDayBucket } from '@/core/idle/GameClock'
import type { BattleLootSystem } from '@/core/game/BattleLootSystem'

const EVIDENCE_DUMMY = defineEnemy({
  id: 'r11_evidence_dummy',
  name: 'Evidence Dummy',
  level: 10,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 10,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
  },
  // techniqueMastery>0 so the auto-farm mint writes a nonzero insight
  // amount into the player-resident daily ledger.
  rewards: { techniqueMastery: 100, spiritStone: 1 },
})

const EVIDENCE_STAGE = {
  id: 'r11_evidence_stage',
  name: 'Evidence Stage',
  description: '',
  floor: 1,
  requiredRealmId: 'qi_refining',
  enemyPool: [{ enemyId: 'r11_evidence_dummy', weight: 1 }],
  totalEnemyCount: 2,
  waves: [2],
  spawnIntervalSeconds: 0,
}

describe('INT-11-01 — forged-future quests.lastDailyResetAtMs clamps at restore (post-fix)', () => {
  it('restore clamps the forged marker to now; the gate fires on the next day bucket', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    const now = Date.now()
    const forged = now + 30 * 24 * 60 * 60 * 1000 // 30 days in the future

    // Restore clamps finite future values to now - "just reset" - so the
    // board can neither freeze nor be rolled early for free.
    gameManager.questManager.restore({
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: forged,
      questFlags: [],
    })
    expect(gameManager.questManager.getLastDailyResetAtMs()).toBeLessThanOrEqual(Date.now() + 1)
    expect(gameManager.questManager.getLastDailyResetAtMs()).toBeGreaterThan(now - 5000)

    // Same bucket: suppressed (just reset). Two days later: the gate
    // fires - the freeze is gone.
    const twoDaysLater = now + 2 * 24 * 60 * 60 * 1000
    expect(utcDayBucket(twoDaysLater)).toBeGreaterThan(utcDayBucket(now))
    expect(
      gameManager.questSystem.checkAndResetDaily(
        gameManager.questRegistry,
        gameManager.questManager,
        player,
        twoDaysLater,
      ),
    ).toBe(true)
  })
})

describe('INT-11-02 — mid-settle throw consumes the anchor; retry settles remainder only (post-fix)', () => {
  function farmHarness() {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([EVIDENCE_DUMMY])
    gameManager.catalogOps.registerStages([EVIDENCE_STAGE])
    player.perfectClearStageIds.push('r11_evidence_stage')
    player.perfectClearSeconds['r11_evidence_stage'] = 100
    return { gameManager, player }
  }

  it('a throw inside the mint loop propagates with the window already consumed; retry mints ~0', () => {
    const { gameManager, player } = farmHarness()
    const autoFarmOps = gameManager.turnBattleOps.autoFarmOps

    expect(autoFarmOps.startAutoFarm(player, 'r11_evidence_stage')).toBe(true)

    // ~33 min ago -> at 0.5 offline efficiency and 100s cycle the window
    // settles ~10 cycles.
    const staleLastChecked = Date.now() - 2000 * 1000
    player.autoFarmStage!.lastCheckedMs = staleLastChecked

    // Reach the shared BattleLootSystem inside the ops deps (TS-private
    // only at compile time) and make the SECOND mint call throw - a
    // stand-in for the documented mid-loop failure classes (registry
    // miss, RNG/schema defect).
    const battleLoot = (
      autoFarmOps as unknown as { deps: { battleLoot: BattleLootSystem } }
    ).deps.battleLoot
    const original = battleLoot.processDefeatedEnemies.bind(battleLoot)
    let calls = 0
    battleLoot.processDefeatedEnemies = ((
      ...args: Parameters<BattleLootSystem['processDefeatedEnemies']>
    ) => {
      calls += 1
      if (calls === 2) {
        throw new Error('probe: mid-settle throw')
      }
      return original(...args)
    }) as BattleLootSystem['processDefeatedEnemies']

    expect(() => autoFarmOps.settleAutoFarmOffline(player, 2000)).toThrow(
      'probe: mid-settle throw',
    )

    // PIN 1 - the anchor is written BEFORE the loop: it consumed the
    // window (stale anchor gone) even though the throw propagated.
    expect(player.autoFarmStage!.lastCheckedMs).not.toBe(staleLastChecked)
    expect(player.autoFarmStage!.lastCheckedMs).toBeGreaterThan(staleLastChecked)
    expect(calls).toBe(2)

    // PIN 2 - cycles minted before the throw are NOT rolled back:
    // player-resident state already carries the partial prefix.
    const mintedAfterThrow = player.idleSkillInsightDaily?.minted ?? 0
    expect(mintedAfterThrow).toBeGreaterThan(0)

    // The designed retry (same payload re-restores) now settles ~0
    // cycles: the payable window min(elapsed, now - anchor) collapses to
    // the unsettled remainder, so NOTHING re-pays - the ledger is flat.
    battleLoot.processDefeatedEnemies = original
    autoFarmOps.settleAutoFarmOffline(player, 2000)
    expect(player.idleSkillInsightDaily?.minted ?? 0).toBe(mintedAfterThrow)
  })
})
