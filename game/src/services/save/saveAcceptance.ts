// Save acceptance predicate - ONE authority for every registry-backed
// and progression-canonicality check the boot restore preflight runs.
// Extracted (BETA-CREATION, qa-authority-01) so the remote newest-wins
// gate (SupabaseRemoteSave) can apply the IDENTICAL acceptance set the
// boot restore does: a payload the boot restore would reject must
// count as "no remote", otherwise newest-wins resurrects poison on
// every login and the local delete recovery can never converge.
//
// Check classes (same order/semantics as the preflight):
//   equipment/affix refs, material/pill/building refs, production-site
//   refs, technique holder + progression canonicality, mortal-boundary
//   contract, body progression, body perfection.

import {
  getTechniqueGradeCeiling,
  getTechniqueMasteryForNextRank,
  TECHNIQUE_RANK_CAP,
} from '../../core/technique/TechniqueProgression'
import {
  TECHNIQUE_COMPLETION_STATES,
  type TechniqueCompletionState,
} from '../../core/technique/Technique'
import { getRealmIndex } from '../../core/realm/realmSystem'
import { ITEM_QUALITY_ORDER } from '../../core/item/ItemQuality'
import { getActiveWayDefinition } from '../../core/player/CultivationPathKit'
import { mortalBoundaryContractViolation } from '../../core/skill/MortalPrecursors'
import { assertBodyProgressionIntegrity } from '../../core/realm/body/BodyProgressionSystem'
import { assertBodyPerfectionIntegrity } from '../../core/realm/body/BodyPerfection'
import type { ProductionSiteDefinition } from '../../core/production/ProductionTypes'
import type { GameSave } from './saveTypes'

import { materials } from '../../data/materials/materials'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { pills } from '../../data/pill/pills'
import { buildings } from '../../data/building/buildings'
import { THANH_VAN_PRODUCTION_SITES } from '../../core/production/ProductionCatalog'

/**
 * Lookup surface the predicate needs - nothing more. Boot restore
 * binds its live registries; the remote gate binds static catalog ids
 * built from the same data arrays App.vue registers at boot.
 */
export interface SaveAcceptanceCatalogs {
  hasEquipment(itemId: string): boolean
  hasAffix(affixId: string): boolean
  hasMaterial(materialId: string): boolean
  hasPill(pillId: string): boolean
  hasBuilding(buildingId: string): boolean
  getSiteDefinition(siteId: string): ProductionSiteDefinition | undefined
  hasTechnique(id: string): boolean
}

/**
 * Validate registry-backed save references without mutating anything.
 * Throws the same messages the preflight threw - every rejection is a
 * hard-fail at the first violated class.
 */
export function assertSaveAcceptable(save: GameSave, catalogs: SaveAcceptanceCatalogs): void {
  for (const instance of save.equipment) {
    if (!catalogs.hasEquipment(instance.itemId)) {
      throw new Error(`Unknown equipment template in save: ${instance.itemId}`)
    }

    for (const affix of instance.affixes) {
      if (!catalogs.hasAffix(affix.affixId)) {
        throw new Error(`Unknown equipment affix in save: ${affix.affixId}`)
      }
    }
  }

  // R10 (AR-12, S4) - materials/pills/buildings previously had no
  // preflight coverage at all: the restore loops silently dropped an
  // unknown ID via `if (registry.has(id)) ...` instead of rejecting.
  // Per the project's established registry-drift principle (learned-
  // defects QA-2026-09-01-013), silently filtering an owned current
  // entry is data loss, not recovery - hard-fail before any owner
  // mutation, same contract equipment already had. Skills/techniques
  // are intentionally NOT included here: an unknown template there
  // drops the entry at restore (see the restore loops below), not a
  // registry-drift rejection case.
  for (const entry of save.materials) {
    if (!catalogs.hasMaterial(entry.materialId)) {
      throw new Error(`Unknown material in save: ${entry.materialId}`)
    }
  }

  for (const entry of save.pills) {
    if (!catalogs.hasPill(entry.pillId)) {
      throw new Error(`Unknown pill in save: ${entry.pillId}`)
    }
  }

  for (const instance of save.buildings) {
    if (!catalogs.hasBuilding(instance.buildingId)) {
      throw new Error(`Unknown building in save: ${instance.buildingId}`)
    }
  }

  // Mission A review (MA-R1-04) - an unknown siteId previously passed
  // preflight, then occupied worker allocation slots while producing
  // nothing (no definition -> cycleMs 0), permanently draining capacity
  // from real sites. Registry-backed reference -> hard-fail here.
  for (const site of save.productionSites ?? []) {
    if (!catalogs.getSiteDefinition(site.siteId)) {
      throw new Error(`Unknown production site in save: ${site.siteId}`)
    }
  }

  // P7-M3 (v70) - techniques DO get hard validation here (upgraded
  // from the old "unknown id drops silently" restore): the holder is
  // 0-or-1 and MUST equal the committed way's techniqueId; a way-less
  // (mortal) save must carry none. A mismatch is corrupt progression
  // state, not drift - reject before any owner mutation.
  const activeWay = getActiveWayDefinition(save.player)

  if (activeWay) {
    const entry = save.techniques[0]

    if (save.techniques.length !== 1 || entry?.id !== activeWay.techniqueId) {
      throw new Error(
        `Technique holder contract violated in save: way '${activeWay.id}' requires exactly '${activeWay.techniqueId}', found ${save.techniques.length} entries`,
      )
    }

    if (!catalogs.hasTechnique(entry.id)) {
      throw new Error(`Unknown technique in save: ${entry.id}`)
    }

    const ceiling = getTechniqueGradeCeiling(save.player.realmId)
    const cost = getTechniqueMasteryForNextRank(entry.grade)

    // M-F-TECHNIQUE (v75) - gradeHistory is REQUIRED canonical
    // state: every record is {finalRank int 0..18,
    // completionState 'partial'|'dai_thanh'|'vien_man'} and the
    // key set must be canonical: {1..grade-1} all sealed plus
    // {grade} iff the live grade lags the realm (sealed or
    // born-dead skipped). An in-band trainable live grade never
    // carries a record.
    const history = entry.gradeHistory
    const records =
      typeof history === 'object' && history !== null && !Array.isArray(history)
        ? (history as Record<string, unknown>)
        : undefined
    const recordShapeOk =
      records !== undefined &&
      Object.entries(records).every(([key, record]) => {
        const g = Number(key)
        // Canonical decimal spelling: Number() coerces "01"/"1.0"/
        // "1e0" to a valid grade, but the writer only ever emits
        // canonical digits - an alias spelling is a stray record.
        if (!Number.isInteger(g) || g < 1 || g > entry.grade || String(g) !== key) {
          return false
        }
        const r = record as Record<string, unknown> | null
        return (
          typeof r === 'object' &&
          r !== null &&
          Number.isInteger(r.finalRank) &&
          (r.finalRank as number) >= 0 &&
          (r.finalRank as number) <= TECHNIQUE_RANK_CAP &&
          TECHNIQUE_COMPLETION_STATES.includes(
            r.completionState as TechniqueCompletionState,
          )
        )
      })

    const realmIndex = getRealmIndex(save.player.realmId)
    const laggingLiveGrade = entry.grade < realmIndex
    const keySetOk =
      recordShapeOk &&
      // Short-circuit bounds the enumeration before Array(): a
      // non-integer/huge grade must reject via the chain below, not
      // RangeError or allocate.
      Number.isInteger(entry.grade) &&
      entry.grade >= 1 &&
      entry.grade <= ceiling &&
      [...Array(entry.grade - 1).keys()].every((g) =>
        Object.prototype.hasOwnProperty.call(records, g + 1),
      ) &&
      Object.prototype.hasOwnProperty.call(records, entry.grade) === laggingLiveGrade

    if (
      !Number.isInteger(entry.grade) ||
      entry.grade < 1 ||
      entry.grade > ceiling ||
      !Number.isInteger(entry.rank) ||
      entry.rank < 0 ||
      entry.rank > TECHNIQUE_RANK_CAP ||
      !Number.isInteger(entry.mastery) ||
      entry.mastery < 0 ||
      (entry.rank < TECHNIQUE_RANK_CAP && entry.mastery >= cost) ||
      (entry.rank >= TECHNIQUE_RANK_CAP && entry.mastery !== 0) ||
      !ITEM_QUALITY_ORDER.includes(entry.quality) ||
      !recordShapeOk ||
      !keySetOk
    ) {
      throw new Error(`Invalid technique progression state in save: ${entry.id}`)
    }
  } else if (save.techniques.length !== 0) {
    throw new Error('Technique holder contract violated in save: way-less player carries a technique')
  }

  // P7-M4 (v71) + BETA-CREATION (v82) - the mortal-boundary contract
  // (pick three-channel write, post-mortal clearing, realm/path
  // pairing) is owned by MortalPrecursors so every acceptance seam -
  // this preflight and the remote newest-wins gate - enforces one
  // identical contract. Reject before any owner mutation, same
  // hard-fail seam as the technique-holder contract above.
  const boundaryViolation = mortalBoundaryContractViolation(save)
  if (boundaryViolation !== null) {
    throw new Error(boundaryViolation)
  }

  // P7-M5 (v72) - body progression integrity is the LAST preflight
  // check, delegated to the BodyProgression authority in one call
  // (shape already passed): completedTiers integral + 0..6, progress
  // under the active-tier cap / zero at 6, openedIds a strict prefix
  // of canonical MERIDIANS order. A corrupt slice is corrupt
  // progression state - reject before any owner mutation, same
  // hard-fail seam as the technique-holder contract above.
  assertBodyProgressionIntegrity(save.player)

  // M-F-BODY-PERFECTION (v80) - the perfection slice's semantic
  // integrity runs as the LAST preflight check too: authored-family
  // membership, perfected-realm keys, subset + realm-cap rules (see
  // core/realm/body/BodyPerfection). Same hard-fail seam - reject
  // before any owner mutation.
  assertBodyPerfectionIntegrity(save.player)
}

/**
 * Boolean view for acceptance seams that classify rather than throw
 * (the remote newest-wins gate treats "would reject" as "no remote").
 */
export function isSaveAcceptable(save: GameSave, catalogs: SaveAcceptanceCatalogs): boolean {
  try {
    assertSaveAcceptable(save, catalogs)
    return true
  } catch {
    return false
  }
}

let staticCatalogs: SaveAcceptanceCatalogs | undefined

/**
 * Catalog id lookups built from the same data arrays App.vue registers
 * into the live registries at boot — the remote gate's acceptance
 * surface must mirror the boot gate's, so a poisoned remote payload is
 * classified 'no remote' for EVERY preflight class, not just the ones
 * that need no lookup. Lazy singleton: read-only id sets.
 */
export function staticSaveAcceptanceCatalogs(): SaveAcceptanceCatalogs {
  if (staticCatalogs) return staticCatalogs

  const equipmentIds = new Set(equipment.map((item) => item.id))
  const affixIds = new Set(affixes.map((item) => item.id))
  const materialIds = new Set(materials.map((item) => item.id))
  const pillIds = new Set(pills.map((item) => item.id))
  const buildingIds = new Set(buildings.map((item) => item.id))
  const techniqueIds = new Set(TECHNIQUES.map((item) => item.id))
  const sitesById = new Map(THANH_VAN_PRODUCTION_SITES.map((site) => [site.siteId, site]))

  staticCatalogs = {
    hasEquipment: (id) => equipmentIds.has(id),
    hasAffix: (id) => affixIds.has(id),
    hasMaterial: (id) => materialIds.has(id),
    hasPill: (id) => pillIds.has(id),
    hasBuilding: (id) => buildingIds.has(id),
    getSiteDefinition: (id) => sitesById.get(id),
    hasTechnique: (id) => techniqueIds.has(id),
  }

  return staticCatalogs
}
