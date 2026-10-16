import { describe, it, expect } from 'vitest'
import { TribulationDirector } from './TribulationDirector'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { EventBus } from '../events/EventBus'

// Talent v4 M2 - Loi Kiep (spec sec4.3 row 17): lightning intensity x2
// while the talent is held; each tribulation victory grants a permanent
// +10% all-attribute bonus (talent_loi_kiep_* modifiers).
function makeDirector() {
  const eventBus = new EventBus()
  return { director: new TribulationDirector({ eventBus }), eventBus }
}

function readyPlayer(talentIds: string[] = []): PlayerData {
  const player = createDefaultPlayer()
  // Quan Khi tribulation starts from a maxed mortal (release policy now
  // enforces the transition direction).
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.selectedTalentIds = talentIds
  return player
}

// HP 5000, def 0 -> mitigation 1 -> raw percent damage only.
function testStats(): Stats {
  return createBaseStats({ maxHp: 5000, defense: 0 }) as Stats
}

/** Drive mind chapter through correct answers until the lightning tank. */
function driveToTank(director: TribulationDirector) {
  let guard = 0
  while (guard++ < 100) {
    const state = director.getState()!
    if (state.state !== 'ongoing' || !state.currentQuestion) {
      return
    }
    director.answerQuestion(state.currentQuestion.correctAnswerIndex)
    director.update(3) // rest between questions
  }
}

describe('TribulationDirector — Loi Kiep talent (M2)', () => {
  it('loi_kiep: lightning strikes deal x2 damage', () => {
    const baseline = makeDirector()
    const talented = makeDirector()

    baseline.director.start(readyPlayer(), testStats(), false, 'qi_refining')
    talented.director.start(readyPlayer(['loi_kiep']), testStats(), false, 'qi_refining')

    driveToTank(baseline.director)
    driveToTank(talented.director)

    const hpBefore = baseline.director.getState()!.hp
    const hpBeforeTalented = talented.director.getState()!.hp

    // Advance until the first strike lands (qi_refining tank: 3s interval).
    let guard = 0
    while (
      baseline.director.getState()!.hp === hpBefore &&
      talented.director.getState()!.hp === hpBeforeTalented &&
      guard++ < 100
    ) {
      baseline.director.update(0.5)
      talented.director.update(0.5)
    }

    const baseLoss = hpBefore - baseline.director.getState()!.hp
    const talentedLoss = hpBeforeTalented - talented.director.getState()!.hp

    expect(baseLoss).toBeGreaterThan(0)
    expect(talentedLoss).toBeCloseTo(baseLoss * 2, 5)
  })

  it('khong co loi_kiep: moi strike mat mau bang 1 dot truoc do (5 strikes / 3s = x5)', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    driveToTank(director)

    const hpBefore = director.getState()!.hp
    // 1 strike at 0.6s interval: 7% * grade human 1.0 * mitigation 1 * (1 - 0.15) = 297.5
    director.update(0.7)
    expect(hpBefore - director.getState()!.hp).toBeCloseTo(5000 * 0.07 * 0.85, 5)

    // Full 3.0s wave (5 strikes total): 5 * 297.5 = 1487.5 (x5 difficulty)
    director.update(2.4)
    expect(hpBefore - director.getState()!.hp).toBeCloseTo(5 * 5000 * 0.07 * 0.85, 5)
  })
})
