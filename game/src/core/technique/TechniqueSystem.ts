import type { ItemQuality } from '../item/ItemQuality'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { getRealmIndex } from '../realm/realmSystem'
import type { Technique } from './Technique'
import { TechniqueManager } from './TechniqueManager'
import {
  computeTechniqueGradeInheritance,
  getTechniqueGradeCeiling,
  getTechniqueMasteryForNextRank,
  getTechniqueRankCeiling,
  resolveTechniqueCompletionState,
} from './TechniqueProgression'

// P7-M3 - canonical technique progression authority. The retired
// learn/equip/unequip list semantics are gone: the Way grants its one
// canonical technique at initiation, mastery accrues ranks inside the
// current grade, and the grade-advance transaction lives on
// GameManagerRealmAdvanceOps (material spend) calling
// advanceTechniqueGrade here.
export class TechniqueSystem {
  // P7-M6 - read-only mirror publisher: fires the holder's {rank, grade}
  // to the PlayerData techniqueProgress field exactly where the pair can
  // change (grant/rank-up/grade-advance/restore). GameManager binds the
  // sink to the active player; NodeSystem's techniqueRank/techniqueGrade
  // prerequisites read the mirror because hasPrerequisite only sees
  // PlayerData (same contract as SkillSystem's castCountSink).
  private progressSink?: (progress: { rank: number; grade: number } | null) => void

  constructor(private readonly manager: TechniqueManager) {}

  setProgressSink(sink: (progress: { rank: number; grade: number } | null) => void): void {
    this.progressSink = sink
  }

  private publishProgress(): void {
    const active = this.manager.getActive()

    this.progressSink?.(active ? { rank: active.rank, grade: active.grade } : null)
  }

  /**
   * Session-restore boundary routed through the single writer: restores
   * the canonical holder AND republishes the mirror, so a stale or
   * forged persisted techniqueProgress self-corrects on every restore.
   */
  restore(techniques: Technique[]): void {
    this.manager.restore(techniques)
    this.publishProgress()
  }

  /**
   * Grant the Way's canonical technique. `realmId` is the player's
   * committed realm AFTER the initiation promotion (qi_refining) -
   * grade ceiling is enforced against it. Empty holder -> grant;
   * same-id -> defensive noop (returns true); different-id -> refuse.
   */
  grant(template: Technique, realmId: string): boolean {
    const active = this.manager.getActive()

    if (active) {
      return active.id === template.id
    }

    if (template.grade > getTechniqueGradeCeiling(realmId)) {
      return false
    }

    this.manager.setActive(structuredClone({
      ...template,
      rank: 0,
      mastery: 0,
      quality: template.quality,
      gradeHistory: {},
    }))
    this.publishProgress()

    return true
  }

  /**
   * M-F-TECHNIQUE - accrue mastery into the live cycle. Ranks
   * cascade while mastery covers the per-rank cost (300 x grade) and
   * the realm-scaled ceiling permits (min(18, realmLevel) while the
   * live grade matches the realm band; a lagging/sealed cycle cannot
   * train - ceiling 0). Only the amount needed to reach the ceiling
   * is consumed - the rest is discarded, same convention as the
   * retired at-cap discard; `gained` reports the consumed amount so
   * callers record honest reward summaries.
   */
  gainMastery(amount: number, realmId: string, realmLevel: number): { gained: number; rankUps: number } {
    const technique = this.manager.getActive()
    if (!technique || amount <= 0) {
      return { gained: 0, rankUps: 0 }
    }

    const ceiling = getTechniqueRankCeiling(technique, realmId, realmLevel)
    if (ceiling <= 0 || technique.rank >= ceiling) {
      return { gained: 0, rankUps: 0 }
    }

    const cost = getTechniqueMasteryForNextRank(technique.grade)
    const needed = cost * (ceiling - technique.rank) - technique.mastery
    const consumed = Math.min(amount, needed)

    technique.mastery += consumed
    let rankUps = 0
    while (technique.mastery >= cost && technique.rank < ceiling) {
      technique.rank += 1
      technique.mastery -= cost
      rankUps += 1
    }
    if (technique.rank >= ceiling) {
      technique.mastery = 0
    }

    // Mastery itself is unmirrored - republish only when rank moved.
    if (rankUps > 0) {
      this.publishProgress()
    }

    return { gained: consumed, rankUps }
  }

  /**
   * M-F-TECHNIQUE (F4) - realm-exit freeze: seals the live cycle's
   * outcome into gradeHistory when the NEW realm's index exceeds the
   * live grade. Write-if-absent (sealed records are immutable; a
   * repeat call after the grade caught up is a no-op).
   * `departedRealmLevel` is the freeze-time ceiling dai_thanh
   * evaluates against - callers pass the pre-write realmLevel.
   */
  sealFrozenCycle(newRealmId: string, departedRealmLevel: number): boolean {
    const technique = this.manager.getActive()
    if (!technique || getRealmIndex(newRealmId) <= technique.grade) {
      return false
    }

    if (technique.gradeHistory[technique.grade] === undefined) {
      technique.gradeHistory[technique.grade] = {
        finalRank: technique.rank,
        completionState: resolveTechniqueCompletionState(technique.rank, departedRealmLevel),
      }
    }
    return true
  }

  /**
   * M-F-TECHNIQUE (F4) - grade-advance catch-up transaction. In
   * order: seal the outgoing cycle write-if-absent (defensive - the
   * realm-exit seam always sealed a lagging grade; a never-sealed
   * record resolves via resolveTechniqueCompletionState(rank, 0),
   * unreachable under v75 and never dai_thanh), grade+1, skipped-
   * entry seal iff the NEW grade still lags the realm ({finalRank:0,
   * 'partial'} at entry - every lagging live grade stays
   * record-covered), rank/mastery 0, build preserved verbatim
   * (quality + template identity), monotonic inheritance applied
   * from the OUTGOING sealed record, mirror republished.
   * Preconditions (catch-up check, combat guard, material spend)
   * live on GameManagerRealmAdvanceOps.tryAdvanceTechniqueGrade.
   */
  advanceTechniqueGrade(realmId: string): boolean {
    const technique = this.manager.getActive()
    const realmIndex = getRealmIndex(realmId)
    // grade < 1 mirrors canAdvanceTechniqueGrade: a forged grade-0
    // holder must never seal a non-canonical key-0 record.
    if (!technique || technique.grade < 1 || technique.grade >= realmIndex) {
      return false
    }

    const outgoingRecord =
      technique.gradeHistory[technique.grade] ??
      { finalRank: technique.rank, completionState: resolveTechniqueCompletionState(technique.rank, 0) }
    technique.gradeHistory[technique.grade] ??= outgoingRecord

    technique.grade += 1

    // Skipped-entry seal (pinned order: immediately after the grade
    // write, before the rank/mastery reset): a grade entered still
    // below the band is born sealed {0,'partial'}.
    if (technique.grade < realmIndex) {
      technique.gradeHistory[technique.grade] ??= { finalRank: 0, completionState: 'partial' }
    }

    technique.rank = 0
    technique.mastery = 0

    // Inheritance scaffold: computed from the OUTGOING sealed record
    // and applied here. The payload carries no fields yet (authored
    // coefficients are a balance pass) and the pinned contract is
    // that it never grants rank or mastery - the new cycle keeps
    // rank == 0 && mastery == 0 after application.
    const _inheritance = computeTechniqueGradeInheritance(outgoingRecord)

    this.publishProgress()
    return true
  }

  /** Quality axis is display-level today - the seam exists for M5+. */
  setTechniqueQuality(quality: ItemQuality): boolean {
    const technique = this.manager.getActive()
    if (!technique || !ITEM_QUALITY_ORDER.includes(quality)) {
      return false
    }

    technique.quality = quality
    return true
  }
}
