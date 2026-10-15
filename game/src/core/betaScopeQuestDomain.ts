// BETA FE-CONTRACT (work-order sec.4B) - canonical read-model for the
// Quest surface. The frontend renders this model; it must never
// rederive reward admission (ReleasePolicy), claimability, the
// collect-material shortfall, or the target label itself.
//
// Same conventions as betaScopeSkillDomain.ts: a pure query composing
// the domain predicates (QuestSystem claim gates, the shared
// isQuestRewardDropAdmitted ReleasePolicy line) - nothing here writes
// state, consumes RNG, or grants content. The mutation stays the
// domain authority (questOps.claimQuest); this model only REPORTS.
import type { MaterialBag } from './material/MaterialBag'
import type { MaterialRegistry } from './material/MaterialRegistry'
import type { PillBag } from './pill/PillBag'
import type { PillRegistry } from './pill/PillRegistry'
import type { PlayerData } from './player/Player'
import type { Quest, QuestCadence, QuestObjective } from './quest/Quest'
import { questObjectives } from './quest/Quest'
import type { QuestProgress } from './quest/QuestProgress'
import {
  isQuestRewardDropAdmitted,
  questRewardBandRealmId,
  scaleQuestRewardByRealm,
  questClaimDisabledReason,
  questObjectiveProgress,
  questTurnInCosts,
} from './quest/QuestSystem'
import type { QuestRegistry } from './quest/QuestRegistry'

// ---------------------------------------------------------------------------
// Quest surface read-model
// ---------------------------------------------------------------------------

/** One displayable reward line. Currency lines carry kind + amount only
 *  (the UI owns the i18n label); item lines additionally carry the
 *  registry-resolved id + display name. */
export interface BetaQuestRewardEntry {
  kind: 'spiritStone' | 'cultivation' | 'skillInsight' | 'material' | 'pill'
  amount: number
  itemId?: string
  name?: string
}

/**
 * Why the quest cannot be claimed. Resolution order mirrors
 * resolveClaimable's own check sequence:
 *   'already-claimed'      - progress.claimed (the once-quest graveyard)
 *   'incomplete'           - counted progress below the authored amount
 *   'missing-turnin-items' - collect quest whose items left the bag
 */
export type BetaQuestClaimDisabledReason =
  | 'incomplete'
  | 'missing-turnin-items'
  | 'already-claimed'
  | 'claim-in-progress'

export interface BetaQuestClaim {
  available: boolean
  claimed: boolean
  disabledReason: BetaQuestClaimDisabledReason | null
}

/** Collect-quest turn-in preview - required vs actually-owned. */
export interface BetaQuestTurnIn {
  materialId: string
  required: number
  owned: number
}

export interface BetaQuestSurfaceModel {
  /** Stable leaf rows for future multiobjective consumers. */
  objectives?: readonly BetaQuestObjectiveModel[]
  id: string
  name: string
  description: string
  /** Quest cadence ('once' | 'daily' | 'weekly'). */
  cadence: QuestCadence
  /** Thematic group id for the Nhiem Vu rail (Codex landscape preview's
   *  group axis). Derived from chainId ('mainline' | 'day' | 'weekly' |
   *  'achievement' | 'expedition') or cadence fallback; standalone once
   *  quests emit undefined and the UI buckets them under 'once'. */
  group?: string
  /** Per-quest vista/thumb art for the list row and detail banner.
   *  Unassigned today - the UI falls back to the shared warm vista;
   *  the owner assigns real art here later. */
  image?: string
  /** Counted progress - may exceed target (kills keep counting); the
   *  UI clamps for display. */
  progress: number
  target: number
  /** Display label for the condition target (material or enemy name).
   *  null = unrestricted kill target - the UI renders its 'any enemy'
   *  i18n label. Flag conditions emit flagId instead (no entity
   *  label exists). */
  targetLabel: string | null
  /** Flag conditions only: the feature-witness id - the UI maps it to
   *  its flag label key (flags.*). */
  flagId?: string
  /** Admitted reward lines only - isQuestRewardDropAdmitted already
   *  applied; render verbatim, never re-filter. */
  rewards: readonly BetaQuestRewardEntry[]
  claim: BetaQuestClaim
  /** Collect quests only: the turn-in requirement vs live bag count. */
  turnIn?: BetaQuestTurnIn
  /** Chain/group membership ('mainline' rows render with the Chinh Tuyen
   *  chip and sort before non-chain rows). */
  chainId?: Quest['chainId']
  /** Locked-chain preview only: this row previews the next unmet
   *  mainline step - read-only, no claim path. */
  lockedPreview?: BetaQuestLockedPreview
}

export interface BetaQuestObjectiveModel {
  id: string
  kind: QuestObjective['kind']
  progress: number
  target: number
  targetLabel: string | null
  flagId?: string
  turnIn?: BetaQuestTurnIn
}

/** Reasons the previewed chain step is still locked (both may apply). */
export interface BetaQuestLockedPreview {
  /** Display name of the unmet predecessor quest. */
  afterQuestName?: string
  /** Realm id the step requires (the UI resolves its display name). */
  requiredRealmId?: string
}

export interface BetaQuestSurfaceDeps {
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag
  /** Registry-resolved enemy display name; undefined = unknown id
   *  (the label falls back to the raw id, mirroring the old panel). */
  enemyName: (enemyId: string) => string | undefined
  /** Optional stage display name resolver for stage_clear objectives. */
  stageName?: (stageId: string) => string | undefined
  /** Optional realm display name resolver for realm_reached objectives. */
  realmName?: (realmId: string) => string | undefined
  /** 2026-10-05 realm-band reward scaling: resolves an ungated quest's
   *  era through its unlocksAfterQuestId chain; absent = ungated quests
   *  preview as mortal-era (factor 1). */
  questRegistry?: Pick<QuestRegistry, 'has' | 'get'>
}

function targetLabelFor(condition: QuestObjective, deps: BetaQuestSurfaceDeps): string | null {

  if (condition.kind === 'collect' || condition.kind === 'acquire') {
    return deps.materialRegistry.has(condition.materialId)
      ? deps.materialRegistry.get(condition.materialId).name
      : condition.materialId
  }

  if (condition.kind === 'realm_reached') {
    return deps.realmName?.(condition.realmId) ?? condition.realmId
  }
  if (condition.kind === 'stage_clear') {
    return deps.stageName?.(condition.stageId) ?? condition.stageId
  }

  if (condition.kind !== 'kill') {
    return null
  }

  return condition.enemyId !== undefined
    ? deps.enemyName(condition.enemyId) ?? condition.enemyId
    : null
}

function rewardsFor(
  quest: Quest,
  deps: BetaQuestSurfaceDeps,
  playerRealmId: string,
): BetaQuestRewardEntry[] {
  const entries: BetaQuestRewardEntry[] = []
  // 2026-10-05 realm-band scaling - preview must equal claim payout
  // (QuestSystem.claim applies the same helper+resolver; A9 single
  // predicate).
  const reward =
    quest.reward.reward !== undefined
      ? scaleQuestRewardByRealm(
          quest.reward.reward,
          questRewardBandRealmId(quest, deps.questRegistry),
        )
      : undefined

  if (reward?.spiritStone) {
    entries.push({ kind: 'spiritStone', amount: reward.spiritStone })
  }

  if (reward?.cultivation) {
    entries.push({ kind: 'cultivation', amount: reward.cultivation })
  }

  if (reward?.skillInsight) {
    entries.push({ kind: 'skillInsight', amount: reward.skillInsight })
  }

  for (const drop of quest.reward.itemDrops ?? []) {
    // The shared predicate - the same ReleasePolicy admission claim()
    // applies at delivery. NOT a second copy.
    if (!isQuestRewardDropAdmitted(drop, deps, playerRealmId)) {
      continue
    }

    const amount = drop.amount ?? 1

    if (drop.kind === 'material') {
      entries.push({
        kind: 'material',
        amount,
        itemId: drop.itemId,
        name: deps.materialRegistry.get(drop.itemId).name,
      })
    } else {
      entries.push({
        kind: 'pill',
        amount,
        itemId: drop.itemId,
        name: deps.pillRegistry.get(drop.itemId).name,
      })
    }
  }

  return entries
}

function claimFor(
  quest: Quest,
  progress: QuestProgress,
  deps: BetaQuestSurfaceDeps,
): BetaQuestClaim {
  const disabledReason = questClaimDisabledReason(quest, progress, deps.materialBag)
  return { available: disabledReason === null, claimed: progress.claimed, disabledReason }
}

/**
 * One quest's beta surface row (work-order sec.4B). Admission is the
 * caller's job (getActiveQuests already filters isBetaQuestEnabled);
 * this resolves everything the row displays - target label, admitted
 * rewards, claim verdict, turn-in shortfall.
 */
export function betaQuestSurfaceFor(
  quest: Quest,
  progress: QuestProgress,
  player: PlayerData,
  deps: BetaQuestSurfaceDeps,
): BetaQuestSurfaceModel {
  const condition = quest.condition
  const leaves = questObjectives(condition)
  const costs = questTurnInCosts(quest)
  const objectives = leaves.map((leaf): BetaQuestObjectiveModel => ({
    id: leaf.id,
    kind: leaf.kind,
    progress: questObjectiveProgress(quest, progress, leaf),
    target: leaf.amount,
    targetLabel: targetLabelFor(leaf, deps),
    flagId: leaf.kind === 'flag' ? leaf.flagId : undefined,
    turnIn: leaf.kind === 'collect' ? {
      materialId: leaf.materialId,
      required: costs.get(leaf.materialId) ?? leaf.amount,
      owned: deps.materialBag.getAmount(leaf.materialId),
    } : undefined,
  }))

  const group =
    quest.chainId ??
    (quest.cadence === 'daily'
      ? 'day'
      : quest.cadence === 'weekly'
        ? 'weekly'
        : undefined)

  return {
    id: quest.id,
    name: quest.name,
    description: quest.description,
    cadence: quest.cadence,
    progress: condition.kind === 'allOf'
      ? objectives.filter((leaf) => leaf.progress >= leaf.target).length : progress.progress,
    target: condition.kind === 'allOf' ? leaves.length : condition.amount,
    targetLabel: condition.kind === 'allOf' ? null : objectives[0]?.targetLabel ?? null,
    ...(condition.kind === 'allOf' ? { objectives } : {}),
    flagId: condition.kind === 'flag' ? condition.flagId : undefined,
    rewards: rewardsFor(quest, deps, player.realmId),
    claim: claimFor(quest, progress, deps),
    turnIn:
      condition.kind === 'collect'
        ? {
            materialId: condition.materialId,
            required: condition.amount,
            owned: deps.materialBag.getAmount(condition.materialId),
          }
        : undefined,
    chainId: quest.chainId,
    group,
  }
}
