# QA Review: character tab fixes (element discs removed, Chi Tiet always-on, stat source hover)

- Date: 2026-10-03
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/components/scenes/character/**` (fidelity surface + surface adapter + dead-tree cleanup), `game/src/components/common/Tooltip.vue`, `game/src/composables/useTooltip.ts`, `game/src/core/stats/StatCalculator.ts` (additive `explainStatBreakdown`), `game/src/core/player/Player.ts` (additive return fields), `game/src/stores/ui.ts`, `game/src/presentation/audio/uiAudioBinding.*`, `game/src/locales/{vi,en}.json`, `game/src/ui-preview/{CharacterPreview.vue,character.ts,characterMessages.ts}`, `game/tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts`, new `game/src/components/scenes/character/fidelity/statSources.ts`, new `game/src/core/stats/StatCalculator.explainStatBreakdown.test.ts`.

## Scope and Risk Map

changed-risk-map output: domains combat-and-tribulation, economy-and-progression, inventory-equipment, pinia-phaser-sync, ui-input-lifecycle; `deepAuditCandidate: true` ("shared stat pipeline feeds combat, progression, and equipment outcomes"; 5 domains).

**Escalation decision — bounded, no deep escalation.** The stat pipeline is byte-identical: `runPipeline`/`applyDomainGate`/`deriveAttributeModifiers`/`calculateStats`/`calculateEffectiveStats` unchanged; `resolvePlayerStatAssembly` keeps the identical `calculateStats(pipelineBase, [...allModifiers, ...pathModifiers])` call (bound to a local `modifiers`) and only widens its return type. `explainStatBreakdown` is a new pure read-model invoked solely by the character board; it mutates nothing and writes no store/domain state. The store deletion (`characterDetailOpen`) has zero remaining consumers (grep-clean; its only live consumer was the removed toggle). No save/persistence, economy, combat-transition, or Phaser-lifecycle change exists in the diff. One-hop consumers of the assembly (`resolvePlayerFinalStats`, CombatBuild, BodyChapter/BodyProgressionSystem, useRealmStatPassives) read `.stats`/`.wayFacetModifiers` — unchanged fields.

Exclusions: none — all dirty paths are task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-CTS-1 | Character board value (model computed) | stateVersion bump -> assembly resolve + per-stat breakdown | Synchronization: breakdown reconciles to `calculateStats` output | Value mutation (tags, stacks, multiplier) | Reconstructed fold equals canonical value | Unit (StatCalculator.explainStatBreakdown.test.ts) | High - wrong attribution defeats the feature |
| INV-CTS-2 | Store `characterDetailOpen` | field/action deletion | Lifecycle: no dangling references reset a ghost flag | Stale state | grep + type-check + store consumers | type-check + vitest + grep | High - removed shared flag |
| INV-CTS-3 | Chi Tiet dock | nav swap character->inventory->character | Lifecycle: dock is structural, never leaks or resurrects | Interruption | `.cf-details__body` visible pre/post swap | Playwright (huyen-kim-scroll-lifecycle) | Medium - asserted live |
| INV-CTS-4 | Hand effect slot (figure) | render | Boundedness: non-interactive, visible, does not intercept pointer | Degraded environment | `.cf-effect-slot` present inside pointer-events:none figure | Visual (ui-character.html) | Medium |
| INV-CTS-5 | `resolveStatSourceName` catalogs | hover any stat | Recoverability: unknown/garbage sourceId never throws | Value mutation (missing instance/zone/way) | mortal player + missing equipment -> category fallback | Source inspection + preview render | Medium |
| INV-CTS-6 | Tooltip content snapshot | hover during state change | Stale state: tooltip snapshot at bind matches row semantics | Timing boundary | Same contract as existing technique/item tooltips | Source inspection | Low |
| INV-CTS-7 | uiAudioBinding panel signature | overlay/standalone transitions | Exactly-once: close+open cues on swap | Reorder | cues sequence | Unit (uiAudioBinding.test.ts) | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | clean, exit 0 | whole repo incl. dead-code tree |
| `npx vitest run src/core/stats src/components/scenes/character src/presentation src/stores src/composables` | 637 passed | touched scope |
| `npx vitest run src/components/panels src/components/common` | 260 passed | dead-tree + Tooltip consumers |
| `npx vitest run tests/architecture` | 933 passed, 7 expected-fail, 8 skipped | incl. asciiComments + stat-provenance guards |
| `npx playwright test ... -g "character detail dock"` | 1 passed (live app) | nav-swap dock persistence |
| Dev server `localhost:5199/ui-character.html` visual | discs removed, hand slot ring visible on palm, Chi Tiet always open, hover tooltip shows Thanh Phan rows | screenshot + DOM |
| Hover `The Chat` row | tooltip: Co Ban 108 / Luyen The +12 / Trang Bi +22 -> 142 | reconciles |
| Hover `Ti le bao kich` row | tooltip: Co Ban 5.0% / Than Phap +8.5% / Trang Bị +5.0% -> 18.5% | reconciles |
| grep `characterDetailOpen\|toggleCharacterDetail\|details-open\|toggle-details` | zero hits in src/ outside unrelated SkillSurface `selectedElement` | clean removal |

## Findings

### QA-2026-10-03-01: Ngũ Hành mini-icon summary row retained in stats column
- Severity: Low
- Status: Confirmed (behavior note, not a defect)
- Invariant: user request "remove ALL 5 element icons"
- Reproduction: open character tab -> `.cf-element-summary` under "Ngu Hanh" heading shows 5 mini element icons + share %
- Expected (ambiguous): possibly also remove
- Actual: kept — it is a data readout row, not the removed clickable figure discs
- Evidence: CharacterFidelityStats.vue `.cf-element-summary`; guidance says ambiguous divergences keep current behavior + flag
- Test file: none
- Owner subsystem: character fidelity surface
- Blast radius: presentation only; user decision needed to remove the summary too

### QA-2026-10-03-02: Percent-pool attribution rows are relative, not additive
- Severity: Low
- Status: Confirmed (inherent model semantics, documented)
- Invariant: hover breakdown should be truthful
- Actual: `+X%` rows are Increased-pool amounts (relative multipliers of the running value), `xN` rows are More multipliers — they do not linearly sum to the total; flats do
- Evidence: statSources.contributionText renders the pool amount; reconstruction test proves the fold matches
- Test file: StatCalculator.explainStatBreakdown.test.ts
- Owner subsystem: stat read-model
- Blast radius: tooltip display semantics only

### QA-2026-10-03-03: Character surface resolves the stat assembly once more per state bump
- Severity: Low
- Status: Confirmed (bounded cost)
- Invariant: Boundedness/perf
- Actual: model computed calls `resolvePlayerStatAssembly` directly (needed for pipelineBase/bodyBaseDeltas/modifiers) while `player.finalStats` remains a separate cached resolve — net +1 assembly per stateVersion bump on the character surface
- Evidence: CharacterSurface.vue model computed
- Test file: none
- Owner subsystem: character surface
- Blast radius: one extra O(modifiers) fold per bump; negligible

### QA-2026-10-03-04: Source hover not covered by an e2e assertion
- Severity: Low
- Status: Coverage gap
- Invariant: rendered tooltip content correctness is unit-covered (fold), live-render covered by manual dev-server observation; no Playwright hover assertion on the breakdown rows
- Evidence: manual verification at /ui-character.html
- Test file: none (directive is shared global mechanism)
- Owner subsystem: tooltip
- Blast radius: display only

## New or Changed QA Tests

- `src/core/stats/StatCalculator.explainStatBreakdown.test.ts` — groups by (sourceType, sourceId), preserves flat/per-tag pools/multiplier^stacks, attributes attribute-derivation to its attribute, sees post-pass-1 totals, and reconstructs to `calculateStats` output.
- `src/presentation/audio/uiAudioBinding.test.ts` — rewritten: ordered panel signature over overlay/standalone only (detail flag deleted).
- `tests/e2e/huyen-kim-scroll-lifecycle.qa.spec.ts` — rewritten: asserts the dock body is always visible and survives nav swap (toggle removed).

## Gaps and Residual Risk

- Element-summary retention flagged for user decision (QA-...-01).
- e2e does not assert tooltip row contents (coverage gap only; the v-tooltip directive is an existing global mechanism).
- Preview fixture `sources` is hand-authored sample data (readout shape verified, not live catalogs) — live catalog resolution is type-checked + source-inspected, and every resolver path has a fallback.

## Pre-existing Failures

- None observed in the touched scope; the legacy `CharacterPanel`/`CharacterFigureWheel`/`CharacterDetailCard` tree is dead code kept compiling (its tests still pass); dead `.character-detail__close` CSS remains inside the dead card.
