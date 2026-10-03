# Quick Adversarial QA — Scene 02 Character-Creation Scaffold

- Date: 2026-10-02
- Mode: quick
- Scope: scene-02 interior rebuild as fine-grained component scaffold (presentation restructure only; creation logic unchanged).
- Worktree: `.agent-worktrees/hk-scaffold`, branch `devin/hk-scene-scaffold` (base 223e89f6).

## Task-owned paths

- `src/components/onboarding/CharacterCreationScreen.vue` (template rewrite only; script byte-identical to 223e89f6)
- `src/components/scenes/creation/*` (19 new files: layout, vista, banner, desk, figure, scroll shell, ornaments, seal stamp, title block, section header, name field, name section, talent card, emblem, talent section, starter slot, footer, back button, art-needed.css)
- `src/locales/en.json`, `src/locales/vi.json` (appended keys only: nameStep.sectionTitle, talentStep.sectionTitle, talentStep.hint, headerSubtitle, vistaBanner, starterSlot.{title,pending})
- `docs/design/art-requests/02-character-creation.md` (new doc)

Excluded: nothing else dirty in the worktree (`git status` shows only the paths above).

## Risk map

`changed-risk-map.mjs`: all paths `unmappedPaths`, `deepAuditCandidate: false`. Manual routing: every path is presentational Vue/CSS/JSON/docs — domain pack = `ui-input-lifecycle`. One-hop consumers identified by code search: `src/App.vue` + `src/core/game/EarlyGameBootstrap.ts` (drive the auth/creation flow), `CharacterPanel.vue` (payload type consumer), and 9 e2e specs selecting `character-creation-screen`. No save/cloud, clock, economy, or Phaser-ownership boundary is touched — no mandatory deep escalation.

## Invariant ledger

| # | Invariant | Evidence |
|---|-----------|----------|
| I1 | Creation behavior unchanged: script (refs/computeds/handlers/emits/payload incl. `character` field) identical to 223e89f6 | `git show 223e89f6` diff of script block — identical |
| I2 | Every spec-pinned selector exists inside the screen | grep: `character-creation-screen`, `creation-name-input`, `creation-talent-{id}`, `creation-finish`, `creation-summary`, `data-hk-scene/region` markers all present in new components |
| I3 | `.hk-parallax-stack[data-stack=auth-creation]` with 6 layers is a descendant of `character-creation-screen` | CreationVista mounts `HuyenKimParallaxStack stack="auth-creation"` inside `creation-layout__vista` inside `<main>` |
| I4 | Input parity with old field: maxlength 20, autofocus, disabled while creating | CreationNameField `:value`/`update:modelValue`, `maxlength="20"`, `autofocus`, `:disabled` (parent passes `creating`); reroll + cards `:disabled="rolling || creating"` |
| I5 | `aria-describedby="creation-name-desc"` resolves to a real element | `id="creation-name-desc"` span in CreationNameSection |
| I6 | RESERVED audit block (starter slot) not built | CreationStarterSlot renders only when `visible` prop true; parent never sets it |
| I7 | Grid row geometry not disturbed by hover (spec pins 3 row tops) | hover styling = border-color + box-shadow only; no transform |
| I8 | Locale files remain valid JSON; existing keys untouched | `JSON.parse` both files OK; diff shows appends only |

## Ranked hypotheses and checks

1. **H1 locale JSON break** → both files parse (node JSON.parse). Rejected.
2. **H2 missing testid/region → e2e failures** → S02 fidelity spec passed (`9 buttons, 3 row tops, cardBox.x ≥ 52%`); stable-art scene-02 test passed (6-layer stack); accessibility keyboard journey passed; boot-fresh passed; scroll-lifecycle spec (7 tests) passed. Rejected.
3. **H3 hover transform breaks pinned geometry** → transform removed; spec green on rerun. Rejected (was a real defect found and fixed during implementation).
4. **H4 RESERVED/INVALID blocks accidentally rendered** → starter slot `visible=false` renders nothing (confirmed by `v-if` on root); dice button absent (audit INVALID). Rejected.
5. **H5 starter-slot / ornament elements capture pointer events over controls** → ornaments `aria-hidden`, `pointer-events:none` on ornament layer; CTA visible and clickable (runtime screenshot + specs). Rejected.
6. **H6 content taller than scroll clips CTA** → runtime screenshot at design size shows summary + CTA inside scroll body; `__body` overflow-y auto. Rejected.

## Findings

- **Pre-existing (not task-caused):** `huyen-kim-reference-fidelity.spec.ts` S02 asserts `toHaveCount(9)` on talent cards, but `rollCharacterCreationTalents()` draws 9 weighted picks from the 19-entry `CHARACTER_CREATION_TALENTS` catalog BEFORE the service's `isBetaCreationTalentId` filter runs. If `pham_cot` (cataloged but not beta-admitted) is drawn, the offer is 8 cards and the spec flakes. Observed once (8/9), then green on identical code. Root cause lives in `MockCharacterCreationService`/`Talents.ts`, untouched by this task — recommend coordinator file a spec/service fix (draw-then-top-up or draw from admitted pool). Severity: Low (test flake, service contract satisfied by "up to roll size" semantics).
- **Low (deferred):** name field keeps delivered `text-field` chrome (dark pill); ref shows a light pill. Recorded in the art request doc; chrome is shared delivered art, not scene-02-owned.

## Evidence run

- `npm run type-check` → green (vue-tsc build, exit 0)
- `npx vitest run src/components/onboarding/CharacterCreationScreen.test.ts` → 3/3 pass
- `npx playwright test huyen-kim-reference-fidelity.spec.ts --grep "S02 creation"` → pass
- `npx playwright test huyen-kim-stable-art.spec.ts --grep "scene 02"` → pass
- `npx playwright test accessibility.spec.ts boot-fresh.spec.ts huyen-kim-scroll-lifecycle.qa.spec.ts` → 7/7 pass

## Verdict

**PASS WITH EVIDENCE** — presentation-only restructure; all spec-pinned contracts verified at runtime; two findings recorded (one pre-existing flake out of scope, one deferred Low).
