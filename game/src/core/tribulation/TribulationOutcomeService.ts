/**
 * R8.2 — Domain owner of tribulation outcome consequences (AR-10).
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
 * resolveDefeat — behavior parity is pinned by
 * TribulationOutcomeService.test.ts and the pre-existing dotPha/artifact
 * characterization tests.
 *
 * Writer contract (A3/A6): the caller passes a STRUCTURAL writer for the
 * player-state fields this service owns. In production that is the Pinia
 * player store — it must be the store instance, NOT `store.$state`:
 * writing an absent optional key (highestFoundationAchieved) on the raw
 * $state object does not reflect through the store proxy (probe evidence
 * 2026-09-11), while a write on the store proxy does. The same writer
 * object is handed to GameManager methods (a Pinia store instance
 * satisfies PlayerData structurally), so core stays Pinia-free via
 * structural typing; no store import.
 */
import type { FoundationType } from '../breakthrough/FoundationType'
import type { PlayerData } from '../player/Player'
import type { Stats } from '../stats/StatBlock'
import type { StatModifier } from '../stats/StatCalculator'
import type { GameManager } from '../game/GameManager'
import type { ActiveTribulationState } from './TribulationDirector'
import type { OutcomeAnnouncement } from '../presentation/OutcomeAnnouncement'
import { getCurrentRealm } from '../realm/realmSystem'
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
  /** i18n descriptor — the adapter resolves keys via t() (P16). */
  announcement: OutcomeAnnouncement
}

/** Defeat outcome facts for presentation. */
export interface TribulationDefeatResult {
  kind: 'defeat'
  cultivationLossPercent: number
  spiritStoneId: string
  spiritStonesLost: number
  greatDaoOpportunityLost: boolean
  /** i18n descriptor — the adapter resolves keys via t() (P16). */
  announcement: OutcomeAnnouncement
}

export type TribulationOutcomeResult = TribulationVictoryResult | TribulationDefeatResult

/**
 * Writer over the player state this service owns. Extends PlayerData so
 * the SAME object flows into GameManager methods without casts. In
 * production the caller passes the Pinia player store INSTANCE — never
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
  highestFoundationAchieved?: FoundationType
  greatDaoOpportunityLost: boolean
  /** Store-level modifier sync after the unequip-all (rework P5 Task 17). */
  setEquipmentModifiers(modifiers: StatModifier[]): void
}

export class TribulationOutcomeService {
  /**
   * Apply victory consequences and return the typed outcome. The session
   * itself (clear/exit/route) stays with the caller: this is outcome
   * authority, not presentation sequencing.
   */
  resolveVictory(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    active: ActiveTribulationState,
  ): TribulationVictoryResult {
    const realm = getCurrentRealm(active.targetRealmId)

    // Quan Khi victory: pure announcement + path-choice navigation.
    // No realm/talent/foundation writes (spec dot-pha-loi-kiep SS5.1).
    if (active.targetRealmId === 'qi_refining') {
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

    // Order preserved from the Vue path (rework P5, Task 17): realm write
    // FIRST, then unequip-all + modifier sync (avoids stuck gear from the
    // new realm's grade gate), then passive syncs, then path reward.
    player.realmId = active.targetRealmId
    player.realmLevel = 1
    player.cultivation = 0

    // R8.1 (AR-09): realm transition may unlock quests; tell the lifecycle
    // owner to reconcile on the next tick. The domain stays the activation
    // authority (A7).
    gameManager.markQuestRealmTransition()

    gameManager.unequipAllEquipment()
    player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

    // Spec dot-pha-loi-kiep SS4.2/SS4.4: foundation grade recorded on
    // entry; highestFoundationAchieved feeds the foundation passive.
    if (active.targetRealmId === 'foundation_establishment') {
      player.highestFoundationAchieved = active.grade
    }

    gameManager.syncRealmPassive(player)
    gameManager.syncRealmStatPassive(player)

    // Cultivation-path realm rewards (technique/artifact kit grants) are
    // idempotent and owned by GameManager; the service only sequences.
    gameManager.grantCultivationPathRealmReward(player, player.realmId)

    // Spec SS4.3/SS4.4: Great Dao victory converts the penalty talent into
    // the permanent reward talent.
    let talentConverted = false
    if (active.targetRealmId === 'foundation_establishment' && active.grade === 'great_dao') {
      const index = player.selectedTalentIds.indexOf('pham_cot')
      if (index >= 0) {
        player.selectedTalentIds.splice(index, 1)
      }
      if (!player.selectedTalentIds.includes('pham_nhan_chi_cot')) {
        player.selectedTalentIds.push('pham_nhan_chi_cot')
      }
      talentConverted = true
    }

    // Discovery announcement: foundation grade or plain realm name.
    const announcement: OutcomeAnnouncement =
      active.targetRealmId === 'foundation_establishment'
        ? {
            titleKey: 'announce.tribulation.foundation.title',
            titleParams: { label: FOUNDATION_LABELS[active.grade].toUpperCase() },
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
      realmEntered: active.targetRealmId,
      realmName: realm.name,
      foundationGrade: active.targetRealmId === 'foundation_establishment' ? active.grade : undefined,
      talentConverted,
      questRealmTransitionMarked: true,
      announcement,
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
    active: ActiveTribulationState,
    playerStats: Stats,
  ): TribulationDefeatResult {
    // Spec SS5.7: realm-scaled loss with a hard floor.
    const lossPercent = Math.max(
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_FLOOR,
      TRIBULATION_DEFEAT_CULTIVATION_LOSS_BY_REALM[active.targetRealmId] ??
        TRIBULATION_DEFEAT_CULTIVATION_LOSS_FALLBACK,
    )

    player.cultivation = Math.floor(player.cultivation * (1 - lossPercent))

    // Plan Workstream F: the penalty can exceed the balance — remove the
    // actually-owned amount (MaterialBag partial-delivery contract).
    const stoneLoss =
      TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_BY_REALM[active.targetRealmId] ??
      TRIBULATION_DEFEAT_SPIRIT_STONE_LOSS_FALLBACK
    const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(active.targetRealmId))
    const owned = gameManager.materialBag.getAmount(spiritStoneId)
    gameManager.materialBag.remove(spiritStoneId, Math.min(owned, stoneLoss))

    // Task 9b (fix round 2): debuff duration scaling reads the player's
    // REAL gear — the caller threads finalStats, same as startTribulation().
    gameManager.applyPersistentBuff(KIEP_THUONG_DEBUFF, playerStats)

    // Spec SS4.3: losing a Great Dao attempt closes the opportunity
    // FOREVER; later grade rolls cap at Thien Dao (BreakthroughGrades).
    if (active.targetRealmId === 'foundation_establishment' && active.grade === 'great_dao') {
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
   * R8.2 Slice 3 — START-side prep, migrated from the Vue adapter's
   * admitted-start callback: unequip-all, store modifier sync, then the
   * domain startTribulation. Ordering preserved (prep BEFORE the session
   * opens). The presentation session read stays with the adapter (A7).
   */
  startTribulationPrepared(
    player: TribulationPlayerWriter,
    gameManager: GameManager,
    targetRealmId: string,
    playerStats: Stats,
  ): boolean {
    gameManager.unequipAllEquipment()
    player.setEquipmentModifiers(gameManager.getEquipmentModifiers())

    return gameManager.startTribulation(player as PlayerData, playerStats, targetRealmId)
  }
}

