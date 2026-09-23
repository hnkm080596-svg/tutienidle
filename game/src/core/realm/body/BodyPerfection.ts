// M-F-BODY-PERFECTION (spec S2/S3/S4/S5/S7, plan Step 1+3) - Body-
// perfection domain authority: the canonical `player.bodyPerfection`
// slice (discovery is persistent state, NOT inventory-derived), the
// per-realm transaction gate, the +10pp-per-realm multiplier contract
// consumed by the Body base-stat channel, and the persisted-shape /
// integrity pair the save boundary delegates to. No UI, no bag code -
// the ops layer owns the transaction and the funnel calls
// recordBodyPerfectionMaterialDiscovery on every live material landing.
import { getRealmIndex } from '../realmSystem'
import {
  BODY_PERFECTION_REALM_MATERIALS,
  bodyPerfectionMaterialIds,
  bodyPerfectionRealmOf,
  isBodyPerfectionMaterial,
} from '../../../data/realm/BodyPerfection'
import type { PlayerData } from '../../player/Player'
import type { BodyProgressionIssue } from './BodyChapter'

/**
 * Canonical Body-perfection slice. `discoveredMaterials` is a write-once
 * set of authored perfection-material ids the player has EVER received
 * (order = first-discovery order); it persists independent of
 * consumption. `perfectedRealmIds` lists realms whose perfection
 * transaction committed (push order).
 */
export interface BodyPerfectionState {
  discoveredMaterials: string[]
  perfectedRealmIds: string[]
}

export function createDefaultBodyPerfection(): BodyPerfectionState {
  return {
    discoveredMaterials: [],
    perfectedRealmIds: [],
  }
}

/**
 * Per-perfected-realm bonus: +10pp ADDITIVE applied globally to all
 * Body-derived base-stat contribution (spec S5). Count 0 -> factor 1
 * -> the raw channel contract is unchanged.
 */
export const BODY_PERFECTION_BONUS_PER_REALM = 0.1

/**
 * Funnel target - writes the discovery marker on FIRST delivery of an
 * authored perfection material. Realm-agnostic: future-realm materials
 * may be discovered early (integrity only caps PERFECTED realms).
 * Returns true when the marker was newly written.
 */
export function recordBodyPerfectionMaterialDiscovery(
  player: PlayerData,
  materialId: string,
): boolean {
  if (!isBodyPerfectionMaterial(materialId)) {
    return false
  }

  const discovered = player.bodyPerfection.discoveredMaterials

  if (discovered.includes(materialId)) {
    return false
  }

  discovered.push(materialId)
  return true
}

/** The hidden surface exists only after at least one discovery. */
export function isBodyPerfectionRevealed(player: PlayerData): boolean {
  return player.bodyPerfection.discoveredMaterials.length > 0
}

export function getBodyPerfectionMultiplier(player: PlayerData): number {
  return 1 + BODY_PERFECTION_BONUS_PER_REALM * player.bodyPerfection.perfectedRealmIds.length
}

/**
 * Transaction precondition (spec S4): the realm's authored list is
 * non-empty; the realm is reached (late perfection allowed - an
 * EARLIER realm still perfects); the realm is not already perfected;
 * every authored material is both discovered AND currently owned
 * (r60-f1: discovery is canonical state, not inventory - a legal
 * save may hold the material with no discovery bit).
 */
export function canPerfectBodyRealm(
  player: PlayerData,
  realmId: string,
  ownedOf: (materialId: string) => number,
): boolean {
  const required = bodyPerfectionMaterialIds(realmId)

  if (!required || required.length === 0) {
    return false
  }

  if (player.bodyPerfection.perfectedRealmIds.includes(realmId)) {
    return false
  }

  if (getRealmIndex(player.realmId) < getRealmIndex(realmId)) {
    return false
  }

  return required.every(
    (materialId) =>
      player.bodyPerfection.discoveredMaterials.includes(materialId) &&
      ownedOf(materialId) >= 1,
  )
}

/**
 * Idempotent mark step of the transaction - write-if-absent push.
 * The ops layer calls this only after every validate arm passed and
 * materials were consumed; calling it twice is a no-op.
 */
export function applyBodyPerfection(player: PlayerData, realmId: string): void {
  if (!player.bodyPerfection.perfectedRealmIds.includes(realmId)) {
    player.bodyPerfection.perfectedRealmIds.push(realmId)
  }
}

/**
 * Read-model for the hidden surface (spec S6): one row per realm that
 * has >= 1 discovered material, in canonical realm order. Only
 * DISCOVERED ids are exposed - undiscovered requirements never leak
 * names to the UI.
 */
export interface BodyPerfectionRealmProgress {
  realmId: string
  discoveredMaterialIds: string[]
  perfected: boolean
}

export function getBodyPerfectionRealmProgress(player: PlayerData): BodyPerfectionRealmProgress[] {
  const discovered = player.bodyPerfection.discoveredMaterials
  const rows: BodyPerfectionRealmProgress[] = []

  for (const realmId of Object.keys(BODY_PERFECTION_REALM_MATERIALS)) {
    const found = discovered.filter((materialId) => bodyPerfectionRealmOf(materialId) === realmId)

    if (found.length === 0) {
      continue
    }

    rows.push({
      realmId,
      discoveredMaterialIds: found,
      perfected: player.bodyPerfection.perfectedRealmIds.includes(realmId),
    })
  }

  return rows
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateStringArray(
  value: unknown,
  path: string,
  emit: (issue: BodyProgressionIssue) => void,
): void {
  if (!Array.isArray(value)) {
    emit({ path, message: 'phai la array' })
    return
  }

  for (const entry of value) {
    if (typeof entry !== 'string') {
      emit({ path, message: 'entry phai la string' })
      return
    }
  }
}

/**
 * Module-owned persisted-shape validation (same convention as
 * validateBodyProgressionPersistedState): the save boundary delegates
 * the WHOLE slice here and never inspects perfection internals.
 * bodyPerfection is a required slice of every v>=77 payload - an
 * absent/malformed record is a corrupt save, not a default.
 */
export function validateBodyPerfectionPersistedState(
  playerPayload: unknown,
  emit: (issue: BodyProgressionIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    emit({ path: 'player', message: 'player phai la object' })
    return
  }

  const record = playerPayload.bodyPerfection

  if (!isRecord(record)) {
    emit({ path: 'player.bodyPerfection', message: 'bodyPerfection phai la object' })
    return
  }

  validateStringArray(record.discoveredMaterials, 'player.bodyPerfection.discoveredMaterials', emit)
  validateStringArray(record.perfectedRealmIds, 'player.bodyPerfection.perfectedRealmIds', emit)
}

/**
 * Semantic restore gate (spec S7) - hard-fail seam like
 * assertBodyProgressionIntegrity: a crafted/corrupt slice is rejected
 * BEFORE any owner mutation. Rules: both sets unique; every discovered
 * id resolves inside the authored family; every perfected realm is an
 * authored non-empty key; a perfected realm's authored list is a
 * subset of discovered; a perfected realm may not exceed the player's
 * own realm (future-realm DISCOVERY stays legal - no cap there).
 */
export function assertBodyPerfectionIntegrity(player: PlayerData): void {
  const issues: string[] = []
  // Absent slice = nothing to check: legacy/manual payloads reaching
  // this seam without shape validation simply have no perfected state;
  // a MISSING slice on a validated save is already a shape issue
  // upstream (validateBodyPerfectionPersistedState), never an
  // integrity crash here.
  const discoveredMaterials = player.bodyPerfection?.discoveredMaterials ?? []
  const perfectedRealmIds = player.bodyPerfection?.perfectedRealmIds ?? []

  if (new Set(discoveredMaterials).size !== discoveredMaterials.length) {
    issues.push('discoveredMaterials co entry trung lap')
  }

  if (new Set(perfectedRealmIds).size !== perfectedRealmIds.length) {
    issues.push('perfectedRealmIds co entry trung lap')
  }

  for (const materialId of discoveredMaterials) {
    if (!isBodyPerfectionMaterial(materialId)) {
      issues.push(`discovered id '${materialId}' khong thuoc nhom perfection`)
    }
  }

  for (const realmId of perfectedRealmIds) {
    const required = bodyPerfectionMaterialIds(realmId)

    if (!required || required.length === 0) {
      issues.push(`perfected realm '${realmId}' khong co material duoc author`)
      continue
    }

    for (const materialId of required) {
      if (!discoveredMaterials.includes(materialId)) {
        issues.push(`perfected realm '${realmId}' thieu discovery '${materialId}'`)
      }
    }

    if (getRealmIndex(realmId) > getRealmIndex(player.realmId)) {
      issues.push(`perfected realm '${realmId}' vuot canh gioi nguoi choi`)
    }
  }

  if (issues.length > 0) {
    throw new Error(`Body-perfection integrity violated: ${issues.join('; ')}`)
  }
}
