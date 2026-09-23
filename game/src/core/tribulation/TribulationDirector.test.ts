import { describe, it, expect } from 'vitest'
import { TribulationDirector } from './TribulationDirector'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createBaseStats, type Stats } from '../stats/StatBlock'
import { EventBus } from '../events/EventBus'
import { MERIDIANS } from '../../data/realm/Meridians'
import { completeHiddenBody } from '../realm/hidden/HiddenLineage'

function makeDirector() {
  const eventBus = new EventBus()
  return { director: new TribulationDirector({ eventBus }), eventBus }
}

function readyPlayer(): PlayerData {
  const player = createDefaultPlayer()
  // Quan Khi runs start from a maxed mortal - the transition direction is
  // now enforced by release policy, so the fixture must sit at the
  // source realm, not the target one.
  player.realmId = 'mortal'
  player.realmLevel = 12
  return player
}

// Player dau tu toi da cho grade heaven (6/6 tiers + 8 mach + dan)
// NHUNG chua du dieu kien AN - chi body mortal hoan thien, body
// qi_refining chua. Viet hidden-body qua mutator lineage (mechanism
// that do HIDDEN-B/C so huu).
function createHeavenInvestedPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'qi_refining'
  player.realmLevel = 18
  player.selectedTalentIds = ['pham_cot']
  player.completedStageIds = ['qi_refining_abyssal_pool']
  player.bodyProgression.body_refinement.completedTiers = 6
  player.physiqueGrade = 'bao'
  completeHiddenBody(player, 'mortal')
  player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
  player.baseStats = { ...player.baseStats, strength: 36, dexterity: 36, intelligence: 36, attunement: 36, vitality: 36 }
  return player
}

// Player du dieu kien dot pha AN (gate foundation_establishment):
// lineage mo + 2 body hoan thien + level 18 + all-5 >= effective cap
// 36 + chapter cleared.
function createHiddenEligiblePlayer(): PlayerData {
  const player = createHeavenInvestedPlayer()
  completeHiddenBody(player, 'qi_refining')
  return player
}

// Stats test: HP 5000, def 0 (mitigation 100/100 = 1), regen 0
function testStats(): Stats {
  return createBaseStats({ maxHp: 5000, defense: 0 }) as Stats
}

function snapshotHp(director: TribulationDirector): number {
  return director.getState()!.hp
}

describe('TribulationDirector (spec dot-pha-loi-kiep §5)', () => {
  it('start Quán Khí: 2 chương, chương 1 là mind với 3 câu', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), testStats(), false, 'qi_refining')).toBe(true)
    const state = director.getState()!
    expect(state.chaptersTotal).toBe(2)
    expect(state.chapterIndex).toBe(0)
    expect(state.currentQuestion).not.toBeNull()
    expect(state.state).toBe('ongoing')
  })

  it('trả lời đúng 3/3 câu → hết mind, sang chương lightning', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    for (let i = 0; i < 3; i++) {
      const q = director.getState()!.currentQuestion!
      expect(director.answerQuestion(q.correctAnswerIndex)).toBe(true)
      director.update(3) // rest giua cau
    }
    director.update(1)
    expect(director.getState()!.chapterIndex).toBe(1)
    expect(director.getState()!.currentQuestion).toBeNull()
  })

  it('trả lời sai hết → stack debuff: HP tụt nhanh hơn khi tank', () => {
    const wrongDirector = makeDirector().director
    const rightDirector = makeDirector().director
    wrongDirector.start(readyPlayer(), testStats(), false, 'qi_refining')
    rightDirector.start(readyPlayer(), testStats(), false, 'qi_refining')
    for (const d of [wrongDirector, rightDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 50) {
        const q = d.getState()!.currentQuestion!
        if (d === wrongDirector) {
          d.answerQuestion((q.correctAnswerIndex + 1) % 4)
        } else {
          d.answerQuestion(q.correctAnswerIndex)
        }
        d.update(3)
      }
    }
    // Sang chuong lightning - do damage sau cung so giay
    const wrongBefore = snapshotHp(wrongDirector)
    const rightBefore = snapshotHp(rightDirector)
    wrongDirector.update(6)
    rightDirector.update(6)
    const wrongDamage = wrongBefore - snapshotHp(wrongDirector)
    const rightDamage = rightBefore - snapshotHp(rightDirector)
    expect(wrongDamage).toBeGreaterThan(rightDamage)
  })

  it('questionSecondsLimit phản ánh limit của câu hỏi hiện tại (mẫu số timer bar)', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    const active = director.getState()
    expect(active).not.toBeNull()
    // Cau dau cua Tam Ma Kiep qi_refining: limit 12s
    expect(active!.questionSecondsRemaining).toBeGreaterThan(0)
    expect(active!.questionSecondsLimit).toBe(12)
    expect(active!.questionSecondsLimit).toBeGreaterThanOrEqual(active!.questionSecondsRemaining)
    // Tick troi 2s -> remaining giam, limit giu nguyen (mau so timer bar)
    director.update(2)
    const ticked = director.getState()!
    expect(ticked.questionSecondsRemaining).toBe(10)
    expect(ticked.questionSecondsLimit).toBe(12)
  })

  // Mission E Task 5 (audit T3-23): getState hands out a detached
  // snapshot - consumer mutation must not corrupt domain state (A3).
  it('getState returns a detached snapshot - mutations do not leak into the director', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')

    const state = director.getState()!
    const hpBefore = state.hp
    state.hp = -999
    expect(director.getState()!.hp).toBe(hpBefore)

    // Nested mutable: currentQuestion must be detached too.
    const question = director.getState()!.currentQuestion!
    ;(question.answers as string[])[0] = 'mutated'
    expect(director.getState()!.currentQuestion!.answers[0]).not.toBe('mutated')
  })

  // E1/E2 regression - the presentation surface obeys the same
  // detachment contract as getState: the snapshot hands out copies of
  // nested-mutable fields, and reading it never writes domain state.
  it('getPresentationSnapshot detaches nested mutable state - caller mutation cannot corrupt gameplay truth', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')

    const session = director.getCurrentPresentationSession()!
    const snap = director.getPresentationSnapshot(session.sessionId)!

    const realCorrect = snap.state.currentQuestion!.correctAnswerIndex
    snap.state.currentQuestion!.correctAnswerIndex = (realCorrect + 1) % 4
    ;(snap.state.currentQuestion!.answers as string[])[0] = 'mutated'

    const fresh = director.getPresentationSnapshot(session.sessionId)!
    expect(fresh.state.currentQuestion!.correctAnswerIndex).toBe(realCorrect)
    expect(fresh.state.currentQuestion!.answers[0]).not.toBe('mutated')

    // The domain truth is intact: the real answer still validates.
    const q = director.getState()!.currentQuestion!
    expect(director.answerQuestion(q.correctAnswerIndex)).toBe(true)
  })

  it('getState and getPresentationSnapshot return independent object graphs', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')

    const session = director.getCurrentPresentationSession()!
    const a = director.getState()!
    const b = director.getPresentationSnapshot(session.sessionId)!

    expect(a.currentQuestion).not.toBe(b.state.currentQuestion)
    expect(a.currentQuestion!.answers).not.toBe(b.state.currentQuestion!.answers)
  })

  it('answerQuestion khi không có câu hỏi active → false (no-op)', () => {
    const { director } = makeDirector()
    expect(director.answerQuestion(0)).toBe(false)
  })

  it('HP về 0 giữa chương → defeat + cooldown', () => {
    const { director } = makeDirector()
    // Kiep Truc Co (3 chuong): KHONG tra loi cau nao (het gio = sai ->
    // stack debuff +20% taken) -> body 10 strikes x 10% x 1.2 = 120%
    // maxHp -> chet giua chuong body.
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 12
    director.start(player, testStats(), false, 'foundation_establishment')
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 500) {
      director.update(1)
    }
    expect(director.getState()!.state).toBe('defeat')
    expect(director.getCooldownSeconds()).toBeGreaterThan(0)
  })

  it('sống sót hết chương cuối → victory', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 2000) {
      director.update(1)
      const q = director.getState()!.currentQuestion
      if (q) director.answerQuestion(q.correctAnswerIndex)
    }
    expect(director.getState()!.state).toBe('victory')
  })

  // Mission E Task 4 (audit T3-21): the documented per-second HP regen
  // must actually apply through the vitals owner.
  it('applies hpRegenPerTurn per elapsed second during ongoing tribulation', () => {
    const { director } = makeDirector()
    const stats = createBaseStats({ maxHp: 5000, defense: 0, hpRegenPerTurn: 100 }) as Stats

    director.start(readyPlayer(), stats, false, 'qi_refining')

    // Clear the mind chapter by answering correctly - regen alone cannot outpace the damage yet.
    let guard = 0
    while (director.getState()!.chapterIndex === 0 && guard++ < 50) {
      const q = director.getState()!.currentQuestion!
      director.answerQuestion(q.correctAnswerIndex)
      director.update(3)
    }

    // Wait for the first strike to pull HP below max.
    guard = 0
    while (snapshotHp(director) >= 5000 && guard++ < 30) {
      director.update(1)
    }
    expect(snapshotHp(director)).toBeLessThan(5000)

    // A small step right after the strike: no new strike within 0.1s
    // (interval >> 0.1) but regen still runs on elapsed time.
    const hpBefore = snapshotHp(director)
    director.update(0.1)
    expect(snapshotHp(director)).toBeGreaterThan(hpBefore)
  })

  it('regen clamps at maxHp - never heals above the snapshot ceiling', () => {
    const { director } = makeDirector()
    const stats = createBaseStats({ maxHp: 5000, defense: 0, hpRegenPerTurn: 10 }) as Stats

    director.start(readyPlayer(), stats, false, 'qi_refining')

    // Mind chapter has no strikes - deterministic window. Force the
    // snapshot 1 HP below max (strike damage arrives in fixed quanta,
    // so the cast stands in for "just below max after a strike").
    const internal = director as unknown as { snapshotHp: number; ghost: { currentHp: number } }
    internal.snapshotHp = 4999
    internal.ghost.currentHp = 4999

    // 0.5s x 10/s = 5 HP healed > 1 missing - the vitals owner clamps
    // to maxHp; lands exactly at 5000, never above.
    director.update(0.5)
    expect(snapshotHp(director)).toBe(5000)
  })

  it('đột phá ẨN: breakthroughType=hidden, grade theo đầu tư (heaven), damage = heaven normal', () => {
    // Design 2026-09-23 sec.4.5: cung mot kiep cho ca hai kieu dot pha -
    // hidden KHONG co profile kho rieng. Mot player hidden-eligible voi
    // dau tu max resolves grade 'heaven' + type 'hidden', va damage
    // nhan dung he so heaven cua mot run normal cung dau tu.
    const normalDirector = makeDirector().director
    const hiddenDirector = makeDirector().director

    normalDirector.start(createHeavenInvestedPlayer(), testStats(), true, 'foundation_establishment')
    hiddenDirector.start(createHiddenEligiblePlayer(), testStats(), true, 'foundation_establishment')

    expect(normalDirector.getState()!.grade).toBe('heaven')
    expect(normalDirector.getState()!.breakthroughType).toBe('normal')
    expect(hiddenDirector.getState()!.grade).toBe('heaven')
    expect(hiddenDirector.getState()!.breakthroughType).toBe('hidden')

    // qua chuong mind bang tra loi dung
    for (const d of [normalDirector, hiddenDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 100) {
        const q = d.getState()!.currentQuestion!
        d.answerQuestion(q.correctAnswerIndex)
        d.update(3)
      }
    }
    // do damage chuong body cung so giay: hidden == normal heaven
    const normalBefore = snapshotHp(normalDirector)
    const hiddenBefore = snapshotHp(hiddenDirector)
    normalDirector.update(10)
    hiddenDirector.update(10)
    const normalDamage = normalBefore - snapshotHp(normalDirector)
    const hiddenDamage = hiddenBefore - snapshotHp(hiddenDirector)
    expect(hiddenDamage).toBe(normalDamage)
  })

  it('unknown realm → start false (framework guard)', () => {
    const { director } = makeDirector()
    expect(director.start(readyPlayer(), testStats(), false, 'golden_core')).toBe(false)
  })

  it('cooldown chặn start lần 2; clear() reset state', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    expect(director.start(readyPlayer(), testStats(), false, 'qi_refining')).toBe(false)
    director.clear()
    expect(director.getState()).toBeNull()
    // clear KHONG xoa cooldown (giu nguyen pattern TribulationSystem cu)
  })

  it('hết giờ 1 câu = sai (stack debuff) — không cần answerQuestion', () => {
    const { director } = makeDirector()
    director.start(readyPlayer(), testStats(), false, 'qi_refining')
    // de troi qua het 3 cau + lightning ma khong tra loi gi
    let guard = 0
    while (director.getState()!.state === 'ongoing' && guard++ < 2000) {
      director.update(1)
    }
    // phai ket thuc (thang hoac thua - HP 5000 co the song qua kiep Nhan Dao)
    expect(['victory', 'defeat']).toContain(director.getState()!.state)
  })

  it('defense mitigates lôi: def 900 → damage giảm còn 1/10 (100/(100+900))', () => {
    const lowDefDirector = makeDirector().director
    const highDefDirector = makeDirector().director
    const lowStats = createBaseStats({ maxHp: 5000, defense: 0 }) as Stats
    const highStats = createBaseStats({ maxHp: 5000, defense: 900 }) as Stats
    lowDefDirector.start(readyPlayer(), lowStats, false, 'qi_refining')
    highDefDirector.start(readyPlayer(), highStats, false, 'qi_refining')
    for (const d of [lowDefDirector, highDefDirector]) {
      let guard = 0
      while (d.getState()!.chapterIndex === 0 && guard++ < 100) {
        const q = d.getState()!.currentQuestion!
        d.answerQuestion(q.correctAnswerIndex)
        d.update(3)
      }
    }
    const lowBefore = snapshotHp(lowDefDirector)
    const highBefore = snapshotHp(highDefDirector)
    lowDefDirector.update(6)
    highDefDirector.update(6)
    const lowDamage = lowBefore - snapshotHp(lowDefDirector)
    const highDamage = highBefore - snapshotHp(highDefDirector)
    expect(lowDamage).toBeGreaterThan(0)
    // cung so strike trong 6s: high def damage ~ low/10 (chap nhan sai so
    // bien strike do interval deu)
    expect(highDamage * 5).toBeLessThan(lowDamage)
  })
})
