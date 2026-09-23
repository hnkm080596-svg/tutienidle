// M-F-BODY-HIDDEN (spec sec.4/6, plan Step 1.5) - the canonical
// delivery seam end-to-end through the REAL GameManager tick path:
// grotto hidden-channel emission -> pendingEvents ->
// drainSettlementEvents -> questOps.notifyMaterialGained ->
// questSystem.onMaterialCollected + recordBodyPerfectionMaterialDiscovery.
//
// The shipped channel registry and the perfection-material table are
// intentionally empty, so the fixture channel is injected into the live
// ProductionSystem deps (same test-only mutation convention as the
// COMPANIONS catalog fixtures). The canonical perfection table is a
// closed module-load registry (REALM_BY_MATERIAL is built at import
// time), so the lookup seam the REAL writer consults -
// isBodyPerfectionMaterial in the data module - is injected here to
// also recognize the fixture id (r97-MEDIUM): the real
// recordBodyPerfectionMaterialDiscovery then writes the discovery
// marker itself, so the test proves pendingEvents -> funnel -> real
// write-once discovery, not merely that the writer was invoked.
import { afterEach, describe, expect, it, vi } from 'vitest'

const FIXTURE_PERFECTION_ID = 'bp_gm_fixture_material'

vi.mock('../../data/realm/BodyPerfection', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../data/realm/BodyPerfection')>()

  return {
    ...original,
    isBodyPerfectionMaterial: vi.fn(
      (materialId: string): boolean =>
        materialId === FIXTURE_PERFECTION_ID ||
        original.isBodyPerfectionMaterial(materialId),
    ),
  }
})

import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { GrottoChannel } from '../../data/drop/HiddenMaterialChannels'
import { hiddenBeastChannels } from '../../data/drop/HiddenMaterialChannels'
import { isBodyPerfectionMaterial } from '../../data/realm/BodyPerfection'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { FunctionCombatRng } from '../battle/runtime/rng/FunctionCombatRng'
import { HiddenBeastSystem } from './HiddenBeastSystem'
import { StageWaveSystem } from './StageWaveSystem'
import { defineEnemy } from '../enemy/Enemy'
import { HIDDEN_BEASTS } from '../../data/enemy/HiddenBeasts'
import { materials } from '../../data/materials/materials'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'

const GROTTO = 'thanh_van_dong_thien'
const MATERIAL_ID = FIXTURE_PERFECTION_ID

function injectGrottoChannel(manager: GameManager, channel: GrottoChannel): void {
  ;(
    manager.productionSystem as unknown as {
      deps: { hiddenGrottoChannels: GrottoChannel[] }
    }
  ).deps.hiddenGrottoChannels = [channel]
}

function restoreDueGrottoCycle(manager: GameManager, rollSeed: number): void {
  manager.productionSystem.restoreStates([
    {
      siteId: GROTTO,
      level: 1,
      autoRestart: false,
      activeWorkerSlots: 0,
      workerCycles: [
        {
          cycleId: `gm_cycle_${rollSeed}`,
          siteId: GROTTO,
          collectionRealmId: 'mortal',
          siteLevelAtStart: 1,
          rewardTableVersion: 1,
          rollSeed,
          startedAtMs: 0,
          completesAtMs: Date.now() - 1,
        },
      ],
    },
  ])
}

describe('GameManager - hidden-channel material delivery seam (m-f-body-hidden Step 1.5)', () => {
  afterEach(() => {
    vi.mocked(isBodyPerfectionMaterial).mockClear()
  })

  it('settle emits -> drain -> notifyMaterialGained -> real writer adds the discovery marker once', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)

    // Fixture material in the material registry (so the bag accepts
    // it). Not breakthrough-tagged -> acquisition gate open.
    manager.materialRegistry.register({
      id: MATERIAL_ID,
      name: MATERIAL_ID,
      category: 'other',
      sourceType: 'exploration',
    })

    injectGrottoChannel(manager, {
      kind: 'grotto',
      id: 'gm_fixture_channel',
      bandRealmId: 'mortal',
      materialId: MATERIAL_ID,
      chancePerCycle: 1,
    })

    const funnelSpy = vi.spyOn(manager.questOps, 'notifyMaterialGained')
    const lookupSpy = vi.mocked(isBodyPerfectionMaterial)

    // First settle: the channel emits, the funnel fires with the
    // delivered amount, and the REAL writer records the discovery
    // marker (the injected lookup seam recognizes the fixture id).
    restoreDueGrottoCycle(manager, 1)
    manager.tickOps.update(1)

    expect(
      funnelSpy.mock.calls.some(([materialId, amount]) => materialId === MATERIAL_ID && amount === 1),
    ).toBe(true)
    expect(
      lookupSpy.mock.calls.filter(([materialId]) => materialId === MATERIAL_ID).length,
    ).toBeGreaterThan(0)
    expect(player.bodyPerfection.discoveredMaterials).toEqual([MATERIAL_ID])
    expect(
      manager.materialBag.getAll().find((stack) => stack.material.id === MATERIAL_ID)?.amount,
    ).toBe(1)

    // Second settle: a normal re-grant - the real write-once contract
    // dedupes the marker while the bag still takes the delivery.
    restoreDueGrottoCycle(manager, 2)
    manager.tickOps.update(1)

    expect(player.bodyPerfection.discoveredMaterials).toEqual([MATERIAL_ID])
    expect(
      manager.materialBag.getAll().find((stack) => stack.material.id === MATERIAL_ID)?.amount,
    ).toBe(2)
  })
})

const FRAGILE = defineEnemy({
  id: 'p13_fragile_mob', name: 'P13 Fragile', level: 1, realmId: 'qi_refining', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

describe('P13 runtime - real stage loop: substituted spawn -> kill -> signature drop (m-f-body-hidden)', () => {
  it('primed shipped window: real pick substitutes huyet_mong; real kill lands the signature drop and resets the channel', () => {
    const manager = new GameManager()
    const combatSource = new ManualClockSource()
    manager.setCombatClockSource(combatSource)

    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.baseStats = asBaseStats({ ...player.baseStats, might: 999999, maxHp: 999999, speed: 9999 })
    manager.setActivePlayer(player)

    // Real catalogs: huyet_mong resolves through ENEMIES via the shared
    // registry; the signature material resolves through MATERIALS.
    manager.catalogOps.registerEnemyTemplates([...HIDDEN_BEASTS, FRAGILE])
    manager.catalogOps.registerMaterials(materials)

    // Deterministic setup ONLY: prime the shipped channel's window and
    // pin the combat stream so the 5% substitution roll always wins.
    const channel = hiddenBeastChannels()[0]!
    player.hiddenBeastKills[channel.id] = channel.killThreshold
    manager.setBattleRngFactory(() => new FunctionCombatRng(() => 0))

    const lqStage: Stage = {
      id: 'p13_lq_stage', name: 'P13 LQ Stage', description: '',
      floor: 1, requiredRealmId: 'qi_refining',
      enemyPool: [{ enemyId: FRAGILE.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1],
      spawnIntervalSeconds: 0,
    }
    manager.catalogOps.registerStages([lqStage])
    expect(manager.turnBattleOps.startStage(player, lqStage, false)).toBe(true)

    const beastSpawned = () =>
      manager.getTurnBattle()?.enemies.some((entry) => entry.entity.templateId === 'huyet_mong')
    for (let i = 0; i < 2000 && !beastSpawned(); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }
    expect(beastSpawned()).toBe(true)

    // Ride the real battle until the beast dies: real onEnemyDefeated
    // resets the channel counter and real resolveDrops lands the
    // guaranteed signature line (tinh_hoa_pham_the, chance:1, x12).
    const dropLanded = () =>
      manager.materialBag.getAll().some((stack) => stack.material.id === 'tinh_hoa_pham_the')
    for (let i = 0; i < 2000 && !dropLanded(); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const stack = manager.materialBag
      .getAll()
      .find((entry) => entry.material.id === 'tinh_hoa_pham_the')
    expect(stack?.amount).toBe(12)
    expect(player.hiddenBeastKills[channel.id]).toBe(0)
  })
})

describe('idle-path invariants (r97-LOW): auto-farm kills count, idle picks never substitute', () => {
  it('armed auto-farm cycles advance the channel counter through the real idle path with no substitution', () => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    manager.setActivePlayer(player)

    manager.catalogOps.registerEnemyTemplates([...HIDDEN_BEASTS, FRAGILE])
    manager.catalogOps.registerMaterials(materials)

    const channel = hiddenBeastChannels()[0]!

    const idleStage: Stage = {
      id: 'idle_lq_stage', name: 'Idle LQ', description: '',
      floor: 1, requiredRealmId: 'qi_refining',
      enemyPool: [{ enemyId: FRAGILE.id, weight: 1 }],
      totalEnemyCount: 2, waves: [2],
      spawnIntervalSeconds: 0,
    }
    manager.catalogOps.registerStages([idleStage])

    // Arm the farm: perfect-clear metadata + a valid cycle time are the
    // shared eligibility contract of startAutoFarm.
    player.perfectClearStageIds.push(idleStage.id)
    player.perfectClearSeconds[idleStage.id] = 2 // cycleMs = 1000

    // Window OPEN and the combat stream pinned: if the idle pick path
    // ever reached substitution, a substituted huyet_mong kill would
    // RESET this counter instead of advancing it.
    player.hiddenBeastKills[channel.id] = channel.killThreshold
    manager.setBattleRngFactory(() => new FunctionCombatRng(() => 0))

    expect(manager.turnBattleOps.autoFarmOps.startAutoFarm(player, idleStage.id)).toBe(true)

    const replaceSpy = vi.spyOn(HiddenBeastSystem.prototype, 'maybeReplaceSpawn')
    const pickSpy = vi.spyOn(StageWaveSystem.prototype, 'pickEnemyForTurnSpawn')

    // Two completed wall-clock cycles through the real tick path: each
    // cycle picks then kills 2 banded FRAGILEs via processDefeatedEnemies.
    player.autoFarmStage!.lastCheckedMs = Date.now() - 2000
    manager.turnBattleOps.autoFarmOps.tickAutoFarm(player)

    // (a) idle/auto-farm kills count: 2 cycles x 2 enemies = 4 banded
    // non-beast kills advance the channel counter (no reset - no
    // substituted beast was ever killed).
    expect(pickSpy).toHaveBeenCalled()
    expect(player.hiddenBeastKills[channel.id]).toBe(channel.killThreshold + 4)
    // (b) the idle spawn path never invokes hidden-beast substitution,
    // even with the window open and a pinned winning roll.
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})
