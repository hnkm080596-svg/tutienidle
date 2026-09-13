/**
 * Headless experiment harness for TutienIdle (tests/lab).
 *
 * One createLab() call gives a fully wired GameManager running in plain
 * node - no DOM, no Phaser, no raf. Time moves only when you say so:
 *
 *   lab.tick(seconds)    world tick in <=1s slices (production, quests,
 *                        timed systems - mirrors App.vue's tick cadence)
 *   lab.combat(seconds)  combat clock (ATB gauges, turn resolution)
 *   lab.startStage()     deterministic 1-dummy stage via the shared fixture
 *   lab.stats()          player finalStats via the real StatCalculator
 *   lab.snapshot()       readable state dump for console.log / debugging
 *   lab.cheat.*          cheats that still go through the real owners
 *                        (bags, registries, stat pipeline) - no private
 *                        state pokes, so experiments stay honest.
 *
 * lab.useRealData() registers the same catalogs App.vue boots with
 * (tests/lab/realData.ts mirrors that block) so cheat.addMaterial /
 * addEquipment / addPill work against real content. Without it the lab
 * stays minimal and deterministic - register only what an experiment
 * needs via lab.manager.catalogOps.
 */
import { GameManager } from '@/core/game/GameManager'
import { ManualClockSource } from '@/core/battle/turn/CombatClock'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { calculateStats } from '@/core/stats/StatCalculator'
import type { Stats } from '@/core/stats/StatBlock'
import { startAStage } from '@/core/game/__fixtures__/startAStage'
import { getSpiritStoneMaterialIdForRealmTier } from '@/core/material/SpiritStoneMaterial'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import type { EquipmentInstance } from '@/core/equipment/EquipmentInstance'
import type { AutoDissolveReward } from '@/core/equipment/EquipmentBag'
import type { TurnBattle } from '@/core/battle/turn/TurnBattleSystem'
import { registerRealCatalogs } from './realData'

const ONE_HIT_ATTACK = 1_000_000_000

export interface MaterialGrant {
  stored: number
  overflow: number
}

export interface EquipmentGrant {
  instance: EquipmentInstance
  dissolved: AutoDissolveReward[]
}

export interface Lab {
  readonly manager: GameManager
  readonly combatClock: ManualClockSource
  /** The currently active player. startStage() may rebind it (the shared
   *  fixture creates its own player and registers it on the manager). */
  readonly player: PlayerData
  /** Currently running turn battle, or null. */
  readonly battle: TurnBattle | null

  /** Advance the world clock in <=1s slices (tickOps.update per second). */
  tick(seconds: number): void
  /** Advance the combat clock (drives ATB/turn resolution). */
  combat(seconds: number): void
  /** Player finalStats through the real StatCalculator. */
  stats(): Stats
  /** Start the deterministic dummy stage; returns (and rebinds) player. */
  startStage(options?: { stageId?: string; repeatContinuously?: boolean }): PlayerData
  /** Register the full real data catalogs (same set App.vue boots with). */
  useRealData(): void
  /** Compact readable dump of the interesting state right now. */
  snapshot(): Record<string, unknown>

  cheat: {
    /** Add a material by id. Returns { stored, overflow } - overflow is
     *  what the stack cap dropped (0 = everything fit). */
    addMaterial(materialId: string, amount: number): MaterialGrant
    /** Spirit stones for the player's CURRENT realm tier. Works without
     *  useRealData() - the harness registers the 3 tier materials itself. */
    addSpiritStones(amount: number): MaterialGrant
    /** Roll a real equipment instance from a registered template into the
     *  bag (grade follows player realm; needs useRealData or manual
     *  registerEquipment + registerAffixes). */
    addEquipment(equipmentId: string, zoneId?: string): EquipmentGrant
    /** Add pills by id (needs useRealData or manual registerPills). */
    addPill(pillId: string, amount: number): MaterialGrant
    /** Patch player.baseStats (applies to the NEXT battle; use the live
     *  patch below for an in-flight one). Returns new finalStats. */
    setBaseStats(patch: Partial<Stats>): Stats
    /** attack = 1e9 through the real damage pipeline - both for the next
     *  startStage and any battle already in flight. */
    oneHitKill(): void
    /** Massive attack + survivability for both pending and live battles. */
    godMode(): void
    setRealm(realmId: string, realmLevel?: number): void
    grantCultivation(amount: number): void
    grantSkillInsight(amount: number): void
  }
}

export function createLab(): Lab {
  const manager = new GameManager()
  const combatClock = new ManualClockSource()
  manager.setCombatClockSource(combatClock)

  let player = createDefaultPlayer()
  manager.setActivePlayer(player)

  // Stat patch remembered across startStage: the shared fixture bakes
  // attack/speed=100 into the spawned entity, so cheats applied before a
  // battle starts must be re-applied to the live entity afterwards.
  let liveStatPatch: Partial<Stats> = {}
  const applyLivePatch = () => {
    const battle = manager.getTurnBattle()
    if (!battle || Object.keys(liveStatPatch).length === 0) return
    for (const participant of battle.players) {
      Object.assign(participant.entity.baseStats, liveStatPatch)
      Object.assign(participant.entity.stats, liveStatPatch)
      if (liveStatPatch.maxHp !== undefined) {
        participant.entity.currentHp = participant.entity.stats.maxHp
        participant.entity.maxHp = participant.entity.stats.maxHp
      }
    }
  }

  const addToBag = (materialId: string, amount: number): MaterialGrant => {
    const material = manager.materialRegistry.get(materialId)
    const overflow = manager.materialBag.add(material, amount)
    return { stored: amount - overflow, overflow }
  }

  const lab: Lab = {
    manager,
    combatClock,
    get player() {
      return player
    },
    get battle() {
      return manager.getTurnBattle() ?? null
    },

    tick(seconds: number) {
      let remaining = seconds
      while (remaining > 0) {
        const dt = Math.min(1, remaining)
        manager.tickOps.update(dt)
        remaining -= dt
      }
    },

    combat(seconds: number) {
      combatClock.advance(seconds)
    },

    stats() {
      return calculateStats(player.baseStats, [...player.modifiers, ...player.externalModifiers])
    },

    startStage(options = {}) {
      player = startAStage(manager, options)
      applyLivePatch()
      return player
    },

    useRealData() {
      registerRealCatalogs(manager)
    },

    snapshot() {
      const battle = manager.getTurnBattle()
      const finalStats = lab.stats()
      return {
        realm: `${player.realmId} lv${player.realmLevel}`,
        cultivation: player.cultivation,
        stats: {
          attack: finalStats.attack,
          maxHp: finalStats.maxHp,
          speed: finalStats.speed,
          defense: finalStats.defense,
        },
        battle: battle
          ? {
              state: battle.state,
              rounds: battle.roundsElapsed ?? 0,
              players: battle.players.map((p) => ({
                id: p.id,
                hp: `${p.entity.currentHp}/${p.entity.maxHp}`,
                alive: p.alive,
                gauge: p.actionGauge,
              })),
              enemies: battle.enemies.map((e) => ({
                id: e.id,
                hp: `${e.entity.currentHp}/${e.entity.maxHp}`,
                alive: e.alive,
              })),
            }
          : null,
        materials: manager.materialBag.getAll().map((s) => `${s.material.id} x${s.amount}`),
        pills: manager.pillBag.getAll().map((s) => `${s.pill.id} x${s.amount}`),
        equipmentCount: manager.equipmentBag.getAll().length,
      }
    },

    cheat: {
      addMaterial: addToBag,

      addSpiritStones(amount: number): MaterialGrant {
        const id = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))
        if (!manager.materialRegistry.has(id)) {
          throw new Error(
            `spirit stone material '${id}' not registered - call lab.useRealData() ` +
              `or register the SPIRIT_STONE_*_MATERIAL constants via catalogOps.registerMaterials()`,
          )
        }
        return addToBag(id, amount)
      },

      addEquipment(equipmentId: string, zoneId?: string): EquipmentGrant {
        const template = manager.equipmentRegistry.get(equipmentId)
        const instance = manager.equipmentSystem.createInstance(
          template,
          player,
          manager.affixRegistry,
          zoneId,
        )
        const dissolved = manager.equipmentBag.add(instance)
        return { instance, dissolved }
      },

      addPill(pillId: string, amount: number): MaterialGrant {
        const pill = manager.pillRegistry.get(pillId)
        const overflow = manager.pillBag.add(pill, amount)
        return { stored: amount - overflow, overflow }
      },

      setBaseStats(patch: Partial<Stats>): Stats {
        Object.assign(player.baseStats, patch)
        return lab.stats()
      },

      oneHitKill(): void {
        player.baseStats.attack = ONE_HIT_ATTACK
        liveStatPatch = { ...liveStatPatch, attack: ONE_HIT_ATTACK }
        applyLivePatch()
      },

      godMode(): void {
        const patch: Partial<Stats> = {
          attack: ONE_HIT_ATTACK,
          maxHp: ONE_HIT_ATTACK,
          defense: ONE_HIT_ATTACK,
          speed: 10_000,
        }
        Object.assign(player.baseStats, patch)
        liveStatPatch = { ...liveStatPatch, ...patch }
        applyLivePatch()
      },

      setRealm(realmId: string, realmLevel = 1): void {
        player.realmId = realmId
        player.realmLevel = realmLevel
      },

      grantCultivation(amount: number): void {
        player.cultivation += amount
        player.totalCultivationGained += amount
      },

      grantSkillInsight(amount: number): void {
        player.skillInsight += amount
        player.totalSkillInsightGained += amount
      },
    },
  }

  return lab
}
