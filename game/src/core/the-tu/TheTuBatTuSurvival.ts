import type { CombatEntity } from '../combat/CombatEntity'
import type { SurviveLethalResult, SurviveLethalSource } from '../combat/CombatSystem'
import type { TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import { BAT_TU_BA_THE_TURNS } from '../../data/skill/TheTuSkills'

/**
 * The Tu Reimagined (spec 2026-09-15 section 5.1, plan Task 9, D9) —
 * Bat Tu Ba The survive-lethal source for a Cuong Chien participant.
 *
 * Ordering contract: this source is inserted BEFORE the talent guard in
 * the CombatSystem survive session — the ultimate is the first line of
 * survival; the talent charge is the extra life once the ult is spent.
 *
 * Three outcomes, evaluated per lethal hit:
 *   1. bat_tu_ba_the buff already active -> free survive. No re-grant,
 *      no duration refresh, no cooldown touch (review-#6 fix), no
 *      cleanse — cleanseDebuffs:false on every return keeps
 *      CombatSystem's generic !==false blanket wipe from running on
 *      repeat lethals inside the window.
 *   2. Ultimate slot off cooldown -> consume the cooldown, grant the
 *      buff at the slot's baked durationOverride (participant-build
 *      resolved: base + batTuDurationBonus — ONE resolved value shared
 *      with the manual cast path, review P0.2). CC strip comes ONLY
 *      from BAT_TU_BA_THE_BUFF.clearsCcOnApply on the grant path —
 *      non-cc debuffs (poison/bleed/stat debuffs) are never cleansed.
 *   3. Ultimate on cooldown -> survived:false; the talent guard may
 *      still save the holder.
 *
 * The grant itself is applied by CombatSystem.killIfDead through the
 * session's SurviveEffectsPolicy — this source only decides and
 * declares; HP/buff mutation stays in the vitals/buff authority.
 */
export class TheTuBatTuSurvival implements SurviveLethalSource {
  constructor(private readonly deps: {
    /** Live read of the participant's ultimate slot (cooldown mutates mid-battle). */
    ultimateSlot: () => TurnSkillSlot | undefined
    /** buff2 M4 — live read of the holder's active instances for a
        definitionId (the composition root binds the battle's
        BuffSystem.getForTarget). */
    hasActiveBuff: (definitionId: BuffDefinitionId) => boolean
  }) {}

  trySurvive(_entity: CombatEntity): SurviveLethalResult {
    // Active buff -> free survive. Presence in the pool = unexpired:
    // remainingTurns ticks only on the holder's own turns.
    // cleanseDebuffs:false — without it the undefined !== false check
    // in killIfDead blanket-cleansed EVERY debuff on each repeat lethal.
    if (this.deps.hasActiveBuff('bat_tu_ba_the' as BuffDefinitionId)) {
      return { survived: true, cleanseDebuffs: false }
    }

    const slot = this.deps.ultimateSlot()

    if (!slot || slot.remainingCooldownTurns > 0) {
      return { survived: false }
    }

    slot.remainingCooldownTurns = slot.skill.cooldownTurns

    // The participant-build clone carries the node-resolved duration on
    // the same appliesBuffs application the manual cast consumes —
    // reading it here keeps passive and manual grants identical.
    const application = slot.skill.appliesBuffs?.find(
      (entry) => entry.definitionId === 'bat_tu_ba_the',
    )

    return {
      survived: true,
      grantBuffId: 'bat_tu_ba_the' as BuffDefinitionId,
      grantBuffDurationOverride: application?.durationOverride ?? BAT_TU_BA_THE_TURNS,
      // Spec: only hard CC is cleansed, via the granted buff's
      // clearsCcOnApply (CombatSystem grant path). No blanket debuff wipe.
      cleanseDebuffs: false,
    }
  }
}
