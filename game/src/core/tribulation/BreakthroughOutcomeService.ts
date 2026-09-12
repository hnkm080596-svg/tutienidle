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
import type { GameManager } from '../game/GameManager'
import { advanceArtifactRealmLevel } from '../artifact/ArtifactProgression'
import { ARTIFACT_ID_BY_CULTIVATION_PATH } from '../artifact/Artifact'
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

export class BreakthroughOutcomeService {
  /**
   * Attempt a minor-realm breakthrough and apply the full consequence set
   * on success. Failure performs no writes (domain breakthrough() guards).
   */
  breakthrough(player: BreakthroughPlayerWriter, gameManager: GameManager): BreakthroughOutcomeResult {
    const realmIdBefore = player.realmId

    // Domain authority for the level-up itself (canBreakthrough gate,
    // cultivation reset, realmLevel++, attributePoints++).
    const success = player.breakthrough()

    if (!success) {
      return { kind: 'failure' }
    }

    // Realm passive sync runs after EVERY success (idempotent; same
    // sequencing the Vue composable used).
    gameManager.syncRealmPassive(player)
    gameManager.syncRealmStatPassive(player)

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
      if (player.cultivationPath === 'phap_tu' && player.realmId === 'foundation_establishment') {
        const inheritedInsight = gameManager.techniqueManager.getEquipped()?.insight ?? 0
        gameManager.learnTechnique('dai_ngu_hanh_quyet_truc_co')
        const nextTechnique = gameManager.techniqueManager.get('dai_ngu_hanh_quyet_truc_co')
        if (nextTechnique) nextTechnique.insight = Math.max(nextTechnique.insight ?? 0, inheritedInsight)
        gameManager.equipTechnique('dai_ngu_hanh_quyet_truc_co')
      }

      if (player.realmId === 'foundation_establishment' && !player.artifact) {
        const artifactId = player.cultivationPath
          ? ARTIFACT_ID_BY_CULTIVATION_PATH[player.cultivationPath]
          : undefined

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
