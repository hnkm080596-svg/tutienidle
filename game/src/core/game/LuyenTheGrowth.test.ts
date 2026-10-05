import { afterEach, describe, expect, it, vi } from 'vitest'

import { GameManager } from './GameManager'
import type { BattleLootSystem } from './BattleLootSystem'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { pills } from '../../data/pill/pills'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'
import { TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../data/realm/BodyRefinement'
import type { RewardReceiver } from '../reward/RewardSystem'
import type { Stage } from '../stage/Stage'
import type { CombatEntity } from '../combat/CombatEntity'

// Luyen The growth chain regression (luyen-the-growth fix): replays the
// live kill -> bag -> tick invest seam on a real GameManager. Pins the
// verified mechanics (essence lands, realmLevel gate, conversion) plus
// the growth feedback the fix adds - the invest toast is the only
// surface that ever reports Tinh Hoa becoming Luyen The progress.

const BOAR = ENEMIES.find((enemy) => enemy.id === 'mortal_wild_boar')!
const MORTAL_STAGE = STAGES.find((stage) => stage.id === 'mortal_dong_1')!
const ESSENCE = materials.find((material) => material.id === TINH_HOA_PHAM_THE_MATERIAL_ID)!

function harness() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerStages(STAGES)

  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)

  const loot = (gameManager as unknown as { battleLoot: BattleLootSystem }).battleLoot
  loot.beginBattle()
  loot.setSession(
    {
      addSkillInsight: () => {},
      addCultivation: () => {},
      addSpiritStone: () => {},
    } as RewardReceiver,
    player,
  )

  const killBoar = (stageOverride?: Stage) => {
    // The pending-enemy entry needs the real spawned instance id:
    // processDefeatedEnemies resolves the template through
    // enemySystem.get(entity.id), so a fabricated id skips all drops.
    const spawned = gameManager.enemySystem.spawn(BOAR)
    spawned.alive = false
    loot.processDefeatedEnemies(
      [
        {
          entity: { alive: false, id: spawned.id, isBoss: false, isElite: false } as CombatEntity,
          rewardGranted: false,
        },
      ],
      null,
      stageOverride,
    )
  }

  return { gameManager, player, loot, killBoar }
}

const bagAmount = (manager: GameManager) =>
  manager.materialBag.getAmount(TINH_HOA_PHAM_THE_MATERIAL_ID)

const tierProgress = (player: PlayerData) =>
  player.bodyProgression.body_refinement.currentTierProgress

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Luyen The growth chain', () => {
  it('kill at realmLevel 1: essence lands in the bag', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // every guaranteed roll hits
    const { gameManager, player, killBoar } = harness()

    killBoar(MORTAL_STAGE)

    expect(bagAmount(gameManager)).toBeGreaterThan(0)
    expect(player.realmLevel).toBe(1)
  })

  it('tick invest at realmLevel 1: gated - essence stays, nothing converts, lock hint fires once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { gameManager, player, killBoar } = harness()

    killBoar(MORTAL_STAGE)
    const before = bagAmount(gameManager)

    gameManager.tickOps.update(0.1)

    expect(bagAmount(gameManager)).toBe(before)
    expect(tierProgress(player)).toBe(0)

    const events = gameManager.drainNotifications()
    expect(
      events.some((event) => event.messageKey === 'notifications.bodyRefinementInvested'),
    ).toBe(false)

    const locked = events.find(
      (event) => event.messageKey === 'notifications.bodyRefinementTierLocked',
    )
    expect(locked).toBeDefined()
    expect(locked?.kind).toBe('warning')
    expect(locked?.messageParams).toMatchObject({
      tier: 'Luyện Bì',
      level: '2',
      stored: String(before),
    })

    // Once per tier per session - the hint must not re-fire every tick.
    gameManager.tickOps.update(0.1)
    expect(
      gameManager
        .drainNotifications()
        .some((event) => event.messageKey === 'notifications.bodyRefinementTierLocked'),
    ).toBe(false)
  })

  it('tick invest at realmLevel 2: essence converts into tier progress and toasts the growth', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { gameManager, player, killBoar } = harness()

    player.realmLevel = 2
    killBoar(MORTAL_STAGE)
    const landed = bagAmount(gameManager)

    gameManager.tickOps.update(0.1)

    expect(bagAmount(gameManager)).toBe(0)
    expect(tierProgress(player)).toBe(landed)

    const growth = gameManager
      .drainNotifications()
      .find((event) => event.messageKey === 'notifications.bodyRefinementInvested')
    expect(growth).toBeDefined()
    expect(growth?.kind).toBe('upgrade')
    expect(growth?.messageParams).toMatchObject({
      amount: String(landed),
      tier: 'Luyện Bì',
      progress: String(landed),
      cap: '50',
    })
  })

  it('filling a tier: emits the completion toast instead of the progress toast', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { gameManager, player } = harness()

    player.realmLevel = 2
    gameManager.materialBag.add(ESSENCE, 50)

    gameManager.tickOps.update(0.1)

    const events = gameManager.drainNotifications()
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)

    const complete = events.find(
      (event) => event.messageKey === 'notifications.bodyRefinementTierComplete',
    )
    expect(complete).toBeDefined()
    expect(complete?.kind).toBe('upgrade')
    expect(complete?.messageParams).toMatchObject({ tier: 'Luyện Bì' })
    expect(
      events.some((event) => event.messageKey === 'notifications.bodyRefinementInvested'),
    ).toBe(false)
  })

  it('auto-farm pace: every drained drop reports exactly one growth toast', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { gameManager, player, killBoar } = harness()

    player.realmLevel = 2
    for (let index = 0; index < 20; index++) {
      killBoar(MORTAL_STAGE)
      gameManager.tickOps.update(0.1)
    }

    const growth = gameManager
      .drainNotifications()
      .filter((event) => event.messageKey === 'notifications.bodyRefinementInvested')
    expect(growth).toHaveLength(20)
    expect(growth.every((event) => event.kind === 'upgrade')).toBe(true)
    expect(tierProgress(player)).toBe(20)
    expect(bagAmount(gameManager)).toBe(0)
  })
})
