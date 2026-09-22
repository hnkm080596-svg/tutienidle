import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { materials as MATERIALS } from '../materials/materials'
import { QUESTS } from '../quest/quests'
import { resolveDrops } from '../../core/drop/resolveDrops'
import { modifiersFor } from '../../core/drop/DropContext'
import { COMPANION_PULL_TOKEN_ID } from '../../core/game/GameManagerCompanionOps'
import { getRealmIndex } from '../../core/realm/realmSystem'
import { COMPANION_UNLOCK_REALM_ID } from '../../core/companion/CompanionAvailability'
import { QuestRegistry } from '../../core/quest/QuestRegistry'
import { QuestManager } from '../../core/quest/QuestManager'
import { QuestSystem } from '../../core/quest/QuestSystem'
import { MaterialRegistry } from '../../core/material/MaterialRegistry'
import { MaterialBag } from '../../core/material/MaterialBag'
import { PillRegistry } from '../../core/pill/PillRegistry'
import { PillBag } from '../../core/pill/PillBag'
import { RewardSystem } from '../../core/reward/RewardSystem'
import type { RewardReceiver } from '../../core/reward/RewardSystem'
import type { PlayerData } from '../../core/player/Player'

// Companion gacha Task 6 - Chieu Hien Lenh token economy. P7-M9
// (decision D4): the Companion domain begins at Tru Co, so the ONLY
// drop source left is the foundation floor-10 boss; Mortal/Luyen Khi
// enemies and the daily quest must not produce the token below Tru Co.
const BOSS_TOKEN_AMOUNTS: Readonly<Record<string, number>> = {
  foundation_ferocious_flood_dragon_whelp: 3,
}

function tokenDropOf(enemyId: string) {
  const enemy = ENEMIES.find((entry) => entry.id === enemyId)
  expect(enemy).toBeDefined()

  return enemy!.signatureDrops?.find((drop) => drop.itemId === COMPANION_PULL_TOKEN_ID)
}

describe('Chieu Hien Lenh material (companion-gacha Task 6)', () => {
  it('is registered in MATERIALS with the gacha-token shape', () => {
    const token = MATERIALS.find((material) => material.id === COMPANION_PULL_TOKEN_ID)

    expect(token).toMatchObject({
      name: 'Chiêu Hiền Lệnh',
      category: 'other',
      sourceType: 'boss',
      stackLimit: 999,
    })
  })
})

describe('Chieu Hien Lenh boss signatureDrops', () => {
  it.each(Object.entries(BOSS_TOKEN_AMOUNTS))(
    '%s declares a boss-gated token line of amount %i',
    (enemyId, amount) => {
      const drop = tokenDropOf(enemyId)

      expect(drop).toBeDefined()
      expect(drop!.kind).toBe('material')
      expect(drop!.chance).toBe(1)
      expect(drop!.amount).toEqual({ min: amount, max: amount })
      expect(drop!.requiresModifier).toBe('boss')
    },
  )

  it.each(Object.entries(BOSS_TOKEN_AMOUNTS))(
    'resolveDrops on %s with boss modifier yields %i token(s)',
    (enemyId, amount) => {
      const enemy = ENEMIES.find((entry) => entry.id === enemyId)!

      // Same modifier path as BattleLootSystem: DropContext.modifiersFor
      // maps the boss stage property to BOSS_MODIFIER.
      const result = resolveDrops({
        modifiers: modifiersFor({ channel: 'active', isBoss: true, isElite: false }),
        channel: 'active',
        signatureDrops: enemy.signatureDrops,
        rng: () => 0,
      })

      const token = result.items.find((item) => item.itemId === COMPANION_PULL_TOKEN_ID)
      expect(token).toBeDefined()
      expect(token!.amount).toBe(amount)
    },
  )

  it('resolveDrops without the boss modifier skips the token line', () => {
    for (const enemyId of Object.keys(BOSS_TOKEN_AMOUNTS)) {
      const enemy = ENEMIES.find((entry) => entry.id === enemyId)!

      const result = resolveDrops({
        modifiers: modifiersFor({ channel: 'active', isBoss: false, isElite: false }),
        channel: 'active',
        signatureDrops: enemy.signatureDrops,
        rng: () => 0,
      })

      expect(result.items.some((item) => item.itemId === COMPANION_PULL_TOKEN_ID)).toBe(false)
    }
  })

  it('idle channel still yields the token (chance:1 survives the E11 gate)', () => {
    const whelp = ENEMIES.find((entry) => entry.id === 'foundation_ferocious_flood_dragon_whelp')!

    const result = resolveDrops({
      modifiers: modifiersFor({ channel: 'idle', isBoss: true, isElite: false }),
      channel: 'idle',
      signatureDrops: whelp.signatureDrops,
      rng: () => 0,
    })

    const token = result.items.find((item) => item.itemId === COMPANION_PULL_TOKEN_ID)
    expect(token).toBeDefined()
    expect(token!.amount).toBe(3)
  })
})

// D4 hard rule: Mortal stages -> NO Companion-specific drops; Luyen Khi
// stages -> NO Companion-specific drops. Asserted at the data level so a
// re-added line fails here instead of leaking tokens into early realms.
describe('Chieu Hien Lenh realm restriction', () => {
  it('no mortal or qi_refining enemy drops the token', () => {
    const offenders = ENEMIES.filter(
      (enemy) =>
        (enemy.realmId === 'mortal' || enemy.realmId === 'qi_refining') &&
        enemy.signatureDrops?.some((drop) => drop.itemId === COMPANION_PULL_TOKEN_ID),
    )

    expect(offenders.map((enemy) => enemy.id)).toEqual([])
  })

  it('no quest below Tru Co rewards the token', () => {
    const offenders = QUESTS.filter(
      (quest) =>
        quest.reward.itemDrops?.some((drop) => drop.itemId === COMPANION_PULL_TOKEN_ID) &&
        (!quest.requiredRealmId ||
          getRealmIndex(quest.requiredRealmId) < getRealmIndex(COMPANION_UNLOCK_REALM_ID)),
    )

    expect(offenders.map((quest) => quest.id)).toEqual([])
  })
})

describe('daily_chieu_hien_lenh quest', () => {
  function setup() {
    const registry = new QuestRegistry()
    for (const quest of QUESTS) {
      registry.register(quest)
    }

    const manager = new QuestManager()
    const system = new QuestSystem()

    const materialRegistry = new MaterialRegistry()
    for (const material of MATERIALS) {
      materialRegistry.register(material)
    }
    const materialBag = new MaterialBag()

    const pillRegistry = new PillRegistry()
    const pillBag = new PillBag()

    const bags = { materialRegistry, materialBag, pillRegistry, pillBag }
    const rewardSystem = new RewardSystem()
    const receiver: RewardReceiver & { spiritStone: number } = {
      spiritStone: 0,
      addSkillInsight() {},
      addCultivation() {},
      addSpiritStone(amount) {
        this.spiritStone += amount
      },
    }

    return { registry, manager, system, bags, rewardSystem, receiver, materialBag }
  }

  it('exists in QUESTS as a kill-generic daily paying 1 token, gated to Tru Co', () => {
    const quest = QUESTS.find((entry) => entry.id === 'daily_chieu_hien_lenh')

    expect(quest).toBeDefined()
    expect(quest!.cadence).toBe('daily')
    expect(quest!.condition).toEqual({ kind: 'kill', amount: 20 })
    expect(quest!.reward.itemDrops).toEqual([
      { kind: 'material', itemId: COMPANION_PULL_TOKEN_ID, amount: 1 },
    ])
    expect(quest!.requiredRealmId).toBe('foundation_establishment')
  })

  it('never activates below Tru Co', () => {
    const { registry, manager, system, bags } = setup()
    const player = { realmId: 'qi_refining' } as unknown as PlayerData

    system.reconcileActiveQuests(registry, manager, player)

    for (let index = 0; index < 20; index++) {
      system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    }

    expect(system.canClaim(registry, manager, bags, 'daily_chieu_hien_lenh')).toBe(false)
  })

  it('drops stale active progress on reconcile below Tru Co (grandfathered save)', () => {
    const { registry, manager, system, bags } = setup()
    const player = { realmId: 'foundation_establishment' } as unknown as PlayerData

    // Grandfathered state: the daily was activated while eligible (or
    // restored from a pre-gate save) and already has progress.
    system.reconcileActiveQuests(registry, manager, player)
    manager.incrementProgress('daily_chieu_hien_lenh', 7)
    expect(manager.getProgress('daily_chieu_hien_lenh')?.progress).toBe(7)

    // Realm gate now fails (save predates Truc Co / content moved) -
    // reconcile removes the stale entry instead of letting it count.
    player.realmId = 'qi_refining'
    system.reconcileActiveQuests(registry, manager, player)

    expect(manager.getProgress('daily_chieu_hien_lenh')).toBeUndefined()

    for (let index = 0; index < 20; index++) {
      system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    }

    expect(manager.getProgress('daily_chieu_hien_lenh')).toBeUndefined()
    expect(system.canClaim(registry, manager, bags, 'daily_chieu_hien_lenh')).toBe(false)
  })

  it('claims itemDrops into materialBag via the normal claim path at Tru Co', () => {
    const { registry, manager, system, bags, rewardSystem, receiver, materialBag } = setup()
    const player = { realmId: 'foundation_establishment' } as unknown as PlayerData

    system.reconcileActiveQuests(registry, manager, player)

    // Kill-generic condition: any enemy id advances the counter.
    for (let index = 0; index < 20; index++) {
      system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    }

    expect(system.canClaim(registry, manager, bags, 'daily_chieu_hien_lenh')).toBe(true)
    expect(system.claim(registry, manager, rewardSystem, receiver, bags, 'daily_chieu_hien_lenh')).toBe(true)
    expect(materialBag.getAmount(COMPANION_PULL_TOKEN_ID)).toBe(1)
  })
})
