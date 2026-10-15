import { describe, expect, it, vi } from 'vitest'
import { TimeAuthority } from '../idle/TimeAuthority'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { SKILLS } from '../../data/skill/Skills'
import { primeMortalCreationPick } from '../../services/save/GameSave.fixture'
import { buildGameSave } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type { Quest } from '../quest/Quest'
import type { GameSave } from '../../services/save/saveTypes'

const quest: Quest = { id: 'receipt_stones', name: 'Receipt stones', description: '', cadence: 'once',
  condition: { kind: 'collect', materialId: SPIRIT_STONE_MATERIAL_ID, amount: 100 }, reward: {} }
function setup(player: PlayerData = createDefaultPlayer(), time?: TimeAuthority) {
  const manager = new GameManager({ time })
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerQuests([quest])
  primeMortalCreationPick(player, manager.skillManager)
  manager.setActivePlayer(player)
  return { manager, player }
}
function give(manager: GameManager, player: PlayerData, amount: number) {
  const spy = vi.spyOn(manager.materialBag, 'credit')
  manager.rewardOps.giveReward(manager.rewardOps.buildPlayerRewardReceiver(player), { spiritStone: amount })
  const grant = spy.mock.results.at(-1)!.value as ReturnType<GameManager['materialBag']['credit']>
  spy.mockRestore()
  return grant
}

function snapshot(manager: GameManager, player: PlayerData): GameSave {
  return JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
}

describe('real material producer to durable quest receipt chain', () => {
  it('uses the injected runtime clock and deduplicates a real production cycle settlement', () => {
    const time = new TimeAuthority({ wallNow: () => 1_000_000, monotonicNow: () => 0 })
    const manager = new GameManager({ time })
    manager.catalogOps.registerMaterials(materials)
    const player = createDefaultPlayer()
    manager.setActivePlayer(player)
    const cycle = { cycleId: 'production:thanh_van_lam:1', receiptOrdinal: 1, siteId: 'thanh_van_lam', collectionRealmId: 'mortal',
      siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 23, startedAtMs: 900_000, completesAtMs: 999_999 }
    const settle = () => {
      manager.productionSystem.restoreStates([{ siteId: cycle.siteId, level: 1, autoRestart: true, productionCycles: [cycle], receiptCursor: { issuedThrough: 1, settledThrough: 0, settledAhead: [], legacyOrigins: [] } }], time.now())
      manager.tickOps.update(0.001)
    }
    settle()
    const first = manager.materialBag.receiptSnapshot()
    expect(first.sequence).toBeGreaterThan(0)
    expect(first.pending).toEqual([])
    expect(first.acknowledgedThrough).toBe(first.sequence)
    const balances = manager.materialBag.getAll()
    settle()
    expect(manager.materialBag.getAll()).toEqual(balances)
    expect(manager.materialBag.receiptSnapshot()).toEqual(first)
    const nextCycle = { ...cycle, cycleId: 'production:thanh_van_lam:2', receiptOrdinal: 2 }
    manager.productionSystem.restoreStates([{ siteId: cycle.siteId, level: 1, autoRestart: true, productionCycles: [nextCycle], receiptCursor: { issuedThrough: 2, settledThrough: 1, settledAhead: [], legacyOrigins: [] } }], time.now())
    manager.tickOps.update(0.001)
    expect(manager.materialBag.receiptSnapshot().sequence).toBeGreaterThan(first.sequence)
  })
  it('reward owner -> save -> fresh manager -> repeated receipt changes neither bag nor quest; a new delivery counts', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    const grant = give(manager, player, 3)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(3)
    manager.questOps.notifyMaterialGained(grant.materialId, 3, grant.receipt)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(3)
    const save = snapshot(manager, player)
    expect(validateGameSaveShape(save).ok).toBe(true)
    const reopened = setup(structuredClone(save.player))
    reopened.manager.saveOps.restoreFromSave(save)
    expect(() => reopened.manager.materialBag.credit(reopened.manager.materialRegistry.get(grant.materialId), 3, grant.sourceId)).toThrow('Retired')
    reopened.manager.questOps.notifyMaterialGained(grant.materialId, 3, grant.receipt)
    expect(reopened.manager.materialBag.getAmount(grant.materialId)).toBe(3)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(3)
    expect(() => reopened.manager.materialBag.credit(reopened.manager.materialRegistry.get(grant.materialId), 4, grant.sourceId)).toThrow('Retired')
    give(reopened.manager, reopened.player, 2)
    expect(reopened.manager.materialBag.getAmount(grant.materialId)).toBe(5)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(5)
    const next = snapshot(reopened.manager, reopened.player)
    reopened.manager.saveOps.restoreFromSave(next)
    reopened.manager.saveOps.restoreFromSave(next)
    expect(reopened.manager.materialBag.getAmount(grant.materialId)).toBe(5)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(5)
  })
  it('consumes a pre-admission event so a later retry cannot award a new quest', () => {
    const { manager, player } = setup()
    const grant = give(manager, player, 3)
    manager.questManager.ensureActive(quest)
    manager.questOps.notifyMaterialGained(grant.materialId, 3, grant.receipt)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(0)
    give(manager, player, 2)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(2)
  })
  it('reopens the durable outbox without crediting inventory again', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    manager.materialBag.setDeliveryConsumer(() => { throw new Error('pending consumer') })
    manager.materialBag.credit(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 4)
    const save = snapshot(manager, player)
    const reopened = setup(structuredClone(save.player))
    reopened.manager.saveOps.restoreFromSave(save)
    expect(reopened.manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(4)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(4)
  })
  it('does not infer acquisition from hydration or refunds, and persists full overflow dedupe', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    const material = manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID)
    manager.materialBag.add(material, 2)
    const hydrated = snapshot(manager, player)
    const reopened = setup(structuredClone(hydrated.player))
    reopened.manager.saveOps.restoreFromSave(hydrated)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(0)
    reopened.manager.materialBag.add(material, (material.stackLimit ?? MAX_STACK_AMOUNT) - 2)
    const full = give(reopened.manager, reopened.player, 3)
    expect(full.receipt).toBeNull()
    reopened.manager.materialBag.remove(material.id, 5)
    const cappedSave = snapshot(reopened.manager, reopened.player)
    const cappedReopen = setup(structuredClone(cappedSave.player))
    cappedReopen.manager.saveOps.restoreFromSave(cappedSave)
    const before = cappedReopen.manager.materialBag.getAmount(material.id)
    expect(() => cappedReopen.manager.materialBag.credit(material, 3, full.sourceId)).toThrow('Retired')
    expect(cappedReopen.manager.materialBag.getAmount(material.id)).toBe(before)
    expect(cappedReopen.manager.questManager.getProgress(quest.id)?.progress).toBe(0)
    give(cappedReopen.manager, cappedReopen.player, 1)
    expect(cappedReopen.manager.questManager.getProgress(quest.id)?.progress).toBe(1)
  })
  it('rejects malformed, foreign and regressed consumer state before mutating live owners', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    give(manager, player, 3)
    const save = snapshot(manager, player)
    const before = snapshot(manager, player)
    const malformed = structuredClone(save)
    malformed.quests!.materialReceipts!.acknowledgedThrough++
    expect(validateGameSaveShape(malformed).ok).toBe(false)
    expect(() => manager.saveOps.restoreFromSave(malformed)).toThrow()
    const foreign = structuredClone(save)
    foreign.quests!.materialReceipts!.runId = 'foreign'
    expect(() => manager.saveOps.restoreFromSave(foreign)).toThrow()
    const erased = structuredClone(save)
    delete erased.quests!.materialReceipts
    expect(() => manager.saveOps.restoreFromSave(erased)).toThrow()
    expect(manager.materialBag.receiptSnapshot()).toEqual(before.materialReceipts)
    expect(manager.questManager.getState()).toEqual(before.quests)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(3)
  })
  it('round-trips a sustained stream and records persistence cost without evicting receipts', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    const sizes: number[] = []
    const started = performance.now()
    for (let index = 0; index < 20_000; index++) {
      manager.rewardOps.giveReward(manager.rewardOps.buildPlayerRewardReceiver(player), { spiritStone: 1 })
      manager.materialBag.remove(SPIRIT_STONE_MATERIAL_ID, 1)
      if ([100, 2_000, 20_000].includes(index + 1)) {
        const point = snapshot(manager, player)
        sizes.push(new TextEncoder().encode(JSON.stringify({ producer: point.materialReceipts, consumer: point.quests?.materialReceipts })).byteLength)
      }
    }
    const save = snapshot(manager, player)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(40)
    expect(Math.max(...sizes)).toBeLessThan(700)
    const journalBytes = new TextEncoder().encode(JSON.stringify({ producer: save.materialReceipts, consumer: save.quests?.materialReceipts })).byteLength
    const reopen = setup(structuredClone(save.player))
    reopen.manager.saveOps.restoreFromSave(save)
    expect(reopen.manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(reopen.manager.materialBag.receiptSnapshot().sequence).toBe(20_000)
    expect(reopen.manager.questManager.getProgress(quest.id)?.progress).toBe(20_000)
    console.log(JSON.stringify({ receiptPersistenceEvidence: { grants: 20_000, journalBytes, sizes, bytesPerGrant: journalBytes / 20_000, elapsedMs: Math.round(performance.now() - started) } }))
  })
  it('permits an older complete save and a pre-receipt save to replace live receipt history', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    give(manager, player, 3)
    const earlier = snapshot(manager, player)
    give(manager, player, 2)
    manager.saveOps.restoreFromSave(earlier)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(3)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(3)
    expect(manager.materialBag.receiptSnapshot()).toEqual(earlier.materialReceipts)
    const legacy = structuredClone(earlier)
    delete legacy.materialReceipts
    delete legacy.quests!.materialReceipts
    manager.saveOps.restoreFromSave(legacy)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(3)
    expect(manager.materialBag.receiptSnapshot().sequence).toBe(0)
    give(manager, player, 1)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(4)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(4)
  })
  it('preserves a committed pending grant and the remaining production cycle under consumer backpressure across reopen', () => {
    const time = new TimeAuthority({ wallNow: () => 1_000_000, monotonicNow: () => 0 })
    const { manager, player } = setup(createDefaultPlayer(), time)
    const siteId = 'thanh_van_lam'
    const cycle = (ordinal: number) => ({ cycleId: `production:${siteId}:${ordinal}`, receiptOrdinal: ordinal,
      siteId, collectionRealmId: 'mortal', siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 23,
      startedAtMs: 900_000, completesAtMs: 1_000_000 })
    manager.productionSystem.restoreStates([{ siteId, level: 1, autoRestart: true,
      receiptCursor: { issuedThrough: 2, settledThrough: 0, settledAhead: [], legacyOrigins: [] },
      productionCycles: [cycle(1), cycle(2)] }])
    const failure = vi.spyOn(manager.questSystem, 'onMaterialCollected').mockImplementation(() => { throw new Error('consumer unavailable') })
    expect(() => manager.tickOps.update(0.001)).toThrow('consumer unavailable')
    const pending = manager.materialBag.receiptSnapshot()
    expect(pending.pending).toHaveLength(1)
    expect(manager.productionSystem.getState(siteId)?.productionCycles).toHaveLength(2)
    expect(manager.productionSystem.getState(siteId)?.receiptCursor?.settledThrough).toBe(1)
    const grant = pending.pending[0]!
    const save = snapshot(manager, player)
    expect(validateGameSaveShape(save).ok).toBe(true)
    failure.mockRestore()
    const reopened = setup(structuredClone(save.player), time)
    reopened.manager.saveOps.restoreFromSave(save)
    expect(reopened.manager.materialBag.receiptSnapshot().pending).toEqual([])
    reopened.manager.tickOps.update(0.001)
    expect(reopened.manager.materialBag.getAmount(grant.materialId)).toBe((grant.requested - grant.overflow) * 2)
    expect(reopened.manager.materialBag.receiptSnapshot().sequence).toBe(2)
    expect(reopened.manager.productionSystem.getState(siteId)?.receiptCursor?.settledThrough).toBe(2)
  })
  it('rejects malformed production cursor coverage before mutating a live owner', () => {
    const { manager, player } = setup()
    give(manager, player, 2)
    const save = snapshot(manager, player)
    save.productionSites = [{ siteId: 'thanh_van_lam', level: 1, autoRestart: true,
      receiptCursor: { issuedThrough: 2, settledThrough: 0, settledAhead: [], legacyOrigins: [] }, productionCycles: [] }]
    const before = manager.materialBag.receiptSnapshot()
    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(() => manager.saveOps.restoreFromSave(save)).toThrow('production receipt cursor')
    expect(manager.materialBag.receiptSnapshot()).toEqual(before)
  })
  it('consumes claim rewards before admitting a successor, preserving no retroactive acquisition credit', () => {
    const { manager, player } = setup()
    const first: Quest = { id: 'receipt_first', name: 'First', description: '', cadence: 'once',
      condition: { kind: 'collect', materialId: SPIRIT_STONE_MATERIAL_ID, amount: 3 }, reward: { reward: { spiritStone: 2 } } }
    const successor: Quest = { id: 'receipt_successor', name: 'Successor', description: '', cadence: 'once', unlocksAfterQuestId: first.id,
      condition: { kind: 'collect', materialId: SPIRIT_STONE_MATERIAL_ID, amount: 2 }, reward: {} }
    manager.catalogOps.registerQuests([first, successor])
    manager.questSystem.reconcileActiveQuests(manager.questRegistry, manager.questManager, player)
    give(manager, player, 3)
    expect(manager.questOps.claimQuest(first.id)).toBe(true)
    expect(manager.questManager.getProgress(successor.id)?.progress).toBe(0)
    give(manager, player, 1)
    expect(manager.questManager.getProgress(successor.id)?.progress).toBe(1)
  })
  it('rejects malformed and foreign public notifications even after the original receipt retired', () => {
    const { manager, player } = setup()
    const grant = give(manager, player, 2)
    expect(() => manager.questOps.notifyMaterialGained(grant.materialId, 2, grant.receipt)).not.toThrow()
    expect(() => manager.questOps.notifyMaterialGained(grant.materialId, 2, { ...grant.receipt!, units: Number.NaN })).toThrow('Malformed')
    expect(() => manager.questOps.notifyMaterialGained(grant.materialId, 2, { ...grant.receipt!, playerId: 'foreign' })).toThrow('Foreign')
    expect(manager.materialBag.getAmount(grant.materialId)).toBe(2)
  })
  it('quest UI query never snapshots receipt state', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    give(manager, player, 2)
    const ownerRead = vi.spyOn(manager.questManager, 'getState')
    const receiptRead = vi.spyOn(manager.questManager, 'materialReceiptSnapshot')
    manager.questOps.getBetaQuestSurfaceModels()
    expect(ownerRead).not.toHaveBeenCalled()
    expect(receiptRead).not.toHaveBeenCalled()
  })
  it('rolls back consumer receipt state after a notification failure so retry remains possible', () => {
    const { manager } = setup()
    manager.questManager.ensureActive(quest)
    const failure = vi.spyOn(manager.questSystem, 'onMaterialCollected').mockImplementation(() => { throw new Error('interrupted consumer') })
    const grant = manager.materialBag.credit(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 4)
    expect(() => manager.materialBag.prepareCredit()).toThrow('interrupted consumer')
    failure.mockRestore()
    manager.materialBag.flushDeliveries()
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(4)
    expect(manager.materialBag.getAmount(grant.materialId)).toBe(4)
  })
})


describe('receipt-only whole-save replacement', () => {
  it('applies a changed pending grant even when all other save slices are identical', () => {
    const { manager, player } = setup()
    manager.questManager.ensureActive(quest)
    manager.materialBag.setDeliveryConsumer(() => { throw new Error('hold delivery for save') })
    manager.materialBag.credit(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 1)
    const first = snapshot(manager, player)
    const second = structuredClone(first)
    const grant = second.materialReceipts!.pending[0]!
    grant.requested = 2
    grant.receipt = { ...grant.receipt!, units: 2, payload: { ...grant.receipt!.payload, delivered: 2 } }
    expect(validateGameSaveShape(first).ok).toBe(true)
    expect(validateGameSaveShape(second).ok).toBe(true)
    const reopened = setup(structuredClone(first.player))
    reopened.manager.saveOps.restoreFromSave(first)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(1)
    reopened.manager.saveOps.restoreFromSave(second)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(2)
    expect(reopened.manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(1)
    reopened.manager.saveOps.restoreFromSave(second)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(2)
  })
})
