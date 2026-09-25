import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { selectAction, selectForcedAction } from '../battle/turn/TurnSkillAction'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// The Tu beta — kit resolution reads the owned root at participant
// build: cuong_chien -> cuong_quyen basic (+ loan_dau once its TC core
// is owned), tran_the -> tran_ap basic (+ phan_chan likewise). Beta
// window: NO ultimate slot, and the special slot stays empty until the
// owning major grants the core (no root -> GENERIC_PHYSICAL_BASIC only,
// INV-3).

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
  it('cuong_chien root -> cuong_quyen basic only; loan_dau needs its TC core; no ultimate', () => {
    const gameManager = makeManager()
    const lq = makeBodyPlayer({ cuong_chien: 1 })

    gameManager.setActivePlayer(lq)
    gameManager.startBattleWithPlayer(lq, makeDummyEnemy('kit_cuong_lq'))

    const lqParticipant = gameManager.getTurnBattle()!.players[0]!
    expect(lqParticipant.basic?.id).toBe('cuong_quyen')
    expect(lqParticipant.special).toBeUndefined()
    expect(lqParticipant.ultimate).toBeUndefined()
    expect(lqParticipant.activeDomains?.has('body')).toBe(true)

    const gameManager2 = makeManager()
    const tc = makeBodyPlayer({ cuong_chien: 1, core_loan_dau: 1 })

    gameManager2.setActivePlayer(tc)
    gameManager2.startBattleWithPlayer(tc, makeDummyEnemy('kit_cuong_tc'))

    const tcParticipant = gameManager2.getTurnBattle()!.players[0]!
    expect(tcParticipant.basic?.id).toBe('cuong_quyen')
    expect(tcParticipant.special?.skill.id).toBe('loan_dau')
    expect(tcParticipant.ultimate).toBeUndefined()
  })

  it('tran_the root -> tran_ap basic only; phan_chan needs its TC core; no ultimate', () => {
    const gameManager = makeManager()
    const lq = makeBodyPlayer({ tran_the: 1 })

    gameManager.setActivePlayer(lq)
    gameManager.startBattleWithPlayer(lq, makeDummyEnemy('kit_tran_lq'))

    const lqParticipant = gameManager.getTurnBattle()!.players[0]!
    expect(lqParticipant.basic?.id).toBe('tran_ap')
    expect(lqParticipant.special).toBeUndefined()
    expect(lqParticipant.ultimate).toBeUndefined()

    const gameManager2 = makeManager()
    const tc = makeBodyPlayer({ tran_the: 1, core_phan_chan: 1 })

    gameManager2.setActivePlayer(tc)
    gameManager2.startBattleWithPlayer(tc, makeDummyEnemy('kit_tran_tc'))

    const tcParticipant = gameManager2.getTurnBattle()!.players[0]!
    expect(tcParticipant.basic?.id).toBe('tran_ap')
    expect(tcParticipant.special?.skill.id).toBe('phan_chan')
    expect(tcParticipant.ultimate).toBeUndefined()
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

  it('phan_chan is a real castable special (no emblem), and its reflect passive lands at build', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({ tran_the: 1, core_phan_chan: 1 })

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_phan_chan'))

    const participant = gameManager.getTurnBattle()!.players[0]!

    // Phan Chan is the beta castable special — selectable as a special
    // cast, never an emblem.
    expect(participant.special?.skill.emblemOnly).toBeUndefined()
    expect(selectForcedAction(participant, 'special').skillId).toBe('phan_chan')

    // Permanent phan_chan reflect passive planted at participant build.
    expect(
      gameManager.getBattleBuffs(participant.entity.id).filter((i) => i.definitionId === 'phan_chan'),
    ).toHaveLength(1)
  })

  it('basic is always selected when only the root is owned (LQ stream)', () => {
    const gameManager = makeManager()
    const player = makeBodyPlayer({ tran_the: 1 })

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kit_lq_stream'))

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.special).toBeUndefined()
    expect(selectAction(participant).skillId).toBe('tran_ap')
  })
})
