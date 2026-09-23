// R8.2 slice-1 design fix: the service must write through a structurally
// typed writer (the Pinia store in production), NOT the raw $state object.
// Evidence (probe test, removed): writing an ABSENT optional key (e.g.
// highestFoundationAchieved) on store.$state does not reflect through the
// store proxy, while writes on the store do. The interface lives in core
// (structural, no Pinia import - A6).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'
import { asBaseStats } from '../stats/StatBlock'
import { pills } from '../../data/pill/pills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { MERIDIANS } from '../../data/realm/Meridians'
import type { ActiveTribulationState } from './TribulationDirector'
import type { OutcomeAnnouncement } from '../presentation/OutcomeAnnouncement'
import {
  completeHiddenBody,
  type BreakthroughType,
} from '../realm/hidden/HiddenLineage'
import type { ResolvableKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'
import { i18n } from '../../i18n'
import enMessages from '../../locales/en.json'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

/** Walk a dotted i18n key in a raw messages object. */
function messageAt(messages: object, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }, messages)
}

/** Resolve an announcement descriptor through the real i18n gateway. */
function resolveAnnouncement(a: OutcomeAnnouncement): { title: string; body: string } {
  return {
    title: i18n.global.t(a.titleKey, a.titleParams ?? {}),
    body: i18n.global.t(a.bodyKey, a.bodyParams ?? {}),
  }
}

/** Minimal ActiveTribulationState literal for outcome resolution. */
function makeActive(
  state: 'victory' | 'defeat',
  targetRealmId: string,
  breakthroughType: BreakthroughType = 'normal',
  grade: ResolvableKienCoGrade = 'heaven',
): ActiveTribulationState {
  return {
    targetRealmId,
    breakthroughType,
    grade,
    chapterIndex: 0,
    chaptersTotal: 1,
    chapterName: '',
    state,
    currentQuestion: null,
    questionSecondsRemaining: 0,
    questionSecondsLimit: 0,
    secondsRemaining: 0,
  } as ActiveTribulationState
}

/** Drive an active tribulation to completion by answering every question. */
function driveToCompletion(gameManager: GameManager) {
  let guard = 0
  while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
    gameManager.tickOps.update(1)
    const q = gameManager.tribulationDirector.getState()!.currentQuestion
    if (q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
  }
}

describe('TribulationOutcomeService — victory parity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('qi_refining victory is a pure announcement outcome + a qi_refining-pool talent entitlement (M-F-TALENT)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    const result = service.resolveVictory(player, gameManager, makeActive('victory', 'qi_refining'))

    expect(result.kind).toBe('victory')
    expect(result.realmEntered).toBeNull()
    expect(player.realmId).toBe('mortal')
    expect(result.standalonePanel).toBe('quan_khi')
    expect(result.announcement.titleKey).toBe('announce.tribulation.quanKhi.title')
    expect(result.announcement.bodyKey).toBe('announce.tribulation.quanKhi.body')

    // M-F-TALENT - the mandatory decision record is written on the same
    // committed-outcome seam, keyed to the realm being ENTERED. The
    // offer list is bound at creation: identical cards re-present after
    // reload (no reroll). UPGRADE is exercisable immediately (pham_cot
    // carries no levels; a fresh player has none either -> NEW-only).
    const entitlement = player.pendingTalentEntitlement
    expect(entitlement).toBeDefined()
    expect(entitlement!.realmId).toBe('qi_refining')
    expect(entitlement!.offeredTalentIds).toHaveLength(3)
    expect(new Set(entitlement!.offeredTalentIds).size).toBe(3)
  })

  it('a still-pending entitlement is never overwritten by a later victory', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    service.resolveVictory(player, gameManager, makeActive('victory', 'qi_refining'))
    const bound = player.pendingTalentEntitlement
    expect(bound?.realmId).toBe('qi_refining')

    service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core'))

    // The first record binds - reload/repeat ticks can never rebind a
    // different offer set onto the pending decision.
    expect(player.pendingTalentEntitlement).toEqual(bound)
  })

  it('foundation_establishment victory: realm/level reset, unequip-all, foundation recorded, talent converted, passives synced', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = usePlayerStore()
    player.selectedTalentIds = ['pham_cot']
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    // The mortal exit must itself commit hidden or the ritual closes the
    // lineage: mortal body complete + Lv18 + all-5 at the mortal
    // effective cap (floor(10 x 1.1) = 11) BEFORE the ritual.
    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 11, dexterity: 11, intelligence: 11, attunement: 11, vitality: 11 }
    completeHiddenBody(player.$state, 'mortal')
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
    player.realmLevel = 18
    // Hidden-eligible surface: strict-prefix bodies + effective cap 36
    // + chapter cleared - resolves breakthroughType 'hidden'.
    completeHiddenBody(player.$state, 'qi_refining')
    player.completedStageIds = ['qi_refining_abyssal_pool']
    player.baseStats = { ...player.baseStats, strength: 36, dexterity: 36, intelligence: 36, attunement: 36, vitality: 36 }
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m: { id: string }) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)

    // ARCH-002 (M7): startTribulation resolves stats internally - patch
    // the RAW base so the tribulation ghost survives the strikes.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToCompletion(gameManager)
    expect(gameManager.tribulationDirector.getState()!.state).toBe('victory')

    const service = new TribulationOutcomeService()
    const result = service.resolveVictory(player, gameManager, gameManager.tribulationDirector.getState()!)

    expect(result.kind).toBe('victory')
    expect(result.realmEntered).toBe('foundation_establishment')
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.cultivation).toBe(0)
    expect(player.highestFoundationAchieved).toBe('great_dao')
    expect(result.talentConverted).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_nhan_chi_cot')
    expect(player.selectedTalentIds).not.toContain('pham_cot')

    // M-F-TALENT - a Dai Dao breakthrough's ONE result is the pham_cot
    // evolution (the explicit special case): the generic UPGRADE/NEW
    // entitlement is suppressed so the transaction yields one result,
    // never two.
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(result.announcement).toEqual({
      titleKey: 'announce.tribulation.foundation.title',
      titleParams: { label: 'ĐẠI ĐẠO' },
      bodyKey: 'announce.tribulation.foundation.body',
    })
    expect(resolveAnnouncement(result.announcement).title).toBe('★ ĐẠI ĐẠO TRÚC CƠ ★')
  })

  // C2C round 42 - one breakthrough yields exactly ONE result: the
  // pham_cot -> pham_nhan_chi_cot evolution IS the Dai Dao result, so
  // the generic entitlement is suppressed on that path alone.
  it('great_dao breakthrough suppresses the generic entitlement - the evolution is the one result', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    player.selectedTalentIds = ['pham_cot']
    const service = new TribulationOutcomeService()

    const result = service.resolveVictory(
      player,
      gameManager,
      makeActive('victory', 'foundation_establishment', 'hidden'),
    )

    expect(result.talentConverted).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_nhan_chi_cot')
    expect(player.selectedTalentIds).not.toContain('pham_cot')
    expect(player.pendingTalentEntitlement).toBeUndefined()
  })

  it('non-hidden foundation breakthrough still mints the realm-pool entitlement', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    const result = service.resolveVictory(
      player,
      gameManager,
      makeActive('victory', 'foundation_establishment'),
    )

    expect(result.talentConverted).toBe(false)
    expect(player.pendingTalentEntitlement?.realmId).toBe('foundation_establishment')
    expect(player.pendingTalentEntitlement?.offeredTalentIds.length).toBeGreaterThan(0)
  })

  it('quest realm-transition flag is marked on realm entry', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m: { id: string }) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToCompletion(gameManager)

    const service = new TribulationOutcomeService()
    const result = service.resolveVictory(player, gameManager, gameManager.tribulationDirector.getState()!)

    expect(result.questRealmTransitionMarked).toBe(true)
  })

  // M-F-TECHNIQUE (F4) - the freeze seam fires BEFORE the realm write:
  // the departing realmLevel (12) is the freeze-time ceiling that makes
  // rank 12 seal as dai_thanh, while the live holder keeps its literal
  // rank/grade until the catch-up transaction.
  it('realm-exit victory seals the live technique cycle into gradeHistory', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m: { id: string }) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })

    gameManager.techniqueSystem.grant({ ...TECHNIQUES[0]! }, 'qi_refining')
    const held = gameManager.techniqueManager.getActive()!
    held.rank = 12

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToCompletion(gameManager)

    const service = new TribulationOutcomeService()
    const result = service.resolveVictory(player, gameManager, gameManager.tribulationDirector.getState()!)

    expect(result.realmEntered).toBe('foundation_establishment')
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)

    // Sealed at the DEPARTING realmLevel 12 -> dai_thanh; the live
    // holder keeps its literal rank/grade until catch-up.
    expect(held.gradeHistory[1]).toEqual({ finalRank: 12, completionState: 'dai_thanh' })
    expect(held.rank).toBe(12)
    expect(held.grade).toBe(1)
  })

  it('an in-band cycle on a later exit does not double-seal', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m: { id: string }) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })

    gameManager.techniqueSystem.grant({ ...TECHNIQUES[0]! }, 'qi_refining')
    const held = gameManager.techniqueManager.getActive()!
    held.rank = 12

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    driveToCompletion(gameManager)
    new TribulationOutcomeService().resolveVictory(player, gameManager, gameManager.tribulationDirector.getState()!)

    // Catch up to grade 2 (in-band at realm index 2), train the new
    // cycle, then exit into golden_core (index 3): the grade-2 cycle
    // seals at the departing realmLevel while the grade-1 record
    // stands verbatim (write-if-absent).
    gameManager.techniqueSystem.advanceTechniqueGrade('foundation_establishment')
    expect(held.grade).toBe(2)
    expect(held.gradeHistory[2]).toBeUndefined() // in-band live grade carries no record

    player.realmLevel = 12
    held.rank = 5
    gameManager.realmAdvanceOps.applyTechniqueRealmTransition(player, 'golden_core')
    expect(held.gradeHistory[1]).toEqual({ finalRank: 12, completionState: 'dai_thanh' })
    expect(held.gradeHistory[2]).toEqual({ finalRank: 5, completionState: 'partial' })
  })
})

describe('TribulationOutcomeService — defeat parity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('defeat applies cultivation loss with realm-scaled percent', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    player.cultivation = 1_000
    const active = makeActive('defeat', 'foundation_establishment')

    const service = new TribulationOutcomeService()
    const result = service.resolveDefeat(player, gameManager, active)

    expect(result.kind).toBe('defeat')
    expect(result.cultivationLossPercent).toBeGreaterThan(0)
    expect(player.cultivation).toBeLessThan(1_000)
    expect(result.spiritStonesLost).toBeGreaterThanOrEqual(0)
  })

  it('hidden-path defeat does NOT close the lineage - generic defeat result (design §3.3)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['pham_cot']
    player.realmId = 'qi_refining'
    const active = makeActive('defeat', 'foundation_establishment', 'hidden')

    const service = new TribulationOutcomeService()
    const result = service.resolveDefeat(player, gameManager, active)

    // Defeat never touches the lineage - it stays open regardless of
    // the attempted type, and the talent is untouched.
    expect(player.hiddenPerfection.lineageActive).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_cot')
    // M-F-TALENT - defeat writes NO entitlement: the mandatory
    // transaction exists only on a breakthrough victory.
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(result.announcement.titleKey).toBe('announce.tribulation.defeat.title')
    expect(result.announcement.bodyKey).toBe('announce.tribulation.defeat.body')
    expect(resolveAnnouncement(result.announcement).title).toBe('Độ Kiếp Thất Bại')
  })

  it('normal defeat announces the Kiep Thuong message', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    const active = makeActive('defeat', 'foundation_establishment')

    const service = new TribulationOutcomeService()
    const result = service.resolveDefeat(player, gameManager, active)

    expect(result.announcement.titleKey).toBe('announce.tribulation.defeat.title')
    expect(resolveAnnouncement(result.announcement).title).toBe('Độ Kiếp Thất Bại')
  })
})

describe('TribulationOutcomeService — announcement descriptors resolve to the migrated strings (byte parity)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('every outcome variant resolves to the pre-migration Vietnamese text', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    // Quan Khi victory
    const quanKhi = service.resolveVictory(player, gameManager, makeActive('victory', 'qi_refining'))
    expect(resolveAnnouncement(quanKhi.announcement)).toEqual({
      title: 'QUÁN KHÍ THÀNH CÔNG',
      body: 'Đạo hữu đã vượt lôi kiếp — hãy chọn con đường tu luyện để bước vào Luyện Khí kỳ.',
    })

    // Generic defeat (the defeatGreatDao variant retired 2026-09-23 -
    // every defeat takes the generic result now)
    const defeat = service.resolveDefeat(
      player, gameManager, makeActive('defeat', 'foundation_establishment'),
    )
    expect(resolveAnnouncement(defeat.announcement)).toEqual({
      title: 'Độ Kiếp Thất Bại',
      body: 'Kiếp Thương còn vương lại — hãy dưỡng thương rồi thử lại.',
    })

    // Non-foundation realm victory (param-bearing title/body)
    const realmWin = service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core'))
    expect(resolveAnnouncement(realmWin.announcement)).toEqual({
      title: '★ KIM ĐAN ★',
      body: 'Đạo hữu đã vượt qua Độ Kiếp, chính thức bước vào Kim Đan.',
    })
  })

  it('every emitted announcement key exists in the en fallback locale', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    const descriptors = [
      service.resolveVictory(player, gameManager, makeActive('victory', 'qi_refining')).announcement,
      service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core')).announcement,
      service.resolveDefeat(
        player, gameManager, makeActive('defeat', 'foundation_establishment'),
      ).announcement,
      service.resolveDefeat(
        player, gameManager, makeActive('defeat', 'foundation_establishment', 'hidden'),
      ).announcement,
    ]

    for (const d of descriptors) {
      for (const key of [d.titleKey, d.bodyKey]) {
        expect(typeof messageAt(enMessages, key), `en locale missing "${key}"`).toBe('string')
      }
    }
  })
})
