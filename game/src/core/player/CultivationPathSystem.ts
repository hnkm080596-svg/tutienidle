import type { Technique } from '../technique/Technique'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import type { PlayerData } from './Player'
import { CULTIVATION_PATH_KITS, type CultivationPathId } from './CultivationPathKit'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { registerDomainDeltaDeriver, type StatModifier } from '../stats/StatCalculator'
import type { MainStatKey } from '../stats/StatTypes'
import type { Stats } from '../stats/StatBlock'

// D12 (stat-system-reimagined spec section 5): Linh Can (attunement) feeds
// MP through the phap_tu domain gate -- the path's own conversion channel,
// not the generic attribute derivation (MP is a Phap Tu resource, D9).
// Ratios are playtest-tunable first passes, same convention as the
// ATTRIBUTE_* constants in StatCalculator.ts.
export const PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT = 4
export const PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT = 0.05

function phapTuAttunementMpModifiers(attunement: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:maxMp`,
      sourceId: 'phap_tu',
      sourceType: 'attribute',
      stat: 'maxMp',
      flat: attunement * PHAP_TU_ATTUNEMENT_MAX_MP_PER_POINT,
      domain: 'phap_tu',
    },
    {
      id: `${idPrefix}:manaRegen`,
      sourceId: 'phap_tu',
      sourceType: 'attribute',
      stat: 'manaRegenPerTurn',
      flat: attunement * PHAP_TU_ATTUNEMENT_MANA_REGEN_PER_POINT,
      domain: 'phap_tu',
    },
  ]
}

/**
 * Assembly-time emission (spec section 5): the Phap Tu system reads the
 * resolved attribute totals and emits its gated MP modifiers BEFORE
 * calculateStats runs -- the totals read is not a second derivation.
 * Only the phap_tu path has an MP pool to feed; other paths are silent.
 */
export function getPhapTuAttunementStatModifiers(
  player: PlayerData,
  totals: Pick<Stats, MainStatKey>,
): StatModifier[] {
  // phap_tu_an owns the same 'phap_tu' stat domain (Task 7).
  return player.cultivationPath === 'phap_tu' || player.cultivationPath === 'phap_tu_an'
    ? phapTuAttunementMpModifiers(totals.attunement, 'phap_tu:attunement')
    : []
}

// Mid-battle channel (D12): attunement deltas re-emit the gated MP delta
// through the registered deltaDeriver -- the deriver sees only deltas,
// never the base, so a stacked attunement buff cannot double-count the
// assembly-time emission (INV-10). Registered at module load;
// calculateEffectiveStats invokes it only for entities whose
// EffectiveStatContext.activeDomains contains 'phap_tu', so a non-phap_tu
// entity gaining attunement mid-battle never leaks MP stats.
registerDomainDeltaDeriver('phap_tu', (delta) =>
  delta.attunement === 0 ? [] : phapTuAttunementMpModifiers(delta.attunement, 'phap_tu:attunement_delta'),
)

/**
 * Phap Tu Reimagined (Task 7) — paths the initiation ritual may offer.
 * 'phap_tu_an' appears ONLY when linh_bao has reached its Lv3 cast
 * threshold at this moment — the offer is evaluated at ritual time,
 * never stored, and post-ritual casts cannot reopen it (the ritual
 * itself rejects any second choice).
 */
export function getOfferableCultivationPaths(player: PlayerData): CultivationPathId[] {
  const paths: CultivationPathId[] = ['phap_tu', 'kiem_tu']

  if (isPhapTuAnEligible(player)) {
    paths.push('phap_tu_an')
  }

  return paths
}

/** linh_bao Lv3 gate — shared by the offer query and the ritual commit. */
export function isPhapTuAnEligible(player: PlayerData): boolean {
  const threshold = CAST_LEVELING_THRESHOLDS['linh_bao']?.lv3 ?? Number.POSITIVE_INFINITY

  return (player.skillCastCounts?.['linh_bao'] ?? 0) >= threshold
}

export interface CultivationPathRewardDeps {
  getEquippedTechnique: () => Technique | undefined
  getTechnique: (techniqueId: string) => Technique | undefined
  learnTechnique: (techniqueId: string) => boolean
  equipTechnique: (techniqueId: string) => boolean
}

export function getCultivationPathStatModifiers(player: PlayerData) {
  return player.cultivationPath
    ? [...(CULTIVATION_PATH_KITS[player.cultivationPath].statModifiers ?? [])]
    : []
}

export function grantCultivationPathRealmReward(
  player: PlayerData,
  realmId: string,
  deps: CultivationPathRewardDeps,
): boolean {
  if (!player.cultivationPath) {
    return false
  }

  const reward = CULTIVATION_PATH_KITS[player.cultivationPath].realmRewards?.[realmId]

  if (!reward) {
    return false
  }

  if (reward.techniqueId) {
    const inheritedInsight = deps.getEquippedTechnique()?.insight ?? 0

    deps.learnTechnique(reward.techniqueId)

    const nextTechnique = deps.getTechnique(reward.techniqueId)

    if (nextTechnique) {
      nextTechnique.insight = Math.max(nextTechnique.insight ?? 0, inheritedInsight)
    }

    deps.equipTechnique(reward.techniqueId)
  }

  if (reward.artifactId && !player.artifact) {
    player.artifact = createDefaultArtifactProgress(reward.artifactId)
  }

  return true
}
