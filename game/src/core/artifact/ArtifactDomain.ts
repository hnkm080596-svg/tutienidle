// M-F-ARTIFACT-DEFER (Ruling sections 2/52) - the single authored realm
// declaration for the artifact domain's unlock. The domain defers to
// Kim Dan+; golden_core sits OUTSIDE the Beta release window, so under
// real policy the domain is locked for every realm.
//
// This constant lives in a LEAF module (zero imports) on purpose: every
// domain surface pins the SAME declaration - the realm gate
// (ArtifactProgression.isArtifactDomainUnlocked, re-exported), the way's
// realm-entry grant (PhapTuPath.realmRewards computed key), the material
// record tag (materials.ts doan_bao_thach.domainUnlockRealmId), the
// definition field (NguHanhChau.unlockRealmId) and the tribulation seams
// - without creating an import cycle (PhapTuPath -> ArtifactProgression
// -> Artifact -> CultivationPathKit -> PhapTuPath would hit a TDZ on the
// eval-time computed reward key). No site re-derives the realm literal.
export const ARTIFACT_UNLOCK_REALM_ID = 'golden_core'
