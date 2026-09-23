// M-F-BODY-PERFECTION (spec S2.2, plan Step 1) - authored seam registry
// mapping every canonical realm id to its Body-perfection material list.
// Ruling: distinct perfection materials per realm (Mortal 1 / LQ 2 /
// TC 3 / KD 4...), but their identities/themes are CONTENT and stay
// deferred - every list ships EMPTY so the later content pass appends
// ids without touching domain/UI/save code. Shape mirrors
// PhysiqueEssence.ts: a const record + forward/reverse lookups +
// injectable validate/assert pair exercised once at module load.
// Material-id resolution against the materials catalog is pinned in
// the data test (data/realm must not import data/materials - same
// layering as PhysiqueEssence).
import { REALMS } from '../realms/realm'

export type BodyPerfectionRegistry = Readonly<Record<string, readonly string[]>>

/**
 * Per-realm authored material requirements for Body perfection. Key set
 * must equal the canonical REALMS ids exactly (asserted below). An
 * empty list means "no perfection requirement authored yet" - the
 * domain gate fails closed on it.
 */
export const BODY_PERFECTION_REALM_MATERIALS = {
  mortal: [],
  qi_refining: [],
  foundation_establishment: [],
  golden_core: [],
  nascent_soul: [],
  soul_transformation: [],
  void_refinement: [],
  body_integration: [],
  mahayana: [],
  tribulation: [],
} as const satisfies BodyPerfectionRegistry

const MATERIALS_BY_REALM = new Map<string, readonly string[]>(
  Object.entries(BODY_PERFECTION_REALM_MATERIALS),
)

const REALM_BY_MATERIAL = new Map<string, string>()

for (const [realmId, materialIds] of MATERIALS_BY_REALM) {
  for (const materialId of materialIds) {
    REALM_BY_MATERIAL.set(materialId, realmId)
  }
}

/** Authored perfection-material list for one realm ([] = unauthored or unknown realm id). */
export function bodyPerfectionMaterialIds(realmId: string): readonly string[] {
  return MATERIALS_BY_REALM.get(realmId) ?? []
}

/** The realm an authored perfection material belongs to (undefined = not in the family). */
export function bodyPerfectionRealmOf(materialId: string): string | undefined {
  return REALM_BY_MATERIAL.get(materialId)
}

export function isBodyPerfectionMaterial(materialId: string): boolean {
  return REALM_BY_MATERIAL.has(materialId)
}

/**
 * Pure registry-shape validator - injectable so tests can exercise
 * malformed registries without mutating the canonical constant.
 * Checks: key set === canonical realm ids exactly; intra-list
 * uniqueness; a material id may appear in at most one realm's list.
 */
export function validateBodyPerfectionRegistry(
  registry: BodyPerfectionRegistry,
  realmIds: readonly string[] = REALMS.map((realm) => realm.id),
): string[] {
  const issues: string[] = []
  const keySet = new Set(Object.keys(registry))

  for (const realmId of realmIds) {
    if (!keySet.has(realmId)) {
      issues.push(`thieu khoa realm '${realmId}'`)
    }
  }

  for (const key of keySet) {
    if (!realmIds.includes(key)) {
      issues.push(`khoa realm khong hop le '${key}'`)
    }
  }

  const seen = new Set<string>()

  for (const [realmId, materialIds] of Object.entries(registry)) {
    const intra = new Set<string>()

    for (const materialId of materialIds) {
      if (intra.has(materialId)) {
        issues.push(`material '${materialId}' lap lai trong '${realmId}'`)
      }

      intra.add(materialId)

      if (seen.has(materialId)) {
        issues.push(`material '${materialId}' gan cho nhieu realm`)
      }

      seen.add(materialId)
    }
  }

  return issues
}

export function assertBodyPerfectionRegistry(
  registry: BodyPerfectionRegistry = BODY_PERFECTION_REALM_MATERIALS,
): void {
  const issues = validateBodyPerfectionRegistry(registry)

  if (issues.length > 0) {
    throw new Error(`BODY_PERFECTION_REALM_MATERIALS khong hop le: ${issues.join('; ')}`)
  }
}

// Module-load gate: a malformed canonical registry fails the build/test
// suite at import time instead of silently shipping "no perfection".
assertBodyPerfectionRegistry()
