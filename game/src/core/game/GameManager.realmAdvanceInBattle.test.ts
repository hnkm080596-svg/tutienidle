import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '../../data/progression/SkillCoreNodes'
import { CANONICAL_REALM_PASSIVE_LADDER } from '../../data/progression/RealmPassiveLadder'
import {
  SPIRIT_STONE_MATERIAL,
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
import { getRealmTier } from '../realm/RealmTierMap'

// F-TT-CLEAN-A5-INT-1 - the isTurnBattleInProgress gates on
// RealmAdvanceOps get the same rejection pins the ProgressionOps
// writers already have (GameManagerProgressionOps.inBattle.test.ts):
// mid-battle calls return the rejection sentinel and mutate nothing.
// setArtifactPath + tryUpgradeArtifactGrade already carry their own
// mid-battle pins; this file covers the remaining gated sites.

const PUNCHING_BAG = defineEnemy({
  id: 'ra_inbattle_punching_bag',
  name: 'Punching Bag',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 1_000_000,
    might: 0,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0,
  },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

function setup() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerEnemyTemplates([PUNCHING_BAG])

  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

function inBattle(gameManager: GameManager, player: ReturnType<typeof createDefaultPlayer>) {
  gameManager.startBattleWithPlayer(player, PUNCHING_BAG)
  expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(true)
}

describe('realmAdvanceOps in-battle rejection gates', () => {
  it('chooseCultivationPath rejects mid-battle without mutating state', () => {
    const { gameManager, player } = setup()
    player.realmLevel = 12
    inBattle(gameManager, player)

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('tryAdvanceTechniqueGrade rejects mid-battle without spending material', () => {
    const { gameManager, player } = setup()
    player.realmId = 'foundation_establishment'
    gameManager.techniqueManager.setActive({ ...structuredClone(TECHNIQUES[0]!), grade: 1 })

    const stoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier('foundation_establishment'))
    gameManager.materialBag.add({ ...SPIRIT_STONE_MATERIAL, id: stoneId }, 1_000)

    inBattle(gameManager, player)

    expect(gameManager.realmAdvanceOps.tryAdvanceTechniqueGrade(player)).toBe(false)
    expect(gameManager.techniqueManager.getActive()!.grade).toBe(1)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(1_000)
  })

  it('syncRealmPassive is a no-op mid-battle (same-realm passive already owned)', () => {
    const { gameManager, player } = setup()
    gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)
    player.realmId = 'foundation_establishment'

    const fePassive = CANONICAL_REALM_PASSIVE_LADDER.foundation_establishment
    expect(fePassive).toBeTruthy()
    expect(gameManager.skillManager.has(fePassive!)).toBe(false)

    inBattle(gameManager, player)
    gameManager.realmAdvanceOps.syncRealmPassive(player)

    expect(gameManager.skillManager.has(fePassive!)).toBe(false)
  })

  it('syncRealmStatPassive is a no-op mid-battle (sibling gate)', () => {
    const { gameManager, player } = setup()
    player.realmId = 'foundation_establishment'
    expect(player.grantedRealmPassiveIds).toEqual([])

    inBattle(gameManager, player)
    gameManager.realmAdvanceOps.syncRealmStatPassive(player)

    expect(player.grantedRealmPassiveIds).toEqual([])
    expect(player.modifiers).toEqual([])
  })

  it('resolveTalentEntitlement rejects mid-battle - record and dialog stay pending', () => {
    const { gameManager, player } = setup()
    player.realmId = 'foundation_establishment'
    player.pendingTalentEntitlement = {
      realmId: 'foundation_establishment',
      offeredTalentIds: ['tc_dia_can'],
    }

    inBattle(gameManager, player)
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
      kind: 'new',
      talentId: 'tc_dia_can',
    })).toBe(false)
    expect(player.pendingTalentEntitlement).not.toBeUndefined()
  })
})
