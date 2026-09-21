/**
 * R8.2 Slice 2 — Domain owner of minor-realm breakthrough consequences
 * (AR-10 continuation; Slice 1 moved the tribulation chain).
 *
 * This service sequences the FULL consequence set of a successful
 * breakthrough that previously lived in the Vue composable
 * useBreakthrough.ts: realm passive sync (idempotent, every success),
 * the KC technique grant, artifact awakening, and the banked artifact
 * tier release. It returns a typed result; the Vue adapter only displays
 * the announcement (A7).
 *
 * Characterization evidence (2026-09-11): CultivationSystem.breakthrough()
 * never crosses a major realm — major transitions belong to the
 * tribulation chain (Slice 1 service). The technique-grant and
 * artifact-awakening branches keyed on realmId change in the old Vue code
 * are therefore unreachable in the production flow; they are preserved
 * VERBATIM here (documented-dead) so their eventual removal is an
 * evidence-based cleanup, not a silent behavior change.
 *
 * Writer contract (A3/A6): same pattern as TribulationOutcomeService —
 * the caller passes the Pinia player store instance (which satisfies
 * PlayerData), never `store.$state`: writing an absent optional key
 * (artifact is declared in defaults as undefined; treat any future
 * optional keys accordingly) does not reflect through the store proxy
 * (probe evidence 2026-09-11). Core stays Pinia-free (structural typing).
 */
import type { PlayerData } from '../player/Player'
import type { TechniqueManager } from '../technique/TechniqueManager'
import { advanceArtifactRealmLevel } from '../artifact/ArtifactProgression'
import { resolveExpectedArtifactId } from '../artifact/Artifact'
import { hasStaticPathCapability } from '../player/CultivationPathSystem'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
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
  readonly techniqueManager: TechniqueManager
  syncRealmPassive(player: PlayerData): void
  syncRealmStatPassive(player: PlayerData): void
  learnTechnique(techniqueId: string): boolean
  equipTechnique(techniqueId: string): boolean
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
    if (player.artifact) {
      advanceArtifactRealmLevel(player.artifact, player.realmLevel)
      artifactTouched = true
    }

    if (player.realmId !== realmIdBefore) {
      // UNREACHABLE today: CultivationSystem.breakthrough() returns false
      // at max minor level and never crosses realms; major transitions go
      // through the tribulation chain (Slice 1). Preserved verbatim from
      // useTribulation-era useBreakthrough.ts so removal is a separate,
      // evidence-based decision (A12). The technique grant duplicates
      // grantCultivationPathRealmReward's phap_tu branch by design.
      // M4 (R6): the ngu_hanh realm technique is way-owned — a collapsed
      // ('phap_tu','ngo_dao') player must not inherit it.
      if (hasStaticPathCapability(player, 'phap_tu.elemental_casting') && player.realmId === 'foundation_establishment') {
        const inheritedInsight = context.techniqueManager.getEquipped()?.insight ?? 0
        context.learnTechnique('dai_ngu_hanh_quyet_truc_co')
        const nextTechnique = context.techniqueManager.get('dai_ngu_hanh_quyet_truc_co')
        if (nextTechnique) nextTechnique.insight = Math.max(nextTechnique.insight ?? 0, inheritedInsight)
        context.equipTechnique('dai_ngu_hanh_quyet_truc_co')
      }

      if (player.realmId === 'foundation_establishment' && !player.artifact) {
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
