import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { defineEnemy } from '../enemy/Enemy'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// P7-M4 - the mortal basic pick is persisted PlayerData
// (mortalBasicSkillId) written through the ONE role-write op. The
// mortal runtime resolves it; post-path the pick is cleared and the
// op rejects.
function setup() {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  return gameManager
}

const ENEMY = defineEnemy({
  id: 'mortal_pick_enemy',
  name: 'Dummy',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: { maxHp: 1_000_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

describe('setMortalBasicSkill — the only role write', () => {
  it('writes the persisted pick for a mortal who learned the precursor', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    gameManager.progressionOps.learnSkill('linh_bao', player)

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(true)
    expect(player.mortalBasicSkillId).toBe('linh_bao')
  })

  it('rejects once any cultivation path is chosen', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.realmLevel = 12

    gameManager.progressionOps.learnSkill('linh_bao', player)
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(false)
  })

  it('rejects a non-precursor id', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    gameManager.progressionOps.learnSkill('hoa_cau_thuat', player)

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'hoa_cau_thuat')).toBe(false)
    expect(player.mortalBasicSkillId).toBeUndefined()
  })

  it('rejects a precursor the player never learned', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'huy_quyen')).toBe(false)
    expect(player.mortalBasicSkillId).toBeUndefined()
  })
})

describe('mortal basic resolution through the persisted pick', () => {
  it('a battle stamps the picked precursor as the participant basic', () => {
    const gameManager = setup()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()
    gameManager.progressionOps.learnSkill('tram', player)
    gameManager.progressionOps.learnSkill('linh_bao', player)
    expect(gameManager.progressionOps.setMortalBasicSkill(player, 'linh_bao')).toBe(true)

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, ENEMY)

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('linh_bao')
  })

  it('absent pick resolves the tram default; special/ultimate stay empty', () => {
    const gameManager = setup()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()
    gameManager.progressionOps.learnSkill('tram', player)

    gameManager.setActivePlayer(player)
    gameManager.startBattleWithPlayer(player, ENEMY)

    const participant = gameManager.getTurnBattle()!.players[0]!
    expect(participant.basic?.id).toBe('tram')
    expect(participant.special).toBeUndefined()
    expect(participant.ultimate).toBeUndefined()
  })
})

// P7-M4 sec.4.5b/sec.4.6 - a successful initiation always yields a LEARNED
// starter: the commit block learns way.starterBasicSkillId (idempotent -
// boot already taught it; this repairs a save whose entry is missing).
// The template check is pre-commit: a way whose starter template is
// absent fails the whole ritual with zero mutation.
describe('ritual starter guarantee', () => {
  it('the ritual learns a missing starter inside the commit block', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.realmLevel = 12

    // No huy_quyen learned - the body way's starter must still arrive
    // learned after a successful initiation.
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(true)
    expect(gameManager.skillManager.has('huy_quyen')).toBe(true)
  })

  it('a way whose starter template is missing rejects with zero mutation', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(
      SKILLS.filter((skill) => skill.id !== 'huy_quyen'),
    )
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const player = createDefaultPlayer()
    player.realmLevel = 12
    player.mortalBasicSkillId = 'tram'

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(player.mortalBasicSkillId).toBe('tram')
  })
})

// P7-M4 - the UI role read consumes the SAME override-aware runtime
// binding combat uses: a test-installed resolver resolves identically
// for both, and the seam output is the display contract.
describe('getResolvedSkillRoles — the resolved-role display read', () => {
  it('mortal: a def-backed basic with the learned instance', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    gameManager.progressionOps.learnSkill('tram', player)

    const roles = gameManager.progressionOps.getResolvedSkillRoles(player)
    expect(roles.basic).toMatchObject({ kind: 'def', def: { id: 'tram' } })
    expect(roles.basic.kind === 'def' ? roles.basic.skill?.id : undefined).toBe('tram')
    expect(roles.special).toBeUndefined()
    expect(roles.ultimate).toBeUndefined()
  })

  it('sword way: the basic surfaces as the provider label, not a def', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.realmLevel = 12

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)

    const roles = gameManager.progressionOps.getResolvedSkillRoles(player)
    expect(roles.basic).toEqual({ kind: 'dynamic', label: 'Kiếm Phổ' })
  })

  it('the resolver override resolves identically for combat and the UI read', () => {
    const gameManager = setup()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()

    gameManager.setPathRuntimeResolver(() => ({
      resolveBasic: () => ({
        id: 'override_basic',
        cooldownTurns: 0,
        targeting: { shape: 'single' },
      }),
      resolveSpecialUltimate: () => undefined,
      resolveMaxThe: () => 0,
      resolveStatDomains: () => undefined,
      describeDynamicBasic: () => ({ name: 'Override Basic' }),
      buildDynamicBasic: () => undefined,
    }))

    try {
      // The UI accessor resolves through the shared binding - the
      // override's dynamic label, not the registry's mortal def.
      const roles = gameManager.progressionOps.getResolvedSkillRoles(player)
      expect(roles.basic).toEqual({ kind: 'dynamic', label: 'Override Basic' })

      // And combat consumes the identical resolution.
      gameManager.setActivePlayer(player)
      gameManager.startBattleWithPlayer(player, ENEMY)
      expect(gameManager.getTurnBattle()!.players[0]!.basic?.id).toBe('override_basic')
    } finally {
      gameManager.setPathRuntimeResolver(undefined)
    }
  })
})
