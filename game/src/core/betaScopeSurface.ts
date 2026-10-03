// BETA SCOPE LOCK v2 Phase-6 - canonical read-models for the GLOBAL
// surface layer: navigation wheel, building hotspots, panel deep-links,
// HUD currency sources, realm-progression presentation, beta completion,
// and save-support verdicts.
//
// betaScope.ts stays the release-policy authority - this module only
// COMPOSES its allow-list verdicts with the existing domain predicates
// (ReleasePolicy window reads, HiddenLineage record reads, STAGES /
// commandWheelCatalog / RealmPassiveNodes registries). Frontend-visible
// nav items, buildings, panels and realm nodes come from here; a UI
// consumer never rederives scope from raw registries.
//
// Fail-closed contract (spec sec.4): every check below is an
// ALLOW-LIST - an id not declared beta-visible resolves scope-hidden,
// so a slot/building/panel added later without a scope decision can
// never leak into the beta build. Nothing here writes state or
// consumes RNG; every function is a pure query (Q9).
import { isBetaFeature, isBetaTalentId, isBetaWay, scopeHiddenPillFamilyOfId, type BetaFeatureName } from './betaScope'
import {
  isBeyondReleaseCeiling,
  isRealmAvailable,
} from './realm/ReleasePolicy'
import { getNextRealm } from './realm/realmSystem'
import { getRealmHiddenState } from './realm/hidden/HiddenLineage'
import type { RealmHiddenState } from './realm/hidden/HiddenPerfection'
import { getActiveWay } from './player/CultivationPathSystem'
import { COMMAND_WHEEL_SLOTS, type CommandWheelSlot } from '../data/ui/commandWheelCatalog'
import { REALM_PASSIVE_NODES, type RealmPassiveNode } from '../data/realm/RealmPassiveNodes'
import { STAGES } from '../data/stage/Stages'
import { getRealmTier } from './realm/RealmTierMap'
import { getCurrentRealm } from './realm/realmSystem'
import type { PlayerData } from './player/Player'

/**
 * Shared admission for the id -> feature binding maps below: an
 * UNLISTED id fails closed (no scope decision was ever made); a null
 * feature ships in beta unconditionally; a named feature defers to
 * BETA_FEATURES.
 */
function featureAdmits(feature: BetaFeatureName | null | undefined): boolean {
  if (feature === undefined) {
    return false
  }
  return feature === null || isBetaFeature(feature)
}

// ---------------------------------------------------------------------------
// A. Navigation wheel
// ---------------------------------------------------------------------------

/**
 * Wheel slot id -> the scope-hidden feature that owns it, for every
 * slot the command-wheel catalog declares. A null feature ships in
 * beta (including 'talisman_slot' - it stays admitted and its own
 * unavailable reason still applies); phap_bao / formation_slot /
 * companion_roster / chi_hien_quan are bound to their scope-hidden
 * features. A slot id absent from the map fails closed - a slot added
 * later without a scope decision can never leak into the beta wheel.
 * Binding to the BETA_FEATURES name keeps one authority: flipping the
 * feature back on re-admits the slot, so the dormant surface keeps
 * its own coverage.
 */
const BETA_WHEEL_SLOT_FEATURES: Readonly<Record<string, BetaFeatureName | null>> = {
  character: null,
  realm: null,
  skill: null,
  quest: null,
  phap_bao: 'artifact',
  talisman_slot: null,
  formation_slot: 'formation',
  companion_roster: 'companion',
  teleport_array: null,
  pill_room: null,
  gathering_outpost: null,
  chi_hien_quan: 'manualWorkforce',
  equipment_hall: null,
  scripture_pavilion: null,
  settings: null,
}

/** true when the wheel slot's owner feature is inside beta scope. */
export function isBetaWheelSlot(slotId: string): boolean {
  return featureAdmits(BETA_WHEEL_SLOT_FEATURES[slotId])
}

/**
 * The canonical filtered wheel list: the frontend renders exactly
 * these slots (each slot's own available()/disabledReason() still
 * applies on top - scope admission precedes progression gating).
 */
export function betaWheelSlots(): readonly CommandWheelSlot[] {
  return COMMAND_WHEEL_SLOTS.filter((slot) => isBetaWheelSlot(slot.id))
}

// ---------------------------------------------------------------------------
// B. Buildings / hotspots
// ---------------------------------------------------------------------------

/**
 * Building id -> the scope-hidden feature that owns it, for every
 * building a navigation surface can name. A null feature ships in
 * beta (`vendor`, the Ky Bao Cac sell sink, is hotspot-only yet
 * beta-live); `chi_hien_quan` (worker lodge / companion workforce)
 * is bound to 'manualWorkforce'. A building id absent from the map
 * fails closed - an id the domain never declared can never render.
 */
const BETA_BUILDING_FEATURES: Readonly<Record<string, BetaFeatureName | null>> = {
  teleport_array: null,
  pill_room: null,
  gathering_outpost: null,
  equipment_hall: null,
  vendor: null,
  chi_hien_quan: 'manualWorkforce',
}

/** true when the building may render a hotspot / open a panel in beta. */
export function isBetaBuildingSurface(buildingId: string): boolean {
  return featureAdmits(BETA_BUILDING_FEATURES[buildingId])
}

/**
 * The building-popover mount chokepoint: GameRoot binds this so a raw
 * ui.activeBuildingPopoverId write can never mount a scope-hidden
 * card - identical defense to the standalone-panel mount watcher.
 */
export function betaAdmittedBuildingPopoverId(buildingId: string | null): string | null {
  return buildingId !== null && isBetaBuildingSurface(buildingId) ? buildingId : null
}

// ---------------------------------------------------------------------------
// C. Panels (deep-link guards)
// ---------------------------------------------------------------------------

/**
 * Standalone (full-overlay) panel id -> its owner feature. 'quan_khi'
 * stays: it is the spell-path initiation ritual surface, not a hidden
 * feature. artifact / tran_phap / companion are bound to their
 * scope-hidden features. A panel id absent from the map fails closed.
 */
const BETA_STANDALONE_PANEL_FEATURES: Readonly<Record<string, BetaFeatureName | null>> = {
  skill: null,
  realm: null,
  quan_khi: null,
  quest: null,
  artifact: 'artifact',
  tran_phap: 'formation',
  companion: 'companion',
  // Huyen Kim scroll scenes: the technique showcase and the body-cultivation
  // scene are presentation surfaces of already-shipped beta domains.
  technique: null,
  body: null,
}

/**
 * Left-panel mode id -> its owner feature. 'worker_lodge' (the
 * chi_hien_quan function panel) is bound to 'manualWorkforce'; every
 * other authored mode ships in beta. A mode absent from the map fails
 * closed.
 */
const BETA_LEFT_PANEL_FEATURES: Readonly<Record<string, BetaFeatureName | null>> = {
  character: null,
  inventory: null,
  exploration: null,
  settings: null,
  equipment_hall: null,
  pill_room: null,
  worker_lodge: 'manualWorkforce',
  scripture_pavilion: null,
  stage_select: null,
  vendor: null,
}

export function isBetaStandalonePanel(panel: string): boolean {
  return featureAdmits(BETA_STANDALONE_PANEL_FEATURES[panel])
}

export function isBetaLeftPanelMode(mode: string): boolean {
  return featureAdmits(BETA_LEFT_PANEL_FEATURES[mode])
}

// ---------------------------------------------------------------------------
// D. Realm ladder / progression surfaces
// ---------------------------------------------------------------------------

/**
 * Canonical realm ladder for the RealmPanel rail: the mortal home rung
 * plus only the authored passives whose destination realm sits inside
 * the release window. Post-ceiling nodes (Kim Dan and above, marked
 * comingSoon in the data) never reach the beta surface - no teaser.
 */
export function betaRealmLadderNodes(): readonly RealmPassiveNode[] {
  const mortalRung: RealmPassiveNode = {
    realmId: 'mortal',
    label: getCurrentRealm('mortal').name,
    unlockTier: getRealmTier('mortal'),
    comingSoon: false,
  }

  return [
    mortalRung,
    ...REALM_PASSIVE_NODES.filter((node) => isRealmAvailable(node.realmId)),
  ]
}

/**
 * The next-realm presentation surface, or null when the next realm is
 * beyond the release ceiling (Truc Co -> Kim Dan) - the beta build
 * renders NO major-breakthrough CTA and NO ceiling teaser there. Below
 * the ceiling it reports the authored next realm.
 */
export interface BetaNextRealmSurface {
  nextRealmId: string
  nextRealmName: string
}

export function betaNextRealmSurfaceFor(player: PlayerData): BetaNextRealmSurface | null {
  const next = getNextRealm(player.realmId)
  if (next === null || isBeyondReleaseCeiling(next.id)) {
    return null
  }

  return { nextRealmId: next.id, nextRealmName: next.name }
}

/**
 * Beta-gated read of a realm's hidden record for the RealmPanel
 * section rows (Pham Cot / Quan The / Nghich blocks). Under beta scope
 * this always resolves undefined - the record still exists on legacy
 * saves (preserved, never rewritten) but no hidden row may render.
 */
export function betaHiddenRealmRecordFor(
  player: PlayerData,
  realmId: string,
): RealmHiddenState | undefined {
  if (!isBetaFeature('hiddenContent')) {
    return undefined
  }

  return getRealmHiddenState(player, realmId)
}

// ---------------------------------------------------------------------------
// E. Beta completion + save support
// ---------------------------------------------------------------------------

/**
 * Act-3 final boss id - the beta ending trigger (spec sec.38).
 * The id is pinned to the roster's act-3 boss by spec test; update the
 * roster authority and this literal together.
 */
export const BETA_FINAL_BOSS_ENEMY_ID = 'foundation_ferocious_flood_dragon_whelp'

export interface BetaCompletion {
  /** The act-3 final boss stage has been cleared. */
  act3FinalBossDefeated: boolean
  /** Beta content is fully consumed - the deliberate ending beat. */
  betaComplete: boolean
}

/**
 * 'Beta Complete' read-model: true once the stage carrying the act-3
 * final boss (foundation_floor_10 / Hung Giao Sung) is in
 * completedStageIds. The frontend consumes this flag for the ending
 * surface - no Kim Dan unlock prompt exists anywhere in beta scope.
 */
export function betaCompletionFor(player: PlayerData): BetaCompletion {
  const finalStageIds = new Set(
    STAGES.filter((stage) => stage.bossEnemyId === BETA_FINAL_BOSS_ENEMY_ID).map(
      (stage) => stage.id,
    ),
  )
  const act3FinalBossDefeated = player.completedStageIds.some((id) =>
    finalStageIds.has(id),
  )

  return { act3FinalBossDefeated, betaComplete: act3FinalBossDefeated }
}

/**
 * Reasons a persisted player state falls outside beta support. A legacy
 * save is never auto-converted - it loads intact (state is dormant,
 * not corrupted), and this read-model reports WHY it is out of scope.
 */
export type BetaUnsupportedReason =
  /** Player realm sits above the release ceiling (post-Truc-Co save). */
  | 'realm_beyond_release'
  /** The resolved active way is not a beta-playable way. */
  | 'way_out_of_scope'
  /** Hidden-perfection or hidden-beast progress exists on the save. */
  | 'hidden_progression_state'
  /** At least one companion is owned. */
  | 'companion_owned'
  /** A Ban Menh Phap Bao artifact record exists. */
  | 'artifact_owned'
  /** A Tran Phap loadout is persisted. */
  | 'formation_loadout'
  /** Dormant workforce state exists (chi_hien_quan capacity). */
  | 'manual_workforce_state'
  /** An in-flight alchemy job belongs to a dormant recipe family. */
  | 'dormant_alchemy_job'
  /** The Decompose station carries live state (running or staffed). */
  | 'dormant_decompose_state'
  /** A selected talent outside the beta roster is persisted. */
  | 'dormant_talent_state'

/**
 * Save-level slices the reason read-model inspects in addition to
 * PlayerData. Passed from the loaded payload by the boot path - the
 * alchemy job list and the decompose station state live outside
 * PlayerData but are just as much carried dormant records.
 * Read defensively: shape validation may be bypassed on a hostile save.
 */
export interface BetaUnsupportedSaveSlices {
  alchemyJobs?: unknown
  decompose?: {
    started?: unknown
    settings?: {
      workers?: unknown
    } | Record<string, unknown>
  } | null
}

/**
 * The first unsupported reason for `player`, or null when the save is
 * fully inside beta scope. Read-only - it inspects persisted fields and
 * never mutates them (spec sec.20: deserialize safely, flag explicitly).
 */
export function unsupportedReleaseReason(
  player: PlayerData,
  saveSlices?: BetaUnsupportedSaveSlices,
): BetaUnsupportedReason | null {
  if (!isRealmAvailable(player.realmId)) {
    return 'realm_beyond_release'
  }

  const activeWay = getActiveWay(player)
  if (activeWay !== undefined && !isBetaWay(activeWay)) {
    return 'way_out_of_scope'
  }

  if (hasHiddenProgressionState(player)) {
    return 'hidden_progression_state'
  }

  // Array.isArray: the read-model must never throw on a save whose
  // shape validation was bypassed - a missing/companion-corrupt field
  // fails closed as a reason only when a real record exists.
  if (Array.isArray(player.companions) && player.companions.length > 0) {
    return 'companion_owned'
  }

  if (player.artifact !== undefined) {
    return 'artifact_owned'
  }

  if (player.formationLoadout !== null && player.formationLoadout !== undefined) {
    return 'formation_loadout'
  }

  // Restore recomputes autoWorkerCapacity from any carried chi_hien_quan
  // instance before this read-model runs, so >0 always means dormant
  // workforce state exists on the save - instance-only payloads are
  // caught too.
  if (
    typeof player.autoWorkerCapacity === 'number' &&
    Number.isFinite(player.autoWorkerCapacity) &&
    player.autoWorkerCapacity > 0
  ) {
    return 'manual_workforce_state'
  }

  // A carried job of an authored dormant recipe parks at the settle
  // seam (inert, never delivers) - flag it as out-of-scope state. An
  // unknown/corrupt recipeId fails honestly instead, so it is not a
  // dormant-record reason.
  const jobs = saveSlices?.alchemyJobs
  if (
    Array.isArray(jobs) &&
    jobs.some((job) => {
      const recipeId = (job as { recipeId?: unknown } | null)?.recipeId
      return typeof recipeId === 'string' && scopeHiddenPillFamilyOfId(recipeId) !== null
    })
  ) {
    return 'dormant_alchemy_job'
  }

  // A live Decompose station is the same dormant-record class - the
  // station itself is scope-hidden, so a running cycle or assigned
  // workers must never run silently on a beta save.
  const decompose = saveSlices?.decompose
  if (
    decompose !== undefined &&
    decompose !== null &&
    typeof decompose === 'object' &&
    (decompose.started === true ||
      (typeof decompose.settings === 'object' &&
        decompose.settings !== null &&
        typeof decompose.settings.workers === 'number' &&
        decompose.settings.workers > 0))
  ) {
    return 'dormant_decompose_state'
  }

  // A persisted talent outside the beta roster carries talent-owned
  // records (upgrade cards, loi_kiep claims) with no beta writer.
  if (
    Array.isArray(player.selectedTalentIds) &&
    player.selectedTalentIds.some(
      (talentId) => typeof talentId === 'string' && !isBetaTalentId(talentId),
    )
  ) {
    return 'dormant_talent_state'
  }

  return null
}

function positiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** true when the save carries no out-of-scope state. */
export function betaSupportedFor(player: PlayerData): boolean {
  return unsupportedReleaseReason(player) === null
}

/**
 * Hidden-progression presence: any realm record (discovered or not),
 * completed hidden bodies, hidden breakthrough entries, or accrued
 * hidden-beast channel kills. `lineageActive` alone is NOT a reason -
 * every fresh save carries an open lineage by default.
 */
function hasHiddenProgressionState(player: PlayerData): boolean {
  const perfection = player.hiddenPerfection
  if (perfection !== undefined) {
    // Defensive shape reads: the flags mean "records exist", so a
    // field that failed shape validation (non-object/non-array) counts
    // as hidden state rather than throwing on it. A present-but-null or
    // scalar slice is the same class of corrupt data - flag it, never
    // throw on it.
    if (perfection === null || typeof perfection !== 'object') {
      return true
    }
    if (typeof perfection.realms === 'object' && perfection.realms !== null) {
      if (Object.keys(perfection.realms).length > 0) {
        return true
      }
    } else if (perfection.realms !== undefined) {
      return true
    }
    if (
      Array.isArray(perfection.completedHiddenBodyRealmIds) &&
      perfection.completedHiddenBodyRealmIds.length > 0
    ) {
      return true
    }
    if (
      Array.isArray(perfection.hiddenBreakthroughRealmIds) &&
      perfection.hiddenBreakthroughRealmIds.length > 0
    ) {
      return true
    }
  }

  // F-TC6-3: 'great_dao' is only writable by a hidden breakthrough - the
  // value alone is hidden-progression carry, even when the perfection
  // record slice is absent.
  if (player.highestFoundationAchieved === 'great_dao') {
    return true
  }

  const kills = player.hiddenBeastKills
  return typeof kills === 'object' && kills !== null && Object.keys(kills).length > 0
}
