/**
 * R8.2 - Domain owner of tribulation outcome consequences (AR-10).
 *
 * This service is the single authority that turns a finished tribulation
 * (TribulationDirector state 'victory' | 'defeat') into permanent
 * progression outcomes: realm entry, level/cultivation reset, foundation
 * recording, talent conversion, defeat penalties (cultivation loss,
 * spirit-stone loss, Kiep Thuong debuff), and the permanent Great Dao
 * opportunity loss. It returns a typed result; the Vue adapter only
 * displays it and sequences presentation (A7).
 *
 * Migrated verbatim (2026-09-11) from useTribulation.ts resolveVictory /
 * resolveDefeat - behavior parity is pinned by
 * TribulationOutcomeService.test.ts and the pre-existing dotPha/artifact
 * characterization tests.
 *
 * Writer contract (A3/A6): the caller passes a STRUCTURAL writer for the
 * player-state fields this service owns. In production that is the Pinia
 * player store - it must be the store instance, NOT `store.$state`:
 * writing an absent optional key (highestFoundationAchieved) on the raw
 * $state object does not reflect through the store proxy (probe evidence
 * 2026-09-11), while a write on the store proxy does. The same writer
 * object is handed to GameManager methods (a Pinia store instance
 * satisfies PlayerData structurally), so core stays Pinia-free via
 * structural typing; no store import.
 */
import type { FoundationType } from '../breakthrough/FoundationType'
import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import type { GameManager } from '../game/GameManager'
import type { TribulationDirector } from './TribulationDirector'
import type { TalentEntitlement } from '../talent/TalentEntitlement'
import type { OutcomeAnnouncement } from '../presentation/OutcomeAnnouncement'
import { getCurrentRealm } from '../realm/realmSystem'
import { pourCultivationOvercharge } from '../cultivation/CultivationSystem'
import { getTribulationVictoryStatPercent } from '../talent/TalentEffects'
import { createTalentEntitlement } from '../talent/TalentEntitlement'
import { getRealmTier } from '../realm/RealmTierMap'
import { FOUNDATION_LABELS } from '../breakthrough/FoundationType'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { KIEP_THUONG_DEBUFF } from '../../data/buff/buffs'
import {
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
  TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM,
  TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK,
} from '../../data/tribulation/TribulationChapters'

/** Victory outcome facts for presentation. */
export interface TribulationVictoryResult {
  kind: 'victory'
  /** Realm entered, or null when the victory only announces (Quan Khi). */
  realmEntered: string | null
  /** Realm display name for the announcement. */
  realmName: string
  /** Foundation grade achieved (foundation_establishment only). */
  foundationGrade?: FoundationType
  /** True when the Great Dao talent conversion was applied. */
  talentConverted: boolean
  /** Standalone panel to open (Quan Khi flow), if any. */
  standalonePanel?: 'quan_khi'
  /** R8.1 glue: quest lifecycle reconcile was requested for the tick. */
  questRealmTransitionMarked: boolean
  /** i18n descriptor - the adapter resolves keys via t() (P16). */
  announcement: OutcomeAnnouncement
}

/** Defeat outcome facts for presentation. */
export interface TribulationDefeatResult {
  kind: 'defeat'
  cultivationLossPercent: number
  spiritStoneId: string
  spiritStonesLost: number
  greatDaoOpportunityLost: boolean
  /** i18n descriptor - the adapter resolves keys via t() (P16). */
  announcement: OutcomeAnnouncement
}

export type TribulationOutcomeResult = TribulationVictoryResult | TribulationDefeatResult

/**
 * The outcome facts a settlement needs from the finished run. Both the
 * live ActiveTribulationState and the domain-owned CommittedTribulationOutcome
 * record satisfy this shape - M6 settles against the committed record,
 * never re-derived from mutable live state.
 */
export interface TribulationOutcomeFacts {
  readonly targetRealmId: string
  readonly grade: FoundationType
}

/**
 * Writer over the player state this service owns. Extends PlayerData so
 * the SAME object flows into GameManager methods without casts. In
 * production the caller passes the Pinia player store INSTANCE - never
 * `store.$state`: writing an absent optional key (highestFoundationAchieved)
 * on the raw $state object does not reflect through the store proxy
 * (probe evidence 2026-09-11), while a write on the store proxy does.
 * The redundant field re-declarations below keep the owned outcome
 * surface explicit and greppable (the AR-10 inventory).
 */
export interface TribulationPlayerWriter extends PlayerData {
  realmId: string
  realmLevel: number
  cultivation: number
  selectedTalentIds: string[]
  // M-F-TALENT - the breakthrough entitlement originates on this seam:
  // the record persists on PlayerData and locks the transition's drain
  // until its UPGRADE/NEW decision resolves (useTribulation waits on it).
  talentLevels: Record<string, number>
  pendingTalentEntitlement?: TalentEntitlement
  highestFoundationAchieved?: FoundationType
  greatDaoOpportunityLost: boolean
  /** Store-level modifier sync after the unequip-all (rework P5 Task 17). */
  setEquipmentModifiers(modifiers: StatModifier[]): void
}

export class TribulationOutcomeService {
  /**
   * M6 / ARCH-006 - once-only settlement of the run's committed outcome.
   * The record's receipt slot is the dedup identity: the first call
   * applies the full consequence set (realm/cultivation/foundation/
   * talent on victory; cultivation/stone/Kiep Thuong/Great Dao penalties
   * on defeat) and binds the receipt; every later call returns the SAME
   * receipt without re-applying. Returns null when no outcome is
   * committed. Independent of any curtain/transition - safe to invoke on
   * every tick while the outcome is pending.
   *
   * M6 r1 - a resolve that throws MID-APPLY marks the record
   * terminal-failed (settlementError) instead of leaving the receipt
   * unbound: later calls see the marker and return null without
   * re-running the apply, so partially-landed consequences can never
   * compound. The exception is contained here (logged once, never
   * propagated into the tick loop); the adapter reads
   * committed.settlementError to surface and drain the failed run.
   */
  settleOutcome(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    director: TribulationDirector,
  ): TribulationOutcomeResult | null {
    const committed = director.getCommittedOutcome()

    if (!committed) {
      return null
    }

    if (committed.receipt) {
      return committed.receipt
    }

    if (committed.settlementError) {
      return null
    }

    try {
      const result =
        committed.outcome === 'victory'
          ? this.resolveVictory(player, gameManager, committed)
          : this.resolveDefeat(player, gameManager, committed)

      committed.receipt = result
      return result
    } catch (err) {
      committed.settlementError = err instanceof Error ? err : new Error(String(err))
      console.error('[tribulation] outcome settlement failed; record marked terminal-failed', committed.settlementError)
      return null
    }
  }

  /**
   * Apply victory consequences and return the typed outcome. The session
   * itself (clear/exit/route) stays with the caller: this is outcome
   * authority, not presentation sequencing.
   */
  resolveVictory(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    facts: TribulationOutcomeFacts,
  ): TribulationVictoryResult {
    // Loi Kiep (M2): every survived kiep banks a permanent all-attribute
    // stack - including the announcement-only Quan Khi ritual below.
    this.applyLoiKiepVictoryBonus(player)

    const realm = getCurrentRealm(facts.targetRealmId)

    // M-F-TALENT - one committed victory originates ONE entitlement
    // record (ruling S15-18). Placed before the Quan Khi early-return
    // and the realm writes below: the decision is keyed to the realm
    // being ENTERED (facts.targetRealmId) - the Quan Khi ritual also
    // enters Luyen Khi, so it creates a qi_refining-pool entitlement.
    // Idempotent by construction: a pending record is never overwritten,
    // and a re-settle of the same committed outcome returns its receipt
    // without re-running this apply at all (settleOutcome dedup).
    //
    // Special case (ruling): a Dai Dao foundation breakthrough's ONE
    // result is the pham_cot -> pham_nhan_chi_cot evolution below, not a
    // UPGRADE/NEW decision - the generic entitlement is suppressed so
    // the transaction yields exactly one result, never two.
    const isGreatDaoBreakthrough =
      facts.targetRealmId === 'foundation_establishment' && facts.grade === 'great_dao'
    if (!isGreatDaoBreakthrough) {
      createTalentEntitlement(player, facts.targetRealmId)
    }

    // Quan Khi victory: pure announcement + path-choice navigation.
    // No realm/talent/foundation writes (spec dot-pha-loi-kiep SS5.1) -
    // the entitlement record above is the transaction's state, not a
    // realm write.
    if (facts.targetRealmId === 'qi_refining') {
      return {
        kind: 'victory',
        realmEntered: null,
        realmName: realm.name,
        talentConverted: false,
        standalonePanel: 'quan_khi',
        questRealmTransitionMarked: false,
        announcement: {
          titleKey: 'announce.tribulation.quanKhi.title',
          bodyKey: 'announce.tribulation.quanKhi.body',
        },
      }
    }

    // M-F-TECHNIQUE (F4) - the live technique cycle seals BEFORE the
    // realm write: the departing realmLevel is the freeze-time ceiling
    // its dai_thanh outcome evaluates against (post-write realmLevel
    // is already 1). No-op for qi_refining (early return above) and
    // for in-band live grades.
    gameManager.realmAdvanceOps.applyTechniqueRealmTransition(player, facts.targetRealmId)

    // Order preserved from the Vue path (rework P5, Task 17): realm write
    // FIRST, then unequip-all + modifier sync (avoids stuck gear from the
    // new realm's grade gate), then passive syncs, then path reward.
    player.realmId = facts.targetRealmId
    player.realmLevel = 1
    player.cultivation = 0

    // Hai Nap (M2): banked overflow follows into the new realm's level
    // 1 - same owner helper as the minor-tier breakthrough pour.
    pourCultivationOvercharge(player)

    // R8.1 (AR-09): realm transition may unlock quests; tell the lifecycle
    // owner to reconcile on the next tick. The domain stays the activation
    // authority (A7).
    gameManager.tickOps.markQuestRealmTransition()

    gameManager.equipmentOps.unequipAllEquipment()
    player.setEquipmentModifiers(gameManager.equipmentOps.getEquipmentModifiers())

    // Spec dot-pha-loi-kiep SS4.2/SS4.4: foundation grade recorded on
    // entry; highestFoundationAchieved feeds the foundation passive.
    if (facts.targetRealmId === 'foundation_establishment') {
      player.highestFoundationAchieved = facts.grade
    }

    gameManager.realmAdvanceOps.syncRealmPassive(player)
    gameManager.realmAdvanceOps.syncRealmStatPassive(player)

    // Kiem Tu Reimagined (spec K15) - hidden_sword_pathway merge fires exactly once per
    // major-realm advance, after the realmId write (above) so the merge
    // snapshots the swords forged under the OLD realm's economy.
    gameManager.realmAdvanceOps.applySwordPathRealmTransition(player)

    // Cultivation-path realm rewards (technique/artifact kit grants) are
    // idempotent and owned by GameManager; the service only sequences.
    gameManager.realmAdvanceOps.grantCultivationPathRealmReward(player, player.realmId)

    // M-F-COMPANION-GIFT - companion gift moments authored against the
    // realm just entered fire here (write-if-absent; idempotent).
    gameManager.realmAdvanceOps.applyCompanionGiftRealmTransition(player)

    // Spec SS4.3/SS4.4: Great Dao victory converts the penalty talent into
    // the permanent reward talent.
    let talentConverted = false
    if (isGreatDaoBreakthrough) {
      const index = player.selectedTalentIds.indexOf('pham_cot')
      if (index >= 0) {
        player.selectedTalentIds.splice(index, 1)
        delete player.talentLevels['pham_cot']
      }
      if (!player.selectedTalentIds.includes('pham_nhan_chi_cot')) {
        player.selectedTalentIds.push('pham_nhan_chi_cot')
      }
      talentConverted = true
    }

    // Discovery announcement: foundation grade or plain realm name.
    const announcement: OutcomeAnnouncement =
      facts.targetRealmId === 'foundation_establishment'
        ? {
            titleKey: 'announce.tribulation.foundation.title',
            titleParams: { label: FOUNDATION_LABELS[facts.grade].toUpperCase() },
            bodyKey: 'announce.tribulation.foundation.body',
          }
        : {
            titleKey: 'announce.tribulation.realm.title',
            titleParams: { realm: realm.name.toUpperCase() },
            bodyKey: 'announce.tribulation.realm.body',
            bodyParams: { realm: realm.name },
          }

    return {
      kind: 'victory',
      realmEntered: facts.targetRealmId,
      realmName: realm.name,
      foundationGrade: facts.targetRealmId === 'foundation_establishment' ? facts.grade : undefined,
      talentConverted,
      questRealmTransitionMarked: true,
      announcement,
    }
  }

  /**
   * Loi Kiep (M2): +10% on all five attributes per victory while the
   * talent is held. Upserts one percent modifier per attribute so the
   * modifiers array stays O(5) regardless of stack count.
   */
  private applyLoiKiepVictoryBonus(player: TribulationPlayerWriter): void {
    const percent = getTribulationVictoryStatPercent(player.selectedTalentIds, player.talentLevels)

    if (percent <= 0) {
      return
    }

    player.tribulationBonusStacks = (player.tribulationBonusStacks ?? 0) + 1

    const attributes = ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'] as const

    for (const stat of attributes) {
      const id = `talent_loi_kiep_${stat}`
      const existing = player.modifiers.find((modifier) => modifier.id === id)

      if (existing) {
        existing.percent = (existing.percent ?? 0) + percent
      } else {
        player.modifiers.push({
          id,
          sourceId: 'loi_kiep',
          sourceType: 'talent',
          stat,
          percent,
        })
      }
    }
  }

  /**
   * Apply defeat consequences: cultivation loss (realm-scaled, floor
   * respected), spirit-stone penalty (partial-delivery: remove at most the
   * owned amount), Kiep Thuong debuff (real finalStats scaling), and the
   * permanent Great Dao opportunity loss on a Great Dao attempt.
   */
  resolveDefeat(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    facts: TribulationOutcomeFacts,
  ): TribulationDefeatResult {
    // Spec SS5.7: realm-scaled loss with a hard floor.
    const lossPercent = Math.max(
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM[facts.targetRealmId] ??
        TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
    )

    player.cultivation = Math.floor(player.cultivation * (1 - lossPercent))

    // Plan Workstream F: the penalty can exceed the balance - remove the
    // actually-owned amount (MaterialBag partial-delivery contract).
    const stoneLoss =
      TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM[facts.targetRealmId] ??
      TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(facts.targetRealmId))
    const owned = gameManager.materialBag.getAmount(spiritStoneId)
    gameManager.materialBag.remove(spiritStoneId, Math.min(owned, stoneLoss))

    // Task 9b (fix round 2): debuff duration scaling reads the player's
    // REAL gear. buff2 M4: the persistent pool's stats port resolves the
    // ambient union internally (same post-reset-equivalent view), so the
    // call carries the def only.
    gameManager.effectOps.applyPersistentBuff(KIEP_THUONG_DEBUFF)

    // Spec SS4.3: losing a Great Dao attempt closes the opportunity
    // FOREVER; later grade rolls cap at Thien Dao (BreakthroughGrades).
    if (facts.targetRealmId === 'foundation_establishment' && facts.grade === 'great_dao') {
      player.greatDaoOpportunityLost = true
      return {
        kind: 'defeat',
        cultivationLossPercent: lossPercent,
        spiritStoneId,
        spiritStonesLost: Math.min(owned, stoneLoss),
        greatDaoOpportunityLost: true,
        announcement: {
          titleKey: 'announce.tribulation.defeatGreatDao.title',
          bodyKey: 'announce.tribulation.defeatGreatDao.body',
        },
      }
    }

    return {
      kind: 'defeat',
      cultivationLossPercent: lossPercent,
      spiritStoneId,
      spiritStonesLost: Math.min(owned, stoneLoss),
      greatDaoOpportunityLost: false,
      announcement: {
        titleKey: 'announce.tribulation.defeat.title',
        bodyKey: 'announce.tribulation.defeat.body',
      },
    }
  }

  /**
   * R8.2 Slice 3 - START-side prep, migrated from the Vue adapter's
   * admitted-start callback: unequip-all, store modifier sync, then the
   * domain startTribulation. Ordering preserved (prep BEFORE the session
   * opens). The presentation session read stays with the adapter (A7).
   */
  startTribulationPrepared(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    targetRealmId: string,
  ): boolean {
    gameManager.equipmentOps.unequipAllEquipment()
    player.setEquipmentModifiers(gameManager.equipmentOps.getEquipmentModifiers())

    // ARCH-002 (M7) - the ghost snapshot resolves INSIDE
    // startTribulation, after its passive-stack reset; no caller-side
    // stats (same contract as startBattleWithPlayer).
    return gameManager.startTribulation(player as PlayerData, targetRealmId)
  }
}

