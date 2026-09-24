import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { TribulationOutcomeService } from './TribulationOutcomeService'

import type { ActiveTribulationState } from './TribulationDirector'
import type { BreakthroughType } from '../realm/hidden/HiddenLineage'
import type { ResolvableKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'

// Talent v4 M2 - Loi Kiep victory reward (spec sec.4.3 row 17): every
// successful tribulation grants a permanent +10% on all five attributes
// via player.modifiers (sourceType 'talent', sourceId 'loi_kiep') -
// intentionally unbounded across realm entries (in practice <= 9 realms).
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
    lightningStrikesTaken: 0,
    hp: 0,
    maxHp: 0,
  } as ActiveTribulationState
}

const ATTRIBUTE_STATS = ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'] as const

function loiKiepModifiers(player: { modifiers: { sourceId: string; stat: string; percent?: number; sourceType?: string }[] }) {
  return player.modifiers.filter((m) => m.sourceId === 'loi_kiep')
}

describe('TribulationOutcomeService — Loi Kiep victory stacks (M2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('victory voi loi_kiep: +1 stack, 5 attribute modifiers +10%', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    const service = new TribulationOutcomeService()

    service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core'))

    expect(loiKiepModifiers(player)).toHaveLength(5)

    const granted = loiKiepModifiers(player)
    expect(granted).toHaveLength(5)
    for (const stat of ATTRIBUTE_STATS) {
      const mod = granted.find((m) => m.stat === stat)
      expect(mod, `modifier cho ${stat}`).toBeDefined()
      expect(mod!.percent).toBeCloseTo(0.1)
      expect(mod!.sourceType).toBe('talent')
    }
  })

  it('victory lan hai: stack = 2, modifier percent tang len 0.2', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    const service = new TribulationOutcomeService()

    service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core'))
    service.resolveVictory(player, gameManager, makeActive('victory', 'nascent_soul'))

    expect(loiKiepModifiers(player).find((m) => m.stat === 'strength')!.percent).toBeCloseTo(0.2)

    const granted = loiKiepModifiers(player)
    expect(granted).toHaveLength(5)
    expect(granted.find((m) => m.stat === 'strength')!.percent).toBeCloseTo(0.2)
  })

  it('quan_khi victory (announcement-only) cung tinh la mot lan thang kiep', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    const service = new TribulationOutcomeService()

    service.resolveVictory(player, gameManager, makeActive('victory', 'qi_refining'))

    expect(loiKiepModifiers(player)).toHaveLength(5)
  })

  it('khong co loi_kiep: victory khong them modifier', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const service = new TribulationOutcomeService()

    service.resolveVictory(player, gameManager, makeActive('victory', 'golden_core'))

    expect(loiKiepModifiers(player)).toHaveLength(0)
  })

  it('defeat khong them modifier ke ca khi co loi_kiep', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.selectedTalentIds = ['loi_kiep']
    const service = new TribulationOutcomeService()

    service.resolveDefeat(
      player,
      gameManager,
      makeActive('defeat', 'golden_core'),
    )

    expect(loiKiepModifiers(player)).toHaveLength(0)
  })
})
