import { vi } from 'vitest'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Enemy, EnemyReward } from '../enemy/Enemy'
import type { SignatureDrop } from '../drop/DropTable'
import type { Stage } from '../stage/Stage'
import type { RewardReceiver } from '../reward/RewardSystem'
import {
  BattleLootSystem,
  type BattleLootSystemDeps,
  type RewardPendingEnemy,
} from './BattleLootSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import type { EquipmentInstance } from '../equipment/EquipmentInstance'
import type { EquipmentSystem } from '../equipment/EquipmentSystem'
import { createDefaultPlayer } from '../player/Player'

// Shared fixture for the BattleLootSystem test files (drop-system Task 8,
// 2026-09-12). Previously each test file copied its own createTestSetup;
// the drop rework made stage wiring mandatory (resolveDrops reads the
// stage table through stageManager + stageTemplates), so the fixture is
// extracted once here instead of being duplicated a fourth time.

export function createDeadEnemy(
  id: string,
  entity: Partial<CombatEntity> = {},
): RewardPendingEnemy {
  return {
    entity: { alive: false, id, isBoss: false, isElite: false, ...entity } as CombatEntity,
    rewardGranted: false,
  }
}

// F3 (2026-09-13): the old createBattle() helper is gone - the reward
// input is the entries array itself plus an explicit heal target, so
// tests pass those directly instead of fabricating a Battle.

export interface LootTestStage {
  stageId: string
  requiredRealmId: string
  floor?: number
}

export const TEST_EQUIPMENT_TEMPLATE = { id: 'eq_test', name: 'Kiếm Test' }

export const TEST_EQUIPMENT_INSTANCE = {
  instanceId: 'test-drop-instance',
  grade: 'bat_pham',
  quality: 'huyen',
  zoneId: undefined,
  icon: undefined,
}

export interface LootTestSetupOptions {
  /** Enemy realm — drives getRealmRewardMultiplier + artifact EXP. */
  realmId?: string
  /** Still consumed by getArtifactExperienceReward; currency no longer read. */
  rewards?: EnemyReward
  family?: string
  signatureDrops?: SignatureDrop[]
  talentIds?: string[]
  /** Active stage — decides the stage drop table. Omit for no stage. */
  stage?: LootTestStage
  /** Material ids registered into a real MaterialRegistry. */
  materialIds?: string[]
  /** Tagged material records (M-F-ARTIFACT-DEFER) - carries
   *  domainUnlockRealmId/breakthroughRealmId explicitly so the
   *  fabricated registry matches the authored tag. */
  materialTemplates?: {
    id: string
    name?: string
    domainUnlockRealmId?: string
    breakthroughRealmId?: string
  }[]
  equipmentTemplates?: { id: string; name: string }[]
  pillTemplates?: { id: string; name: string; grade: string; icon?: string; breakthroughRealmId?: string }[]
}

export function createLootTestSetup(options: LootTestSetupOptions = {}) {
  const materialRegistry = new MaterialRegistry()
  for (const id of options.materialIds ?? []) {
    materialRegistry.register({
      id,
      name: id,
      category: 'other',
      sourceType: 'monster',
      description: 'test fixture',
    })
  }
  for (const template of options.materialTemplates ?? []) {
    materialRegistry.register({
      id: template.id,
      name: template.name ?? template.id,
      category: 'other',
      sourceType: 'monster',
      description: 'test fixture',
      domainUnlockRealmId: template.domainUnlockRealmId,
      breakthroughRealmId: template.breakthroughRealmId,
    })
  }
  const materialBag = new MaterialBag()

  const equipmentTemplates = options.equipmentTemplates ?? []
  const pillTemplates = options.pillTemplates ?? []

  // EquipmentBag.add() returns AutoDissolveReward[] (soft-cap audit
  // 2026-08-31) — the mock must return an array to match the real contract.
  const equipmentBag = { add: vi.fn().mockReturnValue([]) }
  const pillBag = { add: vi.fn().mockReturnValue(0) }
  const giveReward = vi.fn()
  const eventBus = { emit: vi.fn() }
  const notifications = { push: vi.fn(), drain: () => [] }
  // Typed to the real signature so tests can read mock.calls[n][4]
  // (qualityBonusSteps) — an untyped vi.fn would type calls as [].
  const createInstance = vi.fn<EquipmentSystem['createInstance']>(
    () => TEST_EQUIPMENT_INSTANCE as EquipmentInstance,
  )
  // P7-M3 + M-F-TECHNIQUE - the pending-mastery flush consumes through
  // gainMastery(amount, realmId, realmLevel); default the mock to
  // "consumed everything" so summaries read honest.
  const gainMastery = vi.fn((_amount: number, _realmId?: string, _realmLevel?: number) => ({ gained: _amount, rankUps: 0 }))
  // Heal-on-kill talents are retired (v4 catalog) so the stub never heals;
  // it also must NOT write currentHp directly — this helper is a non-test
  // file and the R14 vitalsWriteAuthority guard scans it as production code.
  const applyHealing = vi.fn(() => 0)

  const enemy = {
    id: 'mob',
    realmId: options.realmId ?? 'mortal',
    family: options.family,
    signatureDrops: options.signatureDrops,
    rewards: options.rewards ?? { techniqueMastery: 0, spiritStone: 0 },
  } as unknown as Enemy

  const stage = options.stage

  const deps: BattleLootSystemDeps = {
    eventBus,
    notifications,
    combatSystem: { applyHealing },
    materialRegistry,
    materialBag,
    pillRegistry: {
      has: (id: string) => pillTemplates.some((pill) => pill.id === id),
      get: (id: string) => pillTemplates.find((pill) => pill.id === id),
    },
    pillBag,
    equipmentRegistry: {
      has: (id: string) => equipmentTemplates.some((template) => template.id === id),
      get: (id: string) => equipmentTemplates.find((template) => template.id === id),
      getAll: () => equipmentTemplates,
    },
    equipmentBag,
    equipmentSystem: { createInstance },
    affixRegistry: {},
    zoneRegistry: { has: () => false, getZoneForStage: () => undefined },
    techniqueSystem: { gainMastery },
    enemySystem: {
      get: () => enemy,
      despawn: vi.fn(),
    },
    rewardSystem: { give: giveReward },
    stageManager: { getActive: () => (stage ? { stageId: stage.stageId } : undefined) },
    stageTemplates: {
      get: (stageId: string) =>
        stage && stageId === stage.stageId ? (stage as unknown as Stage) : undefined,
    },
    questSystem: { onEnemyDefeated: vi.fn(), onMaterialCollected: vi.fn() },
    questRegistry: {},
    questManager: {},
    notifyMaterialGained: vi.fn(),
    hiddenBeast: { onEnemyDefeated: vi.fn() },
  } as unknown as BattleLootSystemDeps

  const loot = new BattleLootSystem(deps)
  const player = createDefaultPlayer()
  player.selectedTalentIds = options.talentIds ?? []

  loot.setSession({} as RewardReceiver, player)

  const killEnemy = (entity: Partial<CombatEntity> = {}, id = 'mob') =>
    loot.processDefeatedEnemies([createDeadEnemy(id, entity)], null)

  return {
    loot,
    deps,
    player,
    materialRegistry,
    materialBag,
    equipmentBag,
    pillBag,
    giveReward,
    applyHealing,
    eventBus,
    notifications,
    createInstance,
    gainMastery,
    killEnemy,
  }
}
