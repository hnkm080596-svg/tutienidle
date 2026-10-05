// QA FIXPOINT r11 — INT (blind adversarial integration) evidence probes.
//
// These tests are EVIDENCE for findings in
// game/docs/qa/2026-10-05-fixpoint-r11-int.md — they pin the current
// aggregate behavior, including parts that are currently WRONG.
// Do not "fix" the tests — fix the code they pin.
//
// Coverage:
//   INT-11-01  a forged/future quests.lastDailyResetAtMs survives save
//              shape validation (non-negative finite only, no bound vs
//              lastSavedAt — unlike appliedAtMs/startedAtMs/expiresAtMs
//              which enforce `<= lastSavedAt`) AND QuestManager.restore
//              (finite && >=0 only), then suppresses checkAndResetDaily
//              until wall time crosses the forged date — the same
//              crafted-timestamp class the r10 commit re-anchored for
//              autoFarmStage.lastCheckedMs. Latent in beta (dailyQuest
//              feature flag off).
//   INT-11-02  settleAutoFarmOffline anchors autoFarmStage.lastCheckedMs
//              only AFTER the mint loop — a mid-settle throw propagates
//              with partial mints already landed on player state and the
//              stale anchor untouched, so the designed same-payload
//              restore retry re-rolls the whole window and re-pays the
//              settled prefix (bounded for insight by the daily ledger;
//              bag/technique/quest mints self-heal via replacement
//              restore — residue is the un-anchored re-roll itself).

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

describe('INT-11-01 — forged-future quests.lastDailyResetAtMs suppresses daily reset', () => {
  it('restore accepts a future-dated reset marker and checkAndResetDaily stays suppressed inside the forged window', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    const now = Date.now()
    const forged = now + 30 * 24 * 60 * 60 * 1000 // 30 days in the future

    // QuestManager.restore normalize clause: finite && >=0 — no upper
    // bound vs now/lastSavedAt. The validator mirrors it
    // (saveShapeValidation.ts ~3130: non-negative finite only), while
    // sibling timestamps DO enforce `<= lastSavedAt`
    // (appliedAtMs ~1484, startedAtMs ~3334, expiresAtMs ~811).
    gameManager.questManager.restore({
      active: [],
      completedOnceIds: [],
      lastDailyResetAtMs: forged,
      questFlags: [],
    })
    expect(gameManager.questManager.getLastDailyResetAtMs()).toBe(forged)

    // checkAndResetDaily: dayBucket(now) <= dayBucket(lastReset) -> refuse.
    // Two days later is a genuinely NEW day bucket — a correct gate must
    // reset — but the forged marker still sits ahead of it.
    const twoDaysLater = now + 2 * 24 * 60 * 60 * 1000
    expect(utcDayBucket(twoDaysLater)).toBeGreaterThan(utcDayBucket(now))
    expect(utcDayBucket(twoDaysLater)).toBeLessThan(utcDayBucket(forged))
    expect(
      gameManager.questSystem.checkAndResetDaily(
        gameManager.questRegistry,
        gameManager.questManager,
        player,
        twoDaysLater,
      ),
    ).toBe(false)

    // The suppression lifts only once wall time PASSES the forged date —
    // confirming the hole shape: no `lastReset > now` re-anchor exists
    // (autoFarmStage.lastCheckedMs got exactly that clamp this commit).
    expect(
      gameManager.questSystem.checkAndResetDaily(
        gameManager.questRegistry,
        gameManager.questManager,
        player,
        forged + 24 * 60 * 60 * 1000,
      ),
    ).toBe(true)
  })
})

describe('INT-11-02 — mid-settle throw leaves lastCheckedMs unanchored, retry re-pays prefix', () => {
  function farmHarness() {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([EVIDENCE_DUMMY])
    gameManager.catalogOps.registerStages([EVIDENCE_STAGE])
    player.perfectClearStageIds.push('r11_evidence_stage')
    player.perfectClearSeconds['r11_evidence_stage'] = 100
    return { gameManager, player }
  }

  it('a throw inside the mint loop propagates with partial mints landed and the anchor never written', () => {
    const { gameManager, player } = farmHarness()
    const autoFarmOps = gameManager.turnBattleOps.autoFarmOps

    expect(autoFarmOps.startAutoFarm(player, 'r11_evidence_stage')).toBe(true)

    // ~33 min ago -> at 0.5 offline efficiency and 100s cycle the window
    // settles ~10 cycles.
    const staleLastChecked = Date.now() - 2000 * 1000
    player.autoFarmStage!.lastCheckedMs = staleLastChecked

    // Reach the shared BattleLootSystem inside the ops deps (TS-private
    // only at compile time) and make the SECOND mint call throw — a
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

    // PIN 1 — the anchor is written only AFTER the loop, so the stale
    // lastCheckedMs survives the throw untouched: the retry below is
    // handed the SAME window again.
    expect(player.autoFarmStage!.lastCheckedMs).toBe(staleLastChecked)
    expect(calls).toBe(2)

    // PIN 2 — cycles minted before the throw are NOT rolled back:
    // player-resident state already carries the partial prefix.
    const mintedAfterThrow = player.idleSkillInsightDaily?.minted ?? 0
    expect(mintedAfterThrow).toBeGreaterThan(0)

    // The designed retry (same payload re-restores; the farm state was
    // never anchored) re-rolls the entire window and re-pays the
    // settled prefix — inside a restore the bag/technique/quest slices
    // self-heal via replacement, but the player-resident ledger grows.
    battleLoot.processDefeatedEnemies = original
    autoFarmOps.settleAutoFarmOffline(player, 2000)
    expect(player.idleSkillInsightDaily?.minted ?? 0).toBeGreaterThan(mintedAfterThrow)
    // Success path finally anchors.
    expect(player.autoFarmStage!.lastCheckedMs).not.toBe(staleLastChecked)
  })
})
