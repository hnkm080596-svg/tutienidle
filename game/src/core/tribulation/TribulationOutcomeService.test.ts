// R8.2 slice-1 design fix: the service must write through a structurally
// typed writer (the Pinia store in production), NOT the raw $state object.
// Evidence (probe test, removed): writing an ABSENT optional key (e.g.
// highestFoundationAchieved) on store.$state does not reflect through the
// store proxy, while writes on the store do. The interface lives in core
// (structural, no Pinia import — A6).
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
import { i18n } from '../../i18n'
import enMessages from '../../locales/en.json'

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
  grade: 'thien_dao' | 'great_dao' = 'thien_dao',
): ActiveTribulationState {
  return {
    targetRealmId,
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

  it('qi_refining victory is a pure announcement outcome: realm NOT entered, no talent/foundation writes', () => {
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
  })

  it('foundation_establishment victory: realm/level reset, unequip-all, foundation recorded, talent converted, passives synced', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    const player = usePlayerStore()
    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m: { id: string }) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)

    // ARCH-002 (M7): startTribulation resolves stats internally — patch
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
    expect(result.announcement).toEqual({
      titleKey: 'announce.tribulation.foundation.title',
      titleParams: { label: 'ĐẠI ĐẠO' },
      bodyKey: 'announce.tribulation.foundation.body',
    })
    expect(resolveAnnouncement(result.announcement).title).toBe('★ ĐẠI ĐẠO TRÚC CƠ ★')
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

  it('great_dao defeat sets greatDaoOpportunityLost permanently, talent untouched', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['pham_cot']
    player.realmId = 'qi_refining'
    const active = makeActive('defeat', 'foundation_establishment', 'great_dao')

    const service = new TribulationOutcomeService()
    const result = service.resolveDefeat(player, gameManager, active)

    expect(player.greatDaoOpportunityLost).toBe(true)
    expect(result.greatDaoOpportunityLost).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_cot')
    expect(result.announcement.titleKey).toBe('announce.tribulation.defeatGreatDao.title')
    expect(result.announcement.bodyKey).toBe('announce.tribulation.defeatGreatDao.body')
    expect(resolveAnnouncement(result.announcement).title).toBe('Đại Đạo Đoạn Tuyệt')
  })

  it('non-great-dao defeat announces Kiep Thuong message, opportunity NOT lost', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.realmId = 'qi_refining'
    const active = makeActive('defeat', 'foundation_establishment', 'thien_dao')

    const service = new TribulationOutcomeService()
    const result = service.resolveDefeat(player, gameManager, active)

    expect(result.greatDaoOpportunityLost).toBe(false)
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

    // Great Dao defeat
    const daoDefeat = service.resolveDefeat(
      player, gameManager, makeActive('defeat', 'foundation_establishment', 'great_dao'),
    )
    expect(resolveAnnouncement(daoDefeat.announcement)).toEqual({
      title: 'Đại Đạo Đoạn Tuyệt',
      body: 'Nghịch thiên bất thành — cơ duyên Đại Đạo Chi Cơ đã vĩnh viễn đóng lại. Lần tới tối đa là Thiên Đạo.',
    })

    // Generic defeat
    const defeat = service.resolveDefeat(
      player, gameManager, makeActive('defeat', 'foundation_establishment', 'thien_dao'),
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
        player, gameManager, makeActive('defeat', 'foundation_establishment', 'great_dao'),
      ).announcement,
      service.resolveDefeat(
        player, gameManager, makeActive('defeat', 'foundation_establishment', 'thien_dao'),
      ).announcement,
    ]

    for (const d of descriptors) {
      for (const key of [d.titleKey, d.bodyKey]) {
        expect(typeof messageAt(enMessages, key), `en locale missing "${key}"`).toBe('string')
      }
    }
  })
})
