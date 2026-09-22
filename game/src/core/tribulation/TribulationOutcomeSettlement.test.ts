// M6 / ARCH-006 - domain-owned outcome settlement: the committed outcome
// carries an attempt identity and a once-only receipt slot on the
// director; TribulationOutcomeService.settleOutcome applies consequences
// exactly once per committed outcome and returns the bound receipt on
// every later call. These tests run the REAL GameManager + director +
// authored chapters (real factory), not a fabricated state.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'
import { asBaseStats } from '../stats/StatBlock'
import { pills } from '../../data/pill/pills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { MERIDIANS } from '../../data/realm/Meridians'
import {
  SPIRIT_STONE_MATERIAL,
  getSpiritStoneMaterialIdForRealmTier,
} from '../material/SpiritStoneMaterial'
import { getRealmTier } from '../realm/RealmTierMap'
import {
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
} from '../../data/tribulation/TribulationChapters'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

/** Drive a started tribulation to its real terminal via the director's
 * own tick/answer contract. */
function driveToTerminal(gameManager: GameManager, answerCorrectly = true) {
  let guard = 0
  while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
    gameManager.tickOps.update(1)
    const q = gameManager.tribulationDirector.getState()!.currentQuestion
    if (answerCorrectly && q) {
      gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }
  }
}

/** Player ready to survive the authored foundation_establishment kiếp. */
function surviveFoundationTribulation(player: ReturnType<typeof usePlayerStore>) {
  player.realmId = 'qi_refining'
  player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
}

/** Player invested enough for the Đại Đạo grade (spec §4.2/§4.4). */
function investForGreatDao(player: ReturnType<typeof usePlayerStore>, gameManager: GameManager) {
  // The spell ritual grants dai_ngu_hanh_chan_quyet — the round-4
  // transaction boundary requires the template registered.
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  player.selectedTalentIds = ['pham_cot']
  player.realmLevel = 12
  player.bodyProgression.body_refinement.completedTiers = 6
  player.physiqueGrade = 'bao'
  player.mortalPerfectionAchieved = true
  player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
  gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
  player.realmLevel = 18
  player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
  player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
  gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
}

describe('CommittedTribulationOutcome — identity and lifecycle (M6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('no record while ongoing; the terminal commit stamps it bound to the run session id', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()

    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()
    expect(committed).not.toBeNull()
    expect(committed!.outcome).toBe('victory')
    expect(committed!.targetRealmId).toBe('foundation_establishment')
    // The record snapshots the run's own resolved facts - an uninvested
    // attempt resolves the lowest grade, and the snapshot must match the
    // live state's grade, not a guessed constant.
    expect(committed!.grade).toBe(gameManager.tribulationDirector.getState()!.grade)
    expect(committed!.receipt).toBeNull()
    // The attempt identity is the run's own presentation session id.
    expect(committed!.attemptId).toBe(
      gameManager.getCurrentPresentationSession('tribulation')!.sessionId,
    )
  })

  it('a mutated live state without the terminal commit exposes NO committed outcome', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    surviveFoundationTribulation(player)
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)

    // The old test-scaffold bypass: writing the live object's state flag
    // directly. Settlement keys off the domain-owned record, so this
    // produces nothing to settle.
    gameManager.tribulationDirector.getState()!.state = 'victory'

    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
  })

  it('clear() drains the record; the next run stamps a fresh record under a new attempt id', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)
    const first = gameManager.tribulationDirector.getCommittedOutcome()!
    const service = new TribulationOutcomeService()
    const firstReceipt = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(first.receipt).toBe(firstReceipt)

    gameManager.tribulationDirector.clear()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()

    // Second attempt (defeat this time): new session id, fresh unsettled
    // record - the first run's bound receipt cannot leak into it. Defeat
    // needs the unanswered-questions path: mind fail stacks amplify the
    // strikes enough to kill a maxHp-1 tank.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager, false)

    const second = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(second.attemptId).not.toBe(first.attemptId)
    expect(second.outcome).toBe('defeat')
    expect(second.receipt).toBeNull()
  })
})

describe('settleOutcome — once-only commit with exact consequences (M6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('victory settles realm/foundation exactly once - repeat calls return the same receipt', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    surviveFoundationTribulation(player)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    const service = new TribulationOutcomeService()

    const first = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(first).not.toBeNull()
    expect(first!.kind).toBe('victory')
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.cultivation).toBe(0)
    // Foundation recorded is the run's own resolved grade (uninvested
    // attempt -> the lowest grade), snapshotted on the committed record.
    expect(player.highestFoundationAchieved).toBe(committed.grade)
    // loi_kiep stack is the non-idempotent probe: +1 per settlement.
    expect(player.tribulationBonusStacks).toBe(1)

    // Duplicate settle converges on the bound receipt - nothing re-applies.
    const second = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(second).toBe(first)
    expect(player.tribulationBonusStacks).toBe(1)
    expect(player.realmLevel).toBe(1)

    // A fresh service instance sees the same bound receipt - the dedup
    // identity lives on the domain record, not on the service.
    const third = new TribulationOutcomeService().settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(third).toBe(first)
    expect(player.tribulationBonusStacks).toBe(1)
  })

  it('great_dao victory converts the talent exactly once', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    investForGreatDao(player, gameManager)
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('great_dao')
    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('victory')
    expect(committed.grade).toBe('great_dao')
    const service = new TribulationOutcomeService()
    const result = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)

    expect(result!.kind).toBe('victory')
    expect(player.highestFoundationAchieved).toBe('great_dao')
    expect(player.selectedTalentIds).not.toContain('pham_cot')
    expect(player.selectedTalentIds.filter((id) => id === 'pham_nhan_chi_cot')).toHaveLength(1)
    expect(player.realmId).toBe('foundation_establishment')

    service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(player.selectedTalentIds.filter((id) => id === 'pham_nhan_chi_cot')).toHaveLength(1)
  })

  it('defeat settles cultivation loss + spirit stones + Great Dao lock exactly once', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    investForGreatDao(player, gameManager)
    // Too weak to survive -> defeat on the great_dao attempt.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    player.cultivation = 10_000

    const stoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier('foundation_establishment'))
    gameManager.materialBag.add({ ...SPIRIT_STONE_MATERIAL, id: stoneId }, 350)

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('great_dao')
    driveToTerminal(gameManager, false)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('defeat')

    const service = new TribulationOutcomeService()
    const result = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)

    expect(result!.kind).toBe('defeat')
    const expectedCultivation = Math.floor(
      10_000 * (1 - TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM['foundation_establishment']!),
    )
    expect(player.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(
      350 - TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM['foundation_establishment']!,
    )
    expect(player.greatDaoOpportunityLost).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_cot')

    // Second settle: cultivation is NOT cut again and stones are NOT
    // removed again - the receipt is returned unchanged.
    const again = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(again).toBe(result)
    expect(player.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(
      350 - TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM['foundation_establishment']!,
    )
    expect(player.greatDaoOpportunityLost).toBe(true)
  })

  it('a second attempt settles its own outcome - receipts never carry over', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    surviveFoundationTribulation(player)

    const service = new TribulationOutcomeService()

    // Attempt 1: qi_refining victory (announcement-only outcome, still a
    // banked loi_kiep stack).
    expect(gameManager.startTribulation(player.$state, 'qi_refining')).toBe(true)
    driveToTerminal(gameManager)
    const firstCommitted = gameManager.tribulationDirector.getCommittedOutcome()!
    service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(player.tribulationBonusStacks).toBe(1)
    gameManager.tribulationDirector.clear()

    // Attempt 2: another run, another victory -> its own once-only
    // settlement pushes the stack to 2 (once per attempt, by design).
    expect(gameManager.startTribulation(player.$state, 'qi_refining')).toBe(true)
    driveToTerminal(gameManager)
    const secondCommitted = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(secondCommitted.receipt).toBeNull()

    const receipt = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(receipt).not.toBe(firstCommitted.receipt)
    expect(player.tribulationBonusStacks).toBe(2)
    service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(player.tribulationBonusStacks).toBe(2)
  })
})

describe('settleOutcome — mid-apply failure containment (M6 r1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

  it('a throwing defeat resolve marks the record terminal-failed; later ticks never re-apply', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    // Too weak + unanswered questions -> real defeat (mind fail stacks
    // amplify the strikes enough to kill a maxHp-1 tank).
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })
    player.cultivation = 10_000

    const stoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier('foundation_establishment'))
    gameManager.materialBag.add({ ...SPIRIT_STONE_MATERIAL, id: stoneId }, 350)

    // Fault injection: the Kiep Thuong debuff write (LAST consequence of
    // resolveDefeat) throws - cultivation + stones already landed.
    const buffSpy = vi
      .spyOn(gameManager.effectOps, 'applyPersistentBuff')
      .mockImplementation(() => {
        throw new Error('injected debuff failure')
      })

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager, false)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('defeat')

    const service = new TribulationOutcomeService()

    // First settle: apply runs, the debuff write throws mid-apply, the
    // record is marked terminal-failed and the exception is CONTAINED
    // (null return, never propagated).
    const first = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(first).toBeNull()
    expect(committed.settlementError).toBeInstanceOf(Error)
    expect(committed.settlementError!.message).toBe('injected debuff failure')
    expect(committed.receipt).toBeNull()

    const expectedCultivation = Math.floor(
      10_000 * (1 - TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM['foundation_establishment']!),
    )
    const expectedStones = 350 - TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM['foundation_establishment']!
    expect(player.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(expectedStones)
    expect(buffSpy).toHaveBeenCalledTimes(1)

    // Second tick: the marker short-circuits before any re-apply -
    // cultivation is NOT re-cut, stones are NOT re-removed, the debuff
    // write is NOT retried.
    const second = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(second).toBeNull()
    expect(player.cultivation).toBe(expectedCultivation)
    expect(gameManager.materialBag.getAmount(stoneId)).toBe(expectedStones)
    expect(buffSpy).toHaveBeenCalledTimes(1)
  })

  it('a throwing victory resolve converges: the loi_kiep stack and realm write land exactly once', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    surviveFoundationTribulation(player)

    // Fault injection: the unequip-all write throws AFTER the loi_kiep
    // stack, realm id, and cultivation reset already applied.
    const unequipSpy = vi
      .spyOn(gameManager.equipmentOps, 'unequipAllEquipment')
      .mockImplementation(() => {
        throw new Error('injected unequip failure')
      })

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToTerminal(gameManager)

    const committed = gameManager.tribulationDirector.getCommittedOutcome()!
    expect(committed.outcome).toBe('victory')

    const service = new TribulationOutcomeService()
    const first = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)

    expect(first).toBeNull()
    expect(committed.settlementError).toBeInstanceOf(Error)
    // Partial consequences landed - exactly once.
    expect(player.tribulationBonusStacks).toBe(1)
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.cultivation).toBe(0)
    expect(unequipSpy).toHaveBeenCalledTimes(1)

    // Retry: nothing re-applies - the non-idempotent stack stays at 1.
    const second = service.settleOutcome(player, gameManager, gameManager.tribulationDirector)
    expect(second).toBeNull()
    expect(player.tribulationBonusStacks).toBe(1)
    expect(unequipSpy).toHaveBeenCalledTimes(1)
  })
})
