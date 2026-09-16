import type { Technique } from '../technique/Technique'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import type { PlayerData } from './Player'
import { getPathWayDefinition, isCultivationPathOffered, type CultivationPathId } from './CultivationPathKit'
import { registerDomainDeltaDeriver, type StatModifier } from '../stats/StatCalculator'
import type { MainStatKey } from '../stats/StatTypes'
import type { Stats } from '../stats/StatBlock'
import {
  THE_TU_AN_DEX_COUNTER_PER_POINT,
  THE_TU_AN_DEX_FOLLOWUP_PER_POINT,
  THE_TU_AN_DEX_PROTECT_PER_POINT,
  THE_TU_AN_INT_FOLLOWUP_PER_POINT,
  THE_TU_AN_STR_COUNTER_PER_POINT,
  THE_TU_AN_VIT_PROTECT_PER_POINT,
  THE_TU_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
} from '../stats/TheTuStatChannels'

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
 * itself rejects any second choice). The Tu Reimagined adds 'the_tu'
 * as an always-offered base path and 'the_tu_an' behind the same
 * ritual-time evaluation via its way offerGate (huy_quyen Lv3).
 */
export function getOfferableCultivationPaths(player: PlayerData): CultivationPathId[] {
  const paths: CultivationPathId[] = ['phap_tu', 'kiem_tu', 'the_tu']

  // M1 transition — hidden ways surface under their legacy _an path
  // ids; the gate read moved onto the way definition's offerGate (the
  // ngo_dao linh_bao gate is cast-count based, evaluated inside
  // isCultivationPathOffered — replaces the bespoke isPhapTuAnEligible
  // call that used to live here). The kiem_tu 'ngu' way is catalogued
  // but has no legacy id — it is never offered until M6 (R2).
  const ngoDao = getPathWayDefinition('phap_tu_an')
  if (ngoDao && isCultivationPathOffered(ngoDao, player)) {
    paths.push('phap_tu_an')
  }

  const ungThe = getPathWayDefinition('the_tu_an')
  if (ungThe && isCultivationPathOffered(ungThe, player)) {
    paths.push('the_tu_an')
  }

  return paths
}

/** linh_bao Lv3 gate — shared by the offer query and the ritual commit.
 * M1: the rule now lives on the ngo_dao way's requiresSkillCastLevel
 * offerGate; this delegate stays for RealmAdvanceOps until M2. */
export function isPhapTuAnEligible(player: PlayerData): boolean {
  const way = getPathWayDefinition('phap_tu_an')

  return way !== undefined && isCultivationPathOffered(way, player)
}

// ---------------------------------------------------------------------------
// The Tu Reimagined (spec 2026-09-15 section 3) — the_tu_an reactive
// chances + the_tu endurance channel. Same D12 two-channel pattern as
// phap_tu above: assembly emitters read resolveAttributeTotals and emit
// domain-gated modifiers BEFORE calculateStats; deltaDerivers re-emit
// deltas mid-battle for entities owning the domain.
// ---------------------------------------------------------------------------

function theTuAnReactiveModifiers(
  totals: Pick<Stats, MainStatKey>,
  idPrefix: string,
): StatModifier[] {
  // RAW uncapped linear values — the REACTIVE_CHANCE_CAP is a metadata
  // bound consumed at the roll/display site, never inside the pipeline.
  return [
    {
      id: `${idPrefix}:counterChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'counterChance',
      flat:
        totals.strength * THE_TU_AN_STR_COUNTER_PER_POINT +
        totals.dexterity * THE_TU_AN_DEX_COUNTER_PER_POINT,
      domain: 'the_tu_an',
    },
    {
      id: `${idPrefix}:protectChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'protectChance',
      flat:
        totals.vitality * THE_TU_AN_VIT_PROTECT_PER_POINT +
        totals.dexterity * THE_TU_AN_DEX_PROTECT_PER_POINT,
      domain: 'the_tu_an',
    },
    {
      id: `${idPrefix}:followUpChance`,
      sourceId: 'the_tu_an',
      sourceType: 'attribute',
      stat: 'followUpChance',
      flat:
        totals.dexterity * THE_TU_AN_DEX_FOLLOWUP_PER_POINT +
        totals.intelligence * THE_TU_AN_INT_FOLLOWUP_PER_POINT,
      domain: 'the_tu_an',
    },
  ]
}

/** Assembly-time emission (spec 3.2) — the_tu_an players only. */
export function getTheTuAnReactiveStatModifiers(
  player: PlayerData,
  totals: Pick<Stats, MainStatKey>,
): StatModifier[] {
  return player.cultivationPath === 'the_tu_an'
    ? theTuAnReactiveModifiers(totals, 'the_tu_an:attributes')
    : []
}

function theTuEnduranceModifiers(vitality: number, idPrefix: string): StatModifier[] {
  return [
    {
      id: `${idPrefix}:enduranceThreshold`,
      sourceId: 'the_tu',
      sourceType: 'attribute',
      stat: 'enduranceThreshold',
      flat: vitality * THE_TU_VITALITY_ENDURANCE_THRESHOLD_PER_POINT,
      domain: 'the_tu',
    },
  ]
}

/** Assembly-time emission (spec 3.3) — the_tu players only. */
export function getTheTuEnduranceStatModifiers(
  player: PlayerData,
  totals: Pick<Stats, MainStatKey>,
): StatModifier[] {
  return player.cultivationPath === 'the_tu'
    ? theTuEnduranceModifiers(totals.vitality, 'the_tu:vitality')
    : []
}

registerDomainDeltaDeriver('the_tu_an', (delta) =>
  theTuAnReactiveModifiers(delta, 'the_tu_an:attributes_delta'),
)

registerDomainDeltaDeriver('the_tu', (delta) =>
  delta.vitality === 0 ? [] : theTuEnduranceModifiers(delta.vitality, 'the_tu:vitality_delta'),
)

export interface CultivationPathRewardDeps {
  getEquippedTechnique: () => Technique | undefined
  getTechnique: (techniqueId: string) => Technique | undefined
  learnTechnique: (techniqueId: string) => boolean
  equipTechnique: (techniqueId: string) => boolean
}

export function getCultivationPathStatModifiers(player: PlayerData) {
  const way = player.cultivationPath ? getPathWayDefinition(player.cultivationPath) : undefined

  return [...(way?.statModifiers ?? [])]
}

export function grantCultivationPathRealmReward(
  player: PlayerData,
  realmId: string,
  deps: CultivationPathRewardDeps,
): boolean {
  if (!player.cultivationPath) {
    return false
  }

  const reward = getPathWayDefinition(player.cultivationPath)?.realmRewards?.[realmId]

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
