import {
  PresentationSession,
  type PresentationMode,
  type SessionPresentationPort,
  type SessionRef,
} from '../presentation/PresentationSession'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { FoundationType } from '../breakthrough/FoundationType'
import type { EventBus } from '../events/EventBus'
import type { TribulationOutcomeResult } from './TribulationOutcomeService'
import { EntityVitalsSystem } from '../combat/EntityVitalsSystem'
import { resolveKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'
import {
  getTribulationChapters,
  GRADE_DIFFICULTY_MULTIPLIER,
  type TribulationChapterProfile,
} from '../../data/tribulation/TribulationChapters'
import { TRIBULATION_MIND_QUESTIONS, type MindQuestion } from '../../data/tribulation/TribulationMindQuestions'
import { getTribulationIntensityMultiplier } from '../talent/TalentEffects'

// TribulationDirector (spec dot-pha-loi-kiep §5) — runtime lôi kiếp
// MỚI thay TribulationSystem: KHÔNG đi qua BattleSystem, không quái
// Kiếp. Tự sở hữu snapshot CombatEntity (maxHp/def/hpRegen thật) + vòng
// lặp chương riêng: Tâm Ma (minigame hỏi đáp) → Thân/Lôi (tank lôi
// %maxHP theo interval, mitigation 100/(100+def) như cũ).
//
// Vòng lặp catch-up lôi dùng dạng đóng (while nextStrikeInSeconds <= 0)
// — CHỦ Ý đứng NGOÀI fixed-step 0.1s của App.vue (cùng lý do floating
// point như TribulationSystem cũ, xem git history).

export type TribulationOutcome = 'ongoing' | 'victory' | 'defeat'

/**
 * M6 / ARCH-006 - the domain-owned committed outcome. commitOutcome
 * stamps this record exactly once per run, bound to the attempt identity
 * (the presentation-session id allocated at start()). The outcome facts
 * are snapshotted here so settlement never re-reads the mutable live
 * state, and the `receipt` slot is the once-only dedup identity:
 * TribulationOutcomeService.settleOutcome fills it on first settle and
 * every later settle returns the SAME receipt instead of re-applying
 * consequences. The record survives rejected/failed route requests -
 * the outcome stays pending until clear() drains the run - which is
 * what makes settlement independent of curtain success.
 */
export interface CommittedTribulationOutcome {
  /** Attempt identity - this run's presentation sessionId. */
  readonly attemptId: number
  readonly outcome: 'victory' | 'defeat'
  readonly targetRealmId: string
  readonly grade: FoundationType
  /** Bound once by the outcome service; presentation renders it. */
  receipt: TribulationOutcomeResult | null
  /**
   * M6 r1 - set by the outcome service when the consequence apply threw
   * mid-flight. The record is then terminal-after-first-attempt: later
   * settle calls see this marker and never re-run the apply, so
   * partially-landed consequences cannot compound.
   */
  settlementError: Error | null
}

export interface ActiveTribulationState {
  targetRealmId: string
  /** Bậc Kiến Cơ đã chốt lúc bấm đột phá (chỉ từ đầu tư trước kiếp). */
  grade: FoundationType
  chapterIndex: number
  chaptersTotal: number
  chapterName: string
  state: TribulationOutcome
  /** Câu hỏi đang hiện (chỉ chương mind giữa 2 câu nghỉ). */
  currentQuestion: MindQuestion | null
  questionSecondsRemaining: number
  /** Tổng giây của câu hỏi hiện tại (đứng đầu) — mẫu số cho timer bar. */
  questionSecondsLimit: number
  /** Tổng thời gian còn lại của CHƯƠNG hiện tại. */
  secondsRemaining: number
  lightningStrikesTaken: number
  hp: number
  maxHp: number
}

// Cooldown thử lại sau thất bại — giữ nguyên 5 phút của hệ cũ.
export const TRIBULATION_COOLDOWN_SECONDS = 5 * 60

// Debuff sai câu (spec §5.3): mỗi lần sai +1 stack, hiệu lực đến hết
// kiếp: +5% damage taken + -3% defense mỗi stack.
const MIND_FAIL_DAMAGE_TAKEN_PER_STACK = 0.05
const MIND_FAIL_DEFENSE_REDUCTION_PER_STACK = 0.03

// Buff đúng câu (spec §5.3 — tự động luân phiên gộp): hồi 8% maxHp +
// giảm 5% damage lôi nhận trong chương tank.
const MIND_CORRECT_HEAL_MAXHP_PERCENT = 0.08
const MIND_CORRECT_LIGHTNING_DAMAGE_REDUCTION = 0.05

interface MindRuntime {
  questions: MindQuestion[]
  currentIndex: number
  secondsRemaining: number
  currentLimitSeconds: number
  restSecondsRemaining: number
}

interface TankRuntime {
  secondsRemaining: number
  nextStrikeInSeconds: number
  finalStrikeFired: boolean
}

export class TribulationDirector {
  private readonly vitals: EntityVitalsSystem
  private active: ActiveTribulationState | null = null
  private chapters: readonly TribulationChapterProfile[] = []
  /**
   * Ghost entity for EntityVitalsSystem so it emits standard
   * 'entity_vitals_changed' events (scene/HUD render from them). Real damage
   * applies to the snapshot fields; this entity is only the event channel.
   */
  private ghost: CombatEntity | null = null
  private snapshotHp = 0
  private snapshotMaxHp = 0
  private snapshotDefense = 0
  private cooldownUntil = 0
  private mind: MindRuntime | null = null
  private tank: TankRuntime | null = null
  private mindFailStacks = 0
  private mindCorrectLightningReduction = 0
  // M6 / ARCH-006 - the committed outcome record for the current run,
  // bound to attemptId (the session id allocated at start()).
  private committedOutcome: CommittedTribulationOutcome | null = null
  private attemptId = 0
  // Talent v4 M2 — Loi Kiep: snapshot of the player's tribulation
  // intensity multiplier, captured at start() so the whole kiếp obeys
  // the talent that was held when it began (neutral 1 otherwise).
  private lightningTalentMultiplier = 1
  private readonly presentationSession: PresentationSession
  private presentationMode: PresentationMode = 'headless'

  constructor(private readonly deps: { eventBus: EventBus; sessionAllocator?: { allocate(): number } }) {
    this.vitals = new EntityVitalsSystem(deps.eventBus)
    this.presentationSession = new PresentationSession(deps.sessionAllocator)
  }

  getCurrentPresentationSession(): SessionRef | null {
    return this.presentationSession.getCurrentSession()
  }

  getPresentationPort(): SessionPresentationPort {
    return this.presentationSession
  }

  setPresentationMode(mode: PresentationMode): void {
    this.presentationMode = mode
  }

  getPresentationSnapshot(sessionId: number): { sessionId: number; state: ActiveTribulationState } | null {
    const current = this.presentationSession.getCurrentSession()
    if (!current || current.sessionId !== sessionId || current.kind !== 'tribulation') {
      return null
    }
    if (!this.active) {
      return null
    }
    return {
      sessionId,
      state: this.snapshotActiveState(),
    }
  }

  /**
   * Bắt đầu kiếp: resolve bậc từ đầu tư TRƯỚC kiếp (spec §2.1) + snapshot
   * stats thật. Trả false nếu đang trong kiếp / cooldown / realm chưa có
   * profile chương. `hasTrucCoDan` chỉ ý nghĩa với gate Trúc Cơ.
   */
  start(player: PlayerData, playerStats: Stats, hasTrucCoDan: boolean, targetRealmId: string): boolean {
    if (this.getCooldownSeconds() > 0 || this.active) {
      return false
    }

    const chapters = getTribulationChapters(targetRealmId)

    if (!chapters || chapters.length === 0) {
      return false
    }

    const grade = resolveKienCoGrade(player, hasTrucCoDan)
    const maxHp = Math.max(1, playerStats.maxHp)

    this.chapters = chapters
    this.snapshotMaxHp = maxHp
    this.snapshotHp = maxHp
    this.snapshotDefense = Math.max(0, playerStats.defense)
    // Entity ma chỉ mang HP/def — vitals events shape chuẩn cho UI.
    this.ghost = {
      id: 'player',
      name: player.name,
      type: 'player',
      baseStats: playerStats,
      stats: playerStats,
      currentHp: maxHp,
      maxHp,
      currentMp: 0,
      alive: true,
    } as CombatEntity
    this.mindFailStacks = 0
    this.mindCorrectLightningReduction = 0
    // M6 - a fresh run carries no committed outcome; its attempt identity
    // is the session id allocated below.
    this.committedOutcome = null
    this.lightningTalentMultiplier = getTribulationIntensityMultiplier(
      player.selectedTalentIds,
    )

    this.active = {
      targetRealmId,
      grade,
      chapterIndex: 0,
      chaptersTotal: chapters.length,
      chapterName: chapters[0]!.name,
      state: 'ongoing',
      currentQuestion: null,
      questionSecondsRemaining: 0,
      questionSecondsLimit: 0,
      secondsRemaining: 0,
      lightningStrikesTaken: 0,
      hp: maxHp,
      maxHp,
    }

    const sessionId = this.presentationSession.allocate()
    this.attemptId = sessionId
    const session: SessionRef = { kind: 'tribulation', sessionId }
    this.presentationSession.begin(session, this.presentationMode)
    if (this.presentationMode === 'interactive') {
      this.presentationSession.hold(session)
    }

    this.enterChapter(0)

    this.deps.eventBus.emit('tribulation_started', {
      targetRealmId,
      grade,
      chapterIndex: 0,
      kind: chapters[0]!.kind,
    })

    this.deps.eventBus.emit('presentation_session_started', session)

    return true
  }

  /**
   * Tick thời gian (gọi từ App.vue mỗi frame/tick). Catch-up window:
   * chỉ tiêu thụ phần delta thuộc chương hiện tại rồi xử lý mốc strike
   * trong vòng lặp đóng — không chia nhỏ fixed-step (floating point).
   */
  update(deltaSeconds: number) {
    if (this.presentationSession.isBlocking()) {
      return
    }

    const active = this.active

    if (!active || active.state !== 'ongoing') {
      return
    }

    // Background-tab catch-up (Chromium batches many seconds into one
    // tick): cap each update at the chapter remainder so the outcome
    // cannot be skipped - the residual drains next tick, same pattern
    // as the old elapsedInTribulation.
    let remaining = Math.max(0, deltaSeconds)

    while (remaining > 0 && active.state === 'ongoing') {
      const step = Math.min(remaining, 1)
      this.tickStep(step)
      remaining -= step

      // Mission E Task 4 (audit T3-21): HP regen per elapsed second.
      // `hpRegenPerTurn` is reused as the per-second rate inside
      // tribulation's 1-second step - tribulation has no turns. The
      // vitals owner applies the maxHp clamp, healing-effectiveness
      // scaling and the 'regen' event; we only mirror the result.
      if (active.state === 'ongoing' && this.ghost) {
        const applied = this.vitals.applyTurnRegen(
          this.ghost,
          { hp: (this.ghost.stats.hpRegenPerTurn ?? 0) * step },
          'player',
        )
        if (applied.hp > 0) {
          this.snapshotHp = this.ghost.currentHp
        }
      }
    }

    if (active.state === 'ongoing' && this.snapshotHp > 0) {
      this.emitState()
    }
  }

  private tickStep(step: number) {
    const active = this.active!
    const chapter = this.chapters[active.chapterIndex]

    if (!chapter) {
      return
    }

    if (chapter.kind === 'mind') {
      this.tickMind(step, chapter)
    } else {
      this.tickTank(step, chapter)
    }
  }

  private tickMind(step: number, _chapter: TribulationChapterProfile) {
    const active = this.active!
    const mind = this.mind!

    // Đang nghỉ giữa 2 câu — lôi nền KHÔNG chạy trong chương mind
    // (chương mind thuần hỏi đáp, buff/debuff áp từ chương tank).
    if (mind.restSecondsRemaining > 0) {
      mind.restSecondsRemaining = Math.max(0, mind.restSecondsRemaining - step)
      active.currentQuestion = null
      this.beginQuestionIfReady()
      return
    }

    mind.secondsRemaining -= step
    active.questionSecondsRemaining = Math.max(0, mind.secondsRemaining)

    if (mind.secondsRemaining <= 0) {
      // Hết giờ = SAI (spec §5.3)
      this.applyMindFailure()
      this.advanceQuestion()
    }
  }

  private beginQuestionIfReady() {
    const mind = this.mind
    const active = this.active!

    if (!mind || mind.restSecondsRemaining > 0 || mind.currentIndex >= mind.questions.length) {
      return
    }

    active.currentQuestion = mind.questions[mind.currentIndex] ?? null
  }

  private advanceQuestion() {
    const active = this.active!
    const mind = this.mind!
    const profile = this.chapters[active.chapterIndex]!.mind!
    const total = profile.questionCount

    mind.currentIndex += 1
    active.currentQuestion = null

    if (mind.currentIndex >= total) {
      // Hết câu — chuyển chương kế
      this.enterChapter(active.chapterIndex + 1)
      return
    }

    // Nội suy timer giữa câu đầu → câu cuối
    const t = total <= 1 ? 0 : mind.currentIndex / (total - 1)
    const limit =
      profile.firstQuestionSeconds +
      (profile.lastQuestionSeconds - profile.firstQuestionSeconds) * t
    mind.currentLimitSeconds = limit
    mind.secondsRemaining = limit
    active.questionSecondsRemaining = limit
    active.questionSecondsLimit = limit
    mind.restSecondsRemaining = profile.restSecondsBetweenQuestions
  }

  /** Trả lời câu hiện tại — true nếu câu được xử lý (đúng/sai đều tính). */
  answerQuestion(answerIndex: number): boolean {
    if (this.presentationSession.isBlocking()) {
      return false
    }

    const active = this.active
    const mind = this.mind

    if (!active || active.state !== 'ongoing' || !mind || mind.restSecondsRemaining > 0) {
      return false
    }

    const question = mind.questions[mind.currentIndex]

    if (!question || active.currentQuestion?.id !== question.id) {
      return false
    }

    if (answerIndex === question.correctAnswerIndex) {
      this.applyMindSuccess()
      this.deps.eventBus.emit('mind_question_result', { correct: true, questionId: question.id })
    } else {
      this.applyMindFailure()
      this.deps.eventBus.emit('mind_question_result', { correct: false, questionId: question.id })
    }

    this.advanceQuestion()

    return true
  }

  private applyMindSuccess() {
    // Buff tự động gộp (spec §5.3 — không chọn): hồi máu + kháng lôi
    this.mindCorrectLightningReduction += MIND_CORRECT_LIGHTNING_DAMAGE_REDUCTION
    const healed = this.vitals.applyHealing(
      this.ghost!,
      this.snapshotMaxHp * MIND_CORRECT_HEAL_MAXHP_PERCENT,
      'healing',
      'tribulation_mind',
    )
    this.snapshotHp = Math.min(this.snapshotMaxHp, this.snapshotHp + healed)
    this.ghost!.currentHp = this.snapshotHp
  }

  private applyMindFailure() {
    this.mindFailStacks += 1
  }

  private tickTank(step: number, chapter: TribulationChapterProfile) {
    const active = this.active!
    const tank = this.tank!

    tank.secondsRemaining = Math.max(0, tank.secondsRemaining - step)
    active.secondsRemaining = tank.secondsRemaining
    tank.nextStrikeInSeconds -= step

    // Vòng strike catch-up đóng — interval > 0 guard chống vòng vô hạn
    // Liveness = state 'ongoing': a lethal strike commits 'defeat' inside
    // the loop; exit immediately, no further strikes (M5 / ARCH-006).
    const interval = this.effectiveStrikeInterval(chapter)

    while (interval > 0 && tank.nextStrikeInSeconds <= 0 && active.state === 'ongoing') {
      this.strikeLightning(chapter)
      tank.nextStrikeInSeconds += interval
    }

    // Recheck liveness after a phase that may kill the actor: once the
    // outcome is committed there is no final strike and no chapter
    // advance (M5 / ARCH-006).
    if (active.state !== 'ongoing') {
      return
    }

    // Đại lôi cuối chương (chỉ lightning có finalStrike)
    const profile = chapter.tank!
    if (
      profile.finalStrikeMaxHpDamagePercent !== undefined &&
      !tank.finalStrikeFired &&
      tank.secondsRemaining <= 0
    ) {
      this.applyLightningDamage(profile.finalStrikeMaxHpDamagePercent)
      tank.finalStrikeFired = true
    }

    // Recheck liveness again - the final strike may also be lethal.
    if (active.state !== 'ongoing') {
      return
    }

    if (tank.secondsRemaining <= 0) {
      this.enterChapter(active.chapterIndex + 1)
    }
  }

  /** Interval chia cho hệ số bậc — bậc cao lôi dồn dập hơn (spec §5.5). */
  private effectiveStrikeInterval(chapter: TribulationChapterProfile): number {
    const base = chapter.tank!.strikeIntervalSeconds
    const multiplier = GRADE_DIFFICULTY_MULTIPLIER[this.active!.grade] ?? 1

    return base / multiplier
  }

  private strikeLightning(chapter: TribulationChapterProfile) {
    const active = this.active!

    // Terminal guard - after a committed outcome there is no strike to
    // report (a lightning event must pair with real damage, M5 / ARCH-006).
    if (active.state !== 'ongoing') {
      return
    }

    this.applyLightningDamage(chapter.tank!.lightningMaxHpDamagePercent)
    active.lightningStrikesTaken += 1
    this.deps.eventBus.emit('tribulation_lightning', { targetId: 'player' })
  }

  private applyLightningDamage(maxHpPercent: number) {
    const active = this.active!

    // Terminal guard - no damage processing once the outcome is committed.
    if (active.state !== 'ongoing') {
      return
    }

    const multiplier = GRADE_DIFFICULTY_MULTIPLIER[active.grade] ?? 1

    // Debuff sai câu: +% damage taken + -% defense (spec §5.3)
    const defense = Math.max(
      0,
      this.snapshotDefense * (1 - MIND_FAIL_DEFENSE_REDUCTION_PER_STACK * this.mindFailStacks),
    )
    const mitigation = 100 / (100 + defense)
    const takenMultiplier = 1 + MIND_FAIL_DAMAGE_TAKEN_PER_STACK * this.mindFailStacks
    // Buff đúng câu: -% damage lôi (kháng lôi gộp, spec §5.3)
    const reduction = Math.min(0.8, this.mindCorrectLightningReduction)

    const raw =
      this.snapshotMaxHp *
      maxHpPercent *
      multiplier *
      this.lightningTalentMultiplier *
      mitigation *
      takenMultiplier *
      (1 - reduction)

    const applied = this.vitals.applyDamage(this.ghost!, raw, 'heavenly_tribulation', 'tribulation')
    this.snapshotHp = Math.max(0, this.snapshotHp - applied)
    // Đồng bộ ghost.currentHp cho event/tick kế (vitals đã mutate ghost —
    // ghost là kênh event, snapshot là nguồn sự thật của Director).
    this.ghost!.currentHp = this.snapshotHp
    this.ghost!.alive = this.snapshotHp > 0

    if (this.snapshotHp <= 0) {
      this.commitOutcome('defeat')
    }
  }

  /**
   * Single terminal-transition site (M5 / ARCH-006): a run commits exactly
   * one outcome. Calling it while already terminal is a no-op - no state
   * write, no second 'tribulation_outcome' emission.
   */
  private commitOutcome(outcome: 'victory' | 'defeat') {
    const active = this.active

    if (!active || active.state !== 'ongoing') {
      return
    }

    active.state = outcome

    // M6 / ARCH-006 - stamp the domain-owned settlement record at the
    // same single commit site. From here the resolved outcome has an
    // identity (attemptId) and a once-only receipt slot; consequences
    // settle against this record, not against the mutable live state or
    // the curtain lifecycle.
    this.committedOutcome = {
      attemptId: this.attemptId,
      outcome,
      targetRealmId: active.targetRealmId,
      grade: active.grade,
      receipt: null,
      settlementError: null,
    }

    if (outcome === 'defeat') {
      this.cooldownUntil = Date.now() + TRIBULATION_COOLDOWN_SECONDS * 1000
    }

    this.deps.eventBus.emit('tribulation_outcome', { state: outcome })
  }

  private enterChapter(index: number) {
    const active = this.active!

    // Terminal guard (M5 / ARCH-006): once an outcome is committed there
    // is no chapter advance - in particular 'victory' never overwrites a
    // committed 'defeat'.
    if (active.state !== 'ongoing') {
      return
    }

    // Hết chương cuối còn sống → victory
    if (index >= this.chapters.length) {
      active.currentQuestion = null
      active.chapterName = ''
      this.mind = null
      this.tank = null
      this.commitOutcome('victory')
      return
    }

    const chapter = this.chapters[index]!
    active.chapterIndex = index
    active.chapterName = chapter.name
    active.currentQuestion = null
    active.lightningStrikesTaken = 0

    this.deps.eventBus.emit('tribulation_chapter_changed', {
      chapterIndex: index,
      kind: chapter.kind,
      name: chapter.name,
    })

    if (chapter.kind === 'mind' && chapter.mind) {
      const profile = chapter.mind
      const pool = TRIBULATION_MIND_QUESTIONS.filter((q) => q.realmId === active.targetRealmId)

      // Không đủ câu trong bank thì lặp pool (defensive — data test đã
      // khóa bank đủ ≥ questionCount + 1).
      const questions: MindQuestion[] = []
      for (let i = 0; i < profile.questionCount; i++) {
        questions.push(pool[i % pool.length]!)
      }

      this.mind = {
        questions,
        currentIndex: 0,
        secondsRemaining: profile.firstQuestionSeconds,
        currentLimitSeconds: profile.firstQuestionSeconds,
        restSecondsRemaining: 0,
      }
      this.tank = null
      active.currentQuestion = questions[0] ?? null
      active.questionSecondsRemaining = profile.firstQuestionSeconds
      active.questionSecondsLimit = profile.firstQuestionSeconds
      active.secondsRemaining = 0
      return
    }

    // body/lightning
    const tank = chapter.tank!
    this.mind = null
    this.tank = {
      secondsRemaining: tank.durationSeconds,
      nextStrikeInSeconds: this.effectiveStrikeInterval(chapter),
      finalStrikeFired: false,
    }
    active.secondsRemaining = tank.durationSeconds
    active.questionSecondsRemaining = 0
    active.questionSecondsLimit = 0
  }

  private emitState() {
    const active = this.active

    if (active) {
      active.hp = this.snapshotHp
    }
  }

  /**
   * E1/E2 - the ONE detached-state builder for every query surface
   * (getState, getPresentationSnapshot). A query is observational: it
   * copies `active` + the nested-mutable currentQuestion and overrides
   * hp from the snapshot authority - it never writes this.active (A3).
   * Internal hp sync stays the domain lifecycle writer (emitState).
   */
  private snapshotActiveState(): ActiveTribulationState {
    const active = this.active!

    return {
      ...active,
      hp: this.snapshotHp,
      currentQuestion: active.currentQuestion
        ? { ...active.currentQuestion, answers: [...active.currentQuestion.answers] }
        : null,
    }
  }

  getState(): ActiveTribulationState | null {
    return this.active ? this.snapshotActiveState() : null
  }

  /**
   * The committed terminal outcome awaiting settlement/drain for the
   * current run, or null while the run is ongoing, absent, or already
   * drained. This is the domain-owned once-only settlement slot (M6 /
   * ARCH-006): it exists only because commitOutcome ran, and it survives
   * until clear() - so a rejected route request leaves the outcome
   * pending for the next tick, and a duplicate tick re-reads the same
   * record (and its already-bound receipt).
   */
  getCommittedOutcome(): CommittedTribulationOutcome | null {
    return this.committedOutcome
  }

  clear() {
    const session = this.presentationSession.getCurrentSession()
    if (session) {
      this.presentationSession.end(session)
    }
    this.active = null
    this.mind = null
    this.tank = null
    this.committedOutcome = null
  }

  getCooldownSeconds(now = Date.now()): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - now) / 1000))
  }
}
