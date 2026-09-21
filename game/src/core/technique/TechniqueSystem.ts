import type { ItemQuality } from '../item/ItemQuality'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import type { Technique } from './Technique'
import { TechniqueManager } from './TechniqueManager'
import {
  getTechniqueGradeCeiling,
  getTechniqueMasteryForNextRank,
  TECHNIQUE_RANK_CAP,
} from './TechniqueProgression'

// P7-M3 - canonical technique progression authority. The retired
// learn/equip/unequip list semantics are gone: the Way grants its one
// canonical technique at initiation, mastery accrues ranks inside the
// current grade, and the grade-advance transaction lives on
// GameManagerRealmAdvanceOps (material spend) calling
// advanceTechniqueGrade here.
export class TechniqueSystem {
  constructor(private readonly manager: TechniqueManager) {}

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
    }))

    return true
  }

  /**
   * Accrue mastery into the active technique. Ranks cascade while
   * mastery covers the per-rank cost (300 x grade). Only the amount
   * needed to reach the rank cap is consumed - at rank 10 mastery is
   * 0 and further input is discarded; `gained` reports the consumed
   * amount so callers record honest reward summaries.
   */
  gainMastery(amount: number): { gained: number; rankUps: number } {
    const technique = this.manager.getActive()
    if (!technique || technique.rank >= TECHNIQUE_RANK_CAP || amount <= 0) {
      return { gained: 0, rankUps: 0 }
    }

    const cost = getTechniqueMasteryForNextRank(technique.grade)
    const needed = cost * (TECHNIQUE_RANK_CAP - technique.rank) - technique.mastery
    const consumed = Math.min(amount, needed)

    technique.mastery += consumed
    let rankUps = 0
    while (technique.mastery >= cost && technique.rank < TECHNIQUE_RANK_CAP) {
      technique.rank += 1
      technique.mastery -= cost
      rankUps += 1
    }
    if (technique.rank >= TECHNIQUE_RANK_CAP) {
      technique.mastery = 0
    }

    return { gained: consumed, rankUps }
  }

  /**
   * Grade-advance writer - preconditions (rank cap, realm ceiling,
   * material spend) are checked by the orchestrator
   * (GameManagerRealmAdvanceOps.tryAdvanceTechniqueGrade).
   */
  advanceTechniqueGrade(): boolean {
    const technique = this.manager.getActive()
    if (!technique || technique.rank < TECHNIQUE_RANK_CAP) {
      return false
    }

    technique.grade += 1
    technique.rank = 0
    technique.mastery = 0
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
