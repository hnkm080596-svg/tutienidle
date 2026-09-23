/**
 * R8.2 Slice 2 - Domain owner of minor-realm breakthrough consequences
 * (AR-10 continuation; Slice 1 moved the tribulation chain).
 *
 * This service sequences the FULL consequence set of a successful
 * breakthrough that previously lived in the Vue composable
 * useBreakthrough.ts: realm passive sync (idempotent, every success),
 * artifact awakening, and the banked artifact tier release. It returns
 * a typed result; the Vue adapter only displays
 * the announcement (A7).
 *
 * Characterization evidence (2026-09-11): CultivationSystem.breakthrough()
 * never crosses a major realm - major transitions belong to the
 * tribulation chain (Slice 1 service). P7-M3 removed the documented-dead
 * technique-swap branch that lived here (the spell Truc Co technique is
 * now folded into five_elements_art.gradeEffects[2]); the artifact-
 * awakening branch stays verbatim (documented-dead) so its eventual
 * removal remains an evidence-based cleanup, not a silent behavior
 * change.
 *
 * Writer contract (A3/A6): same pattern as TribulationOutcomeService -
 * the caller passes the Pinia player store instance (which satisfies
 * PlayerData), never `store.$state`: writing an absent optional key
 * (artifact is declared in defaults as undefined; treat any future
 * optional keys accordingly) does not reflect through the store proxy
 * (probe evidence 2026-09-11). Core stays Pinia-free (structural typing).
 */
import type { PlayerData } from '../player/Player'
import {
  advanceArtifactRealmLevel,
  ARTIFACT_UNLOCK_REALM_ID,
  createDefaultArtifactProgress,
  isArtifactDomainUnlocked,
} from '../artifact/ArtifactProgression'
import { resolveExpectedArtifactId } from '../artifact/Artifact'
import { getCurrentRealm } from '../realm/realmSystem'
import type { OutcomeAnnouncement } from '../presentation/OutcomeAnnouncement'

/** Breakthrough outcome facts for presentation. */
export interface BreakthroughSuccessResult {
  kind: 'success'
  /** Player realmLevel after the breakthrough. */
  newLevel: number
  /** True when realmId changed — impossible today (see header), kept for parity. */
  majorRealmChanged: boolean
  /** True when an artifact existed and the banked-tier release ran. */
  artifactTouched: boolean
  /** i18n descriptor for a major-realm change (null for minor levels). */
  announcement: OutcomeAnnouncement | null
}

export interface BreakthroughFailureResult {
  kind: 'failure'
}

export type BreakthroughOutcomeResult = BreakthroughSuccessResult | BreakthroughFailureResult

/** Same writer semantics as TribulationOutcomeService (store instance). */
export type BreakthroughPlayerWriter = PlayerData & {
  /** Store-level action; satisfied by the Pinia player store. */
  breakthrough: () => boolean
}

/**
 * Narrow consequence contract (A6) - satisfied by
 * GameManagerRealmAdvanceOps. Previously the whole GameManager.
 */
export interface BreakthroughConsequencesContext {
  syncRealmPassive(player: PlayerData): void
  syncRealmStatPassive(player: PlayerData): void
}

export class BreakthroughOutcomeService {
  /**
   * Attempt a minor-realm breakthrough and apply the full consequence set
   * on success. Failure performs no writes (domain breakthrough() guards).
   */
  breakthrough(player: BreakthroughPlayerWriter, context: BreakthroughConsequencesContext): BreakthroughOutcomeResult {
    const realmIdBefore = player.realmId

    // Domain authority for the level-up itself (canBreakthrough gate,
    // cultivation reset, realmLevel++, attributePoints++).
    const success = player.breakthrough()

    if (!success) {
      return { kind: 'failure' }
    }

    // Realm passive sync runs after EVERY success (idempotent; same
    // sequencing the Vue composable used).
    context.syncRealmPassive(player)
    context.syncRealmStatPassive(player)

    let artifactTouched = false
    // Banked artifact tier release on every success (doc SS5.1) — the
    // artifact exists only after a KC awakening (tribulation chain today).
    // M-F-ARTIFACT-DEFER: the release additionally composes the domain
    // gate - a persisted dormant artifact is never advanced while the
    // domain is deferred (its realm may be unlocked already).
    if (player.artifact && isArtifactDomainUnlocked(player.realmId)) {
      advanceArtifactRealmLevel(player.artifact, player.realmLevel)
      artifactTouched = true
    }

    if (player.realmId !== realmIdBefore) {
      // UNREACHABLE today: CultivationSystem.breakthrough() returns false
      // at max minor level and never crosses realms; major transitions go
      // through the tribulation chain (Slice 1). Preserved verbatim from
      // useTribulation-era useBreakthrough.ts so removal is a separate,
      // evidence-based decision (A12).
      // M-F-ARTIFACT-DEFER: the awakening key moved to the shared domain
      // declaration (Kim Dan) AND composes the domain gate.
      if (player.realmId === ARTIFACT_UNLOCK_REALM_ID && !player.artifact && isArtifactDomainUnlocked(player.realmId)) {
        const artifactId = resolveExpectedArtifactId(player)

        if (artifactId) {
          player.artifact = createDefaultArtifactProgress(artifactId)
          artifactTouched = true
        }
      }

      return {
        kind: 'success',
        newLevel: player.realmLevel,
        majorRealmChanged: true,
        artifactTouched,
        announcement: {
          titleKey: 'announce.breakthrough.major.title',
          titleParams: { realm: getCurrentRealm(player.realmId).name.toUpperCase() },
          bodyKey: 'announce.breakthrough.major.body',
        },
      }
    }

    return {
      kind: 'success',
      newLevel: player.realmLevel,
      majorRealmChanged: false,
      artifactTouched,
      announcement: null,
    }
  }
}
