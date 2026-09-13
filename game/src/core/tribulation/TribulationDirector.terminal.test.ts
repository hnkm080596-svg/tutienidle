import { describe, it, expect } from 'vitest'
import { TribulationDirector, type TribulationOutcome } from './TribulationDirector'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { EventBus } from '../events/EventBus'

// M5 / ARCH-006 - unique terminal outcome: a run commits exactly one
// outcome. A lethal strike ends the run; enterChapter must never
// overwrite a committed defeat with victory. Oracle: audit lifecycle
// diagnostic L02 (TRIBULATION_LETHAL_END) - outcomes must be
// ["defeat"] with hp 0.
//
// All cases run on the REAL authored chapters
// (data/tribulation/TribulationChapters) via
// director.start('foundation_establishment'): mind (4 questions) -> body
// (20s, 2s/strike, 10% maxHp) -> lightning (18s, 1.5s/strike, 13% maxHp,
// 30% maxHp final strike). Answering all 4 questions correctly grants the
// 20% lightning-damage reduction.

interface Rig {
  director: TribulationDirector
  outcomes: TribulationOutcome[]
  chapterChanges: number[]
}

function makeRig(): Rig {
  const eventBus = new EventBus()
  const outcomes: TribulationOutcome[] = []
  const chapterChanges: number[] = []
  eventBus.on<{ state: TribulationOutcome }>('tribulation_outcome', (e) => outcomes.push(e.state))
  eventBus.on<{ chapterIndex: number }>('tribulation_chapter_changed', (e) =>
    chapterChanges.push(e.chapterIndex),
  )
  return { director: new TribulationDirector({ eventBus }), outcomes, chapterChanges }
}

function qiRefiningPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  return player
}

function statsWithDefense(defense: number): Stats {
  return createBaseStats({ maxHp: 5000, defense }) as Stats
}

/**
 * L02 driving loop: 0.1s ticks; while a question is showing, answer it
 * (correctly, or leave it to time out = wrong) until the state leaves
 * 'ongoing'.
 */
function driveToTerminal(director: TribulationDirector, answerCorrectly: boolean, maxTicks = 5000) {
  for (let n = 0; n < maxTicks; n++) {
    const state = director.getState()
    if (!state || state.state !== 'ongoing') {
      return
    }
    if (answerCorrectly && state.currentQuestion) {
      director.answerQuestion(state.currentQuestion.correctAnswerIndex)
    }
    director.update(0.1)
  }
}

describe('TribulationDirector - unique terminal outcome (M5 / ARCH-006)', () => {
  it('L02 oracle: def=105, final strike kills on the last chapter end frame -> ["defeat"], hp 0', () => {
    const rig = makeRig()
    expect(
      rig.director.start(qiRefiningPlayer(), statsWithDefense(105), false, 'foundation_establishment'),
    ).toBe(true)

    driveToTerminal(rig.director, true)

    // The audit repro emitted ["defeat","victory"] with final state
    // victory - the invariant is exactly one terminal, no overwrite.
    expect(rig.outcomes).toEqual(['defeat'])
    const state = rig.director.getState()!
    expect(state.state).toBe('defeat')
    expect(state.hp).toBe(0)
  })

  it('regular lethal strike at the last-chapter boundary (def=100) -> single ["defeat"]', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(100), false, 'foundation_establishment')

    driveToTerminal(rig.director, true)

    expect(rig.outcomes).toEqual(['defeat'])
    const state = rig.director.getState()!
    expect(state.state).toBe('defeat')
    expect(state.hp).toBe(0)
    // Dies inside the final lightning chapter (index 2) - no advance
    // after the terminal.
    expect(state.chapterIndex).toBe(2)
    expect(rig.chapterChanges).toEqual([0, 1, 2])
  })

  it('lethal strike mid body chapter (def=0, questions unanswered) -> defeat, no chapter change', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(0), false, 'foundation_establishment')

    driveToTerminal(rig.director, false)

    expect(rig.outcomes).toEqual(['defeat'])
    const state = rig.director.getState()!
    expect(state.state).toBe('defeat')
    expect(state.hp).toBe(0)
    // Dies mid body chapter (index 1, ~2s remaining) - no
    // chapter_changed may be emitted after the outcome.
    expect(state.chapterIndex).toBe(1)
    expect(rig.chapterChanges).toEqual([0, 1])
  })

  it('lethal strike at the body-chapter boundary (def=15, unanswered) -> never enters lightning chapter', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(15), false, 'foundation_establishment')

    driveToTerminal(rig.director, false)

    expect(rig.outcomes).toEqual(['defeat'])
    const state = rig.director.getState()!
    expect(state.state).toBe('defeat')
    expect(state.hp).toBe(0)
    // Dies exactly at t=20s on the last body strike: the old code still
    // ran enterChapter(2) and emitted chapter_changed AFTER the outcome -
    // chapterIndex must stay at 1.
    expect(state.chapterIndex).toBe(1)
    expect(rig.chapterChanges).toEqual([0, 1])
  })

  it('barely survives the final strike at the boundary (def=130) -> ["victory"] exactly once', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(130), false, 'foundation_establishment')

    driveToTerminal(rig.director, true)

    expect(rig.outcomes).toEqual(['victory'])
    const state = rig.director.getState()!
    expect(state.state).toBe('victory')
    expect(state.hp).toBeGreaterThan(0)
  })

  it('victory path: extra ticks after the terminal emit no further outcome', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(900), false, 'qi_refining')

    driveToTerminal(rig.director, true)
    expect(rig.outcomes).toEqual(['victory'])

    // Stale ticks / stale answers after the terminal are no-ops - no
    // second outcome.
    rig.director.update(5)
    rig.director.update(5)
    expect(rig.director.answerQuestion(0)).toBe(false)
    expect(rig.outcomes).toEqual(['victory'])
  })

  it('defeat path: extra ticks after the terminal emit no further outcome', () => {
    const rig = makeRig()
    rig.director.start(qiRefiningPlayer(), statsWithDefense(105), false, 'foundation_establishment')

    driveToTerminal(rig.director, true)
    expect(rig.outcomes).toEqual(['defeat'])

    rig.director.update(5)
    rig.director.update(5)
    expect(rig.outcomes).toEqual(['defeat'])
    expect(rig.director.getState()!.state).toBe('defeat')
    expect(rig.director.getCooldownSeconds()).toBeGreaterThan(0)
  })
})
