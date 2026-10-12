/**
 * Guard (BETA FE-CONTRACT sec.8) - scope-exposure bans layered on top of
 * the read-model consumption guards in betaFrontendReadModels.test.ts.
 * That file polices WHICH authority a live surface consumes; this file
 * polices whether a scope-hidden surface exists in the shell at all:
 *
 *   - no Ultimate beta slot: the rail model emits the ultimate role
 *     permanently scope-hidden, so a beta surface may never carry the
 *     token or reach for the live-combat role authorities;
 *   - no Kim Dan CTA: betaNextRealmSurfaceFor fails closed at the Truc Co
 *     ceiling - golden_core/kim_dan vocabulary never reaches the shell;
 *   - no companion/formation/artifact/worker-lodge exposure: mounts live
 *     at two gated seams (GameRoot standalone, FunctionOverlayPanel left
 *     panel) and nowhere else, and their dormant availability
 *     authorities stay in core;
 *   - no re-derived admission: stage unlock predicates, the raw alchemy
 *     recipe catalog, and the workforce builder all live behind beta
 *     surface models (getStageSurfaceModels / getBetaAlchemyRecipeModels
 *     / buildingOps.getWorkforceView);
 *   - no element-branch reconstruction: the committed element is a model
 *     field (BetaSkillTree.element), never a player.spellPath read or a
 *     getActiveElement call;
 *   - no daily quest surface: quest cadence is 'once' only;
 *   - navigation seams keep their scope gates pinned by assertion.
 *
 * Recorded exceptions follow the ReleasePolicy-ban convention from
 * betaFrontendReadModels.test.ts: each exception names a live or
 * dormant pre-migration carrier the contract already covers - a NEW
 * beta surface may never widen the list.
 *
 * Setup note: tests/setup.betaScope.ts unlocks ways + features globally,
 * so the scope assertions re-pin the production locks first (same
 * convention as betaScopeSkillDomain.test.ts).
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus, isTestFile } from './helpers/scanTs'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

lockBetaWaysForTests()
lockBetaFeaturesForTests()

const SRC_DIR = join(process.cwd(), 'src')

const SHELL_FILES = srcCorpus(SRC_DIR).filter(
  (file) =>
    !isTestFile(file.fromSrc) &&
    (file.fromSrc.startsWith('components/') ||
      file.fromSrc.startsWith('composables/') ||
      file.fromSrc.startsWith('stores/')),
)

/** Shell files carrying `pattern`, minus the recorded exceptions. */
function offenders(pattern: RegExp, exceptions: readonly string[] = []): string[] {
  return SHELL_FILES.filter(
    (file) => pattern.test(file.text) && !exceptions.includes(file.fromSrc),
  ).map((file) => file.fromSrc)
}

/** Text minus comments - a token named only inside a comment is never a
 *  contract violation (bans below must read CODE, not prose). */
function codeOnly(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
}

function offendersInCode(
  pattern: RegExp,
  exceptions: readonly string[] = [],
): string[] {
  return SHELL_FILES.filter(
    (file) =>
      pattern.test(codeOnly(file.text)) && !exceptions.includes(file.fromSrc),
  ).map((file) => file.fromSrc)
}

describe('beta FE-contract sec.8 - scope-exposure corpus guards', () => {
  it(
    'has a shell corpus to police - a guard over nothing proves nothing',
    () => {
      expect(SHELL_FILES.length).toBeGreaterThan(50)
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file creates an Ultimate beta slot - the rail emits it scope-hidden',
    () => {
      // betaCombatRolesFor always emits the ultimate entry as
      // {state:'scope-hidden'}; a beta surface renders entries, it never
      // names the role. Recorded exceptions are the live-combat carriers
      // whose role row predates the beta rail contract
      // (TurnCombatSkillBar's 'an-ultimate-emblem' surface id /
      // useTurnCombatManual's slotList) and the dormant companion panel
      // vocabulary - a new beta surface may not join the list.
      const list = offenders(/\bultimate\b/, [
        'components/game/combat/hud/TurnCombatSkillBar.vue',
        'components/panels/CompanionPanel.vue',
        'composables/useTurnCombatManual.ts',
        // SkillSurface's design_ultimate_placeholder is the skill
        // design-mode seat in Minh's design tree (owner ruling
        // 2026-10-09: master design-mode intent) - a locked placeholder
        // stub, never a live-combat ultimate role row.
        'components/scenes/skill/SkillSurface.vue',
      ])

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file carries Kim Dan vocabulary - there is no beyond-ceiling CTA',
    () => {
      // betaNextRealmSurfaceFor returns null at the release ceiling, so
      // beta UI has no next-realm prompt into golden_core. The two
      // exceptions carry display vocabulary only (material tooltip realm
      // names; the dormant the-tu tree's section labels) - neither is a
      // call to action.
      const list = offenders(/golden_core|goldenCore|kim_dan|kimDan/, [
        'components/panels/bag-sections/MaterialBagSection.vue',
        // Realm label key map lives in the shared material tooltip
        // builder (extracted from MaterialBagSection) - same provenance
        // display vocabulary, never a next-realm CTA.
        'composables/useMaterialTooltip.ts',
      ])

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'dormant panels mount only at the two gated seams',
    () => {
      // GameRoot mounts standalone panels behind isBetaStandalonePanel;
      // FunctionOverlayPanel mounts the left panel behind
      // isBetaLeftPanelMode. Any OTHER import path, component tag, or
      // lazy import of a scope-hidden panel is a contract violation.
      const panelName = '(CompanionPanel|TranPhapPanel|ArtifactPanel|WorkerLodgePanel)'
      const mountRe = new RegExp(
        `\\bimport\\b[^;\\n]*\\b${panelName}\\b|<${panelName}\\b|panels/${panelName}\\.vue`,
      )

      const list = offenders(mountRe, [
        'components/layout/GameRoot.vue',
        'components/layout/FunctionOverlayPanel.vue',
      ])

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'dormant availability authorities stay out of the shell',
    () => {
      // The wheel and HUD carry pre-beta dead contexts (scope-hidden
      // slots/chips already filtered upstream of them) - recorded
      // exceptions. Everything else must consult betaWheelSlots /
      // isBetaStandalonePanel / BETA_FEATURES, never the dormant
      // domain-unlock predicates.
      const list = offenders(
        /\b(isCompanionDomainUnlocked|isArtifactDomainUnlocked|isFormationUnlocked)\b/,
        [
          // DongFuStage builds the wheel disabledContext
          // from the domain predicates - dead
          // contexts stay upstream of betaWheelSlots admission.
          'components/scenes/dong-fu/DongFuStage.vue',
          // S03 fidelity: the chip predicates live in useCurrencyChips -
          // extracted from CurrencyHud so the fidelity HUD and the legacy
          // pill strip share the same filtered model.
          'composables/useCurrencyChips.ts',
        ],
      )

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file exposes a daily quest surface',
    () => {
      // Quest cadence is 'once' only: isBetaQuestEnabled fails closed on
      // daily and the surface model emits cadence:'once'. Any 'daily'
      // token in the shell - literal, i18n key, identifier, cadence
      // string - is a daily surface leaking; the word appears nowhere.
      const list = offenders(/daily/i)

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file reconstructs the committed element - the model emits it',
    () => {
      // Branch visibility is BetaSkillTree.element + per-node state;
      // reaching for player.spellPath or a domain element accessor is a
      // reconstruction. CharacterPanel is the recorded exception: it
      // reads the committed element for hero-art identity only, never
      // for branch visibility.
      const elementReads = offendersInCode(
        /\bgetActiveElement\b|\.spellPath\b/,
        [
          'components/scenes/character/CharacterFigureWheel.vue',
          // CharacterSurface reads the committed element for the
          // identity-plate dao label only (Ly Hoa Chi Dao name + verse),
          // never for branch visibility - same class of exception as
          // CharacterFigureWheel's hero-art identity read.
          'components/scenes/character/CharacterSurface.vue',
        ],
      )

      expect(elementReads).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file re-derives stage admission - the surface model carries it',
    () => {
      // StageSurfaceModel already resolves state + disabledReason +
      // displayEnemy + rewardPreview. catalogOps.getStage /
      // getEnemyTemplate stay legal (pure registry reads); the unlock
      // predicates are the dormant authority the model composes - banned
      // as identifiers so a direct import bypasses nothing. Recorded
      // exceptions are the two pre-migration consumers the contract
      // retires onto the model.
      const list = offendersInCode(
        /\b(isStageUnlocked|stageLockReasonCode)\b/,
        ['components/game/combat/CombatVictoryPanel.vue'],
      )

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file enumerates raw alchemy recipes or predicates - the model filters families',
    () => {
      // getBetaAlchemyRecipeModels restricts to BETA_ENABLED_RECIPE_FAMILIES
      // and folds sufficiency into craftable; enumerating the raw recipe
      // catalog or calling the domain predicates directly re-opens the
      // dormant families.
      const list = offendersInCode(
        /\b(getAlchemyRecipes|jobSuccessPercent|alchemySecondsFor|isBreakthroughAcquisitionEnabled)\b/,
        ['components/scenes/alchemy/AlchemySurface.vue'],
      )

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file builds the workforce view directly - the ops seam is gated',
    () => {
      const list = offendersInCode(
        /\bbuildWorkforceView\b|\bresolveProductionWorkerCapacity\b/,
      )

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'beta role surfaces consume betaCombatRolesFor - not the live-combat authority',
    () => {
      // getResolvedSkillRoles / buildTurnSkillPresentation resolve the
      // live role row (they can emit an ultimate); the beta rail consumes
      // the scope verdicts. Banned as identifiers so a direct import
      // bypasses nothing. useTurnCombatManual is the recorded exception:
      // the live cast loop stays on slotList (contract sec.3).
      const list = offendersInCode(
        /\b(getResolvedSkillRoles|buildTurnSkillPresentation)\b/,
        ['composables/useTurnCombatManual.ts'],
      )

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the hidden-way capability authority stays out of new shell files',
    () => {
      // hasPathCapability/hasStaticPathCapability feed the ngo_dao
      // emblem + hidden-way surfaces; betaCombatSurfacesFor already
      // verdicts both scope-hidden, so the shell consumes the
      // verdicts only. Recorded exception: QuanKhiPanel resolves
      // 'sword.sword_riding' to pick the hidden_sword_pathway preset
      // editor - a pathway read inside the ritual's own gated seam,
      // not a hidden-way admission verdict.
      const list = offenders(/\b(hasPathCapability|hasStaticPathCapability)\b/, [
        'components/panels/QuanKhiPanel.vue',
      ])

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'no shell file reaches the raw wheel catalog - betaWheelSlots is the only source',
    () => {
      const list = offenders(/\bCOMMAND_WHEEL_SLOTS\b/)

      expect(list).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the gated seams keep their scope gates',
    () => {
      // Positive pins: if a gate is deleted, the exception lists above
      // become live exposures. Each pin asserts the seam still consults
      // the beta allow-lists.
      const mustContain: Record<string, string[]> = {
        'components/layout/GameRoot.vue': ['isBetaStandalonePanel'],
        // FunctionOverlayPanel mounts worker_lodge unconditionally, but
        // the ui store fails closed on isBetaLeftPanelMode before any
        // mode reaches it - the store is the gate this pin guards.
        // Default-built (2026-10-03): the building popover was removed
        // with the build mechanic, so the isBetaBuildingSurface read
        // left this file with it - the two panel gates remain the pins.
        'stores/ui.ts': [
          'isBetaStandalonePanel',
          'isBetaLeftPanelMode',
        ],
        // DongFuStage is the live wheel host - the betaWheelSlots pin
        // moved here when the legacy wheel layer was deleted.
        'components/scenes/dong-fu/DongFuStage.vue': ['betaWheelSlots'],
        'components/scenes/equipment/EquipmentSurface.vue': ['isBetaEquipmentTab'],
        // S03 fidelity: the companion-currency gate moved into
        // useCurrencyChips when the HUD strip was extracted.
        'composables/useCurrencyChips.ts': ['isBetaFeature'],
        'components/panels/QuanKhiPanel.vue': ['isBetaWay'],
      }

      for (const [fromSrc, tokens] of Object.entries(mustContain)) {
        const file = SHELL_FILES.find((entry) => entry.fromSrc === fromSrc)

        expect(file, `${fromSrc} missing from corpus`).toBeDefined()
        for (const token of tokens) {
          expect(
            file!.text,
            `${fromSrc} must keep its scope gate (${token})`,
          ).toContain(token)
        }
      }
    },
    SCAN_TIMEOUT,
  )
})
