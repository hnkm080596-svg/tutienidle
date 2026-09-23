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
import { createLootTestSetup } from '../../core/game/battleLootTestSetup'

// Companion gacha Task 6 - Chieu Hien Lenh token economy. P7-M9
// (decision D4): the Companion domain begins at Tru Co, so the ONLY
// drop source left is the foundation floor-10 boss; Mortal/Luyen Khi
// enemies and the daily quest must not produce the token below Tru Co.
// M-F-COMPANION-GIFT: with the Beta pull pool closed, every recurring
// source is ALSO suppressed at origination (quest unlock + claim item
// filter + loot delivery) - authored data stays, tokens never land.
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

  // M-F-COMPANION-GIFT: resolveDrops still yields the authored line (rng
  // and drop tables untouched) - the RELEASE-POLICY suppression lives at
  // delivery, so the boss kill can never bank a token while the pool is
  // closed. Banked tokens from before are untouched either way.
  it('the floor-10 boss token line never lands while the pull pool is closed', () => {
    const whelp = ENEMIES.find(
      (entry) => entry.id === 'foundation_ferocious_flood_dragon_whelp',
    )!

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: whelp.realmId,
      signatureDrops: whelp.signatureDrops,
      materialIds: [COMPANION_PULL_TOKEN_ID],
    })

    killEnemy()

    expect(materialBag.getAmount(COMPANION_PULL_TOKEN_ID)).toBe(0)
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
    // restored from a pre-gate save) and already has progress. Seed via
    // ensureActive - reconcile no longer activates this quest while the
    // pull pool is closed (token-only faucet), so it cannot seed here.
    manager.ensureActive(QUESTS.find((q) => q.id === 'daily_chieu_hien_lenh')!)
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

  // M-F-COMPANION-GIFT: the quest is token-only on base (its entire
  // reward set is pull-token itemDrops), so questIsTokenOnlySource
  // suppresses the WHOLE quest while the pull pool is closed - it never
  // activates at Tru Co at all. Non-token rewards are unaffected
  // because there are none; the mixed-reward case is covered in
  // ReleasePolicy.test.ts.
  it('never activates at Truc Co while the pull pool is closed (token-only faucet)', () => {
    const { registry, manager, system, bags } = setup()
    const player = { realmId: 'foundation_establishment' } as unknown as PlayerData

    system.reconcileActiveQuests(registry, manager, player)

    for (let index = 0; index < 20; index++) {
      system.onEnemyDefeated(registry, manager, 'wild_wolf', undefined)
    }

    expect(manager.getProgress('daily_chieu_hien_lenh')).toBeUndefined()
    expect(system.canClaim(registry, manager, bags, 'daily_chieu_hien_lenh')).toBe(false)
  })

  it('reconciles away stale Truc Co progress while the pool is closed (grandfathered save)', () => {
    const { registry, manager, system, bags } = setup()
    const player = { realmId: 'foundation_establishment' } as unknown as PlayerData

    // Grandfathered state: a save from before the suppression carried an
    // active daily with progress. Reconcile removes it - the quest no
    // longer counts as unlocked under the closed pool.
    manager.ensureActive(QUESTS.find((q) => q.id === 'daily_chieu_hien_lenh')!)
    manager.incrementProgress('daily_chieu_hien_lenh', 7)
    expect(manager.getProgress('daily_chieu_hien_lenh')?.progress).toBe(7)

    system.reconcileActiveQuests(registry, manager, player)

    expect(manager.getProgress('daily_chieu_hien_lenh')).toBeUndefined()
    expect(system.canClaim(registry, manager, bags, 'daily_chieu_hien_lenh')).toBe(false)
  })
})
