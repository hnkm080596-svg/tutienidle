import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { selectAction, selectForcedAction } from '../battle/turn/TurnSkillAction'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// The Tu Reimagined (plan Task 6) — kit resolution reads the owned root
// at participant build: cuong_chien -> Cuong Chien kit, tran_the ->
// Tran The kit, no root -> GENERIC_PHYSICAL_BASIC only (INV-3).

const ENEMY_STATS_INPUT = {
  maxHp: 10_000_000,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function makeDummyEnemy(id: string) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...ENEMY_STATS_INPUT },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

// Stub branch roots — Task 12 authors the real TheTuNodes; resolution
// only needs the ids registered (getNodeLevel is registry-gated).
const ROOT_STUBS = [
  { id: 'cuong_chien', name: 'Cuồng Chiến', type: 'major', role: 'root', insightCost: 0, effect: {} },
  { id: 'tran_the', name: 'Trấn Thể', type: 'major', role: 'root', insightCost: 0, effect: {} },
] as const

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes([...ROOT_STUBS])
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  return gameManager
}

function makeBodyPlayer(nodeLevels: Record<string, number>) {
  const player = createDefaultPlayer()
  player.cultivationPath = 'body'
  player.cultivationWay = 'body_pathway'
  player.nodeLevels = nodeLevels
  return player
}

describe('body kit resolution (root -> kit at participant build)', () => {
  it('cuong_chien root -> cuong_quyen / loan_dau / bat_tu_ba_the', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({ cuong_chien: 1 })

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_cuong'))

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('cuong_quyen')
    expect(participant.special?.skill.id).toBe('loan_dau')
    expect(participant.ultimate?.skill.id).toBe('bat_tu_ba_the')
    expect(participant.activeDomains?.has('body')).toBe(true)
  })

  it('tran_the root -> tran_ap / phan_chinh emblem / son_nhac', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({ tran_the: 1 })

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_tran'))

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('tran_ap')
    expect(participant.special?.skill.id).toBe('phan_chinh')
    expect(participant.ultimate?.skill.id).toBe('son_nhac')
  })

  it('no root -> GENERIC_PHYSICAL_BASIC only, no special/ultimate', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({})

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_none'))

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('generic_physical')
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })

  it('emblem special is never selected by selectAction/selectForcedAction but its buff lands at build', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({ tran_the: 1 })

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_emblem'))

    const participant = gameManager.getTurnBattle()!.players[0]!

    // Emblem occupies the slot but is skipped by selection.
    expect(participant.special?.skill.emblemOnly).toBe(true)
    expect(selectAction(participant).skillId).toBe('son_nhac')
    expect(selectForcedAction(participant, 'special').skillId).not.toBe('phan_chinh')

    // Permanent phan_chinh self-buff applied at participant build.
    expect(
      gameManager.getBattleBuffs(participant.entity.id).filter((i) => i.definitionId === 'phan_chinh'),
    ).toHaveLength(1)
  })
})
