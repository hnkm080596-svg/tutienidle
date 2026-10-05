// QA FIXPOINT r10 - INT (blind adversarial integration) evidence probes.
//
// These tests are EVIDENCE for findings in
// game/docs/qa/2026-10-05-fixpoint-r10-int.md - they pin the current
// aggregate behavior, including the parts that are currently WRONG.
// Failing assertions below are the repro; do not "fix" the tests -
// fix the data/code they pin.
//
// Coverage:
//   INT-01  collect_foundation_ore_30 demands qi_refining_ore_decade but
//           the foundation band stopped dropping it (band swap commit)
//   INT-02  the hoa_cau_comet 'ultimate' ring tier is unreachable -
//           only element basics carry the preset and spell kits have no
//           ultimate slot (dead render branch + dead atlas in production)
//   INT-04  a stale/crafted autoFarmStage.lastCheckedMs mints a full 24h
//           window at LIVE rate in tickAutoFarm - bypassing the
//           OFFLINE_EFFICIENCY=0.5 the offline settle applies to the
//           same window (shape-validation only requires non-negative).

import { describe, expect, it } from 'vitest'
import { QUESTS } from '@/data/quest/quests'
import { STAGE_DROP_TABLES } from '@/data/drop/StageDropTables'
import { SKILLS, SPELL_KIT_IDS } from '@/data/skill/Skills'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { defineEnemy } from '@/core/enemy/Enemy'

const EVIDENCE_DUMMY = defineEnemy({
  id: 'r10_evidence_dummy',
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
  rewards: { techniqueMastery: 0, spiritStone: 1 },
})

const EVIDENCE_STAGE = {
  id: 'r10_evidence_stage',
  name: 'Evidence Stage',
  description: '',
  floor: 1,
  requiredRealmId: 'qi_refining',
  enemyPool: [{ enemyId: 'r10_evidence_dummy', weight: 1 }],
  totalEnemyCount: 2,
  waves: [2],
  spawnIntervalSeconds: 0,
}

describe('INT-01 — collect quest material must drop inside its own realm band', () => {
  // A collect quest authored at realm X ("thu ???c t? y?u th? h?u s?n")
  // is only honest if the material appears in the band table of that
  // realm - the table the player farming that chapter actually rolls.
  it('moi collect quest co materialId trong band table cua CHINH realm quest', () => {
    const failures: string[] = []

    for (const quest of QUESTS) {
      if (quest.condition.kind !== 'collect' || !quest.requiredRealmId) continue

      const band = STAGE_DROP_TABLES.find((t) => t.realmId === quest.requiredRealmId)
      const droppedMaterials = new Set(
        (band?.pool ?? [])
          .filter((entry) => entry.kind === 'material')
          .map((entry) => entry.itemId),
      )

      if (!droppedMaterials.has(quest.condition.materialId)) {
        failures.push(
          `${quest.id} (realm ${quest.requiredRealmId}) requires '${quest.condition.materialId}' ` +
            `but that band drops only [${[...droppedMaterials].join(', ')}]`,
        )
      }
    }

    // CURRENT FAIL: collect_foundation_ore_30 requires qi_refining_ore_decade
    // while the foundation band pays foundation_establishment_ore_decade -
    // the described source ("y?u th? h?u s?n") can no longer fill it.
    expect(failures).toEqual([])
  })
})

describe('INT-02 — hoa_cau_comet "ultimate" ring tier reachability', () => {
  // HoaCauFireballPresentation renders a 3rd (outer) portal ring only when
  // cast.slotRole === 'ultimate'. The preset is exclusive to the Phap Tu
  // fire basic; spell kits resolve {basic, special} with NO ultimate slot,
  // so castSlotRole can never emit 'ultimate' for this preset - the ring
  // is dead code/art in production (only the dev lab reaches it).
  it('moi skill vfxPresetId hoa_cau_comet la kit basic — khong skill nao chiem slot ultimate', () => {
    const kitBasics = new Set(Object.values(SPELL_KIT_IDS).map((pair) => pair[0]))
    const kitSpecials = new Set(Object.values(SPELL_KIT_IDS).map((pair) => pair[1]))

    const cometSkills = SKILLS.filter(
      (skill) => (skill as { vfxPresetId?: string }).vfxPresetId === 'hoa_cau_comet',
    )

    // Exactly one carrier today (hoa_cau_thuat); every carrier must sit
    // in the basic position - a special/ult-position carrier would be a
    // different reachability story.
    expect(cometSkills.length).toBeGreaterThan(0)
    for (const skill of cometSkills) {
      expect(kitBasics.has(skill.id)).toBe(true)
      expect(kitSpecials.has(skill.id)).toBe(false)
    }
  })

  it('spell kit pairs dung 2 slot (basic, special) — khong co ultimate cho hoa_cau_comet', () => {
    for (const pair of Object.values(SPELL_KIT_IDS)) {
      expect(pair.length).toBe(2)
    }
  })
})

describe('INT-04 — stale/crafted lastCheckedMs bypasses OFFLINE_EFFICIENCY', () => {
  function farmHarness() {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    gameManager.catalogOps.registerEnemyTemplates([EVIDENCE_DUMMY])
    gameManager.catalogOps.registerStages([EVIDENCE_STAGE])
    player.perfectClearStageIds.push('r10_evidence_stage')
    player.perfectClearSeconds['r10_evidence_stage'] = 100
    return { gameManager, player }
  }

  it('tickAutoFarm voi lastCheckedMs 24h truoc tra FULL rate (864 cycles), offline settle cung window chi tra 432', () => {
    const { gameManager, player } = farmHarness()

    // Honest entry point acquires the lease, then the persisted field is
    // overwritten to a stale/crafted value - save validation only
    // requires a non-negative number (no bound vs lastSavedAt/now).
    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, 'r10_evidence_stage')).toBe(true)
    player.autoFarmStage!.lastCheckedMs = Date.now() - 24 * 60 * 60 * 1000

    const mintedBefore = player.idleSkillInsightDaily?.minted ?? 0
    gameManager.turnBattleOps.autoFarmOps.tickAutoFarm(player)
    const minted = (player.idleSkillInsightDaily?.minted ?? 0) - mintedBefore

    // QI band: ~1 insight per kill, 2 kills per cycle.
    // Full-rate 24h tick: 864 cycles * 2 kills = 1728 insight.
    // The offline settle for the SAME window pays 432 cycles -> 864.
    // (Daily idle cap 30k does not bind at these numbers.)
    expect(minted).toBe(864 * 2)
  })
})
