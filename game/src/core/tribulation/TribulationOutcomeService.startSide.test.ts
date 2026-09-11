/**
 * R8.2 Slice 3 — tribulation START-side prep becomes domain-owned.
 *
 * RED phase: the admitted-start callback in useTribulation.ts still
 * sequences unequip-all + modifier sync + startTribulation from Vue
 * (the only player-commanding writes left in the adapter). This test
 * pins the behavior through the new domain entry point FIRST (A12).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'
import { createBaseStats } from '../stats/StatBlock'
import { pills } from '../../data/pill/pills'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { PROFESSION_GRADE_BY_REALM } from '../profession/ProfessionGrade'

describe('TribulationOutcomeService — start-side prep parity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('startTribulationPrepared: unequip-all + modifier sync BEFORE the session opens', () => {
    const gameManager = new GameManager()
    gameManager.registerPills(pills)
    const player = usePlayerStore()

    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    const weapon = makeInstance({
      instanceId: 'slice3-weapon',
      slot: 'weapon',
      grade: PROFESSION_GRADE_BY_REALM.qi_refining,
      equipped: true,
    })
    gameManager.equipmentBag.add(weapon)
    gameManager.equipmentSystem.refreshModifiers(
      gameManager.equipmentBag,
      gameManager.equipmentSlotManager,
      gameManager.affixRegistry,
    )
    player.setEquipmentModifiers(gameManager.getEquipmentModifiers())
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(true)

    const service = new TribulationOutcomeService()
    const stats = { ...createBaseStats(), maxHp: 500_000, defense: 10_000 }
    const started = service.startTribulationPrepared(
      player,
      gameManager,
      'foundation_establishment',
      stats,
    )

    expect(started).toBe(true)
    expect(weapon.equipped).toBe(false)
    expect(gameManager.equipmentBag.getEquipped()).toHaveLength(0)
    // Modifier sync happened at START time (before any outcome exists).
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(false)
    expect(gameManager.getActiveTribulation()).not.toBeNull()
  })

  it('startTribulationPrepared fails cleanly when the domain refuses (unknown realm, no state change)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    // Unknown target realm -> getTribulationChapters returns undefined.

    const service = new TribulationOutcomeService()
    const stats = { ...createBaseStats(), maxHp: 500_000 }
    const started = service.startTribulationPrepared(
      player,
      gameManager,
      'no_such_realm_id',
      stats,
    )

    expect(started).toBe(false)
    expect(gameManager.getActiveTribulation()).toBeNull()
  })
})
