# QA Review: Huyen Kim Phase-3 Core Progression screens

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/components/panels/CharacterPanel.vue`
  - `game/src/components/panels/RealmPanel.vue`
  - `game/src/components/panels/SkillPathPanel.vue`
  - `game/src/components/panels/realm/BodyChapterNav.vue` (new)
  - `game/src/components/panels/realm/BodyRefinementSection.vue`
  - `game/src/components/panels/realm/MeridianSection.vue`
  - `game/src/components/panels/realm/ZhouTianSection.vue`
  - `game/src/components/panels/skill-path/NodeTreePanel.vue`
  - `game/src/components/panels/skill-path/SkillConnections.vue`
  - `game/src/components/panels/skill-path/TechniqueBand.vue`
  - `game/src/components/panels/skill-path/TechniqueSlotCard.vue`
  - `game/src/components/panels/skill-path/TechniqueRuneRing.vue` (new)
  - `game/src/components/panels/skill-path/TechniqueRuneRing.test.ts` (new)
  - `game/src/components/onboarding/CharacterCreationScreen.vue`
  - `game/src/locales/vi.json`, `game/src/locales/en.json`
  - `game/docs/design/huyen-kim-phase3-progression-plan.md` (docs)

## Scope and Risk Map

changed-risk-map.mjs routed the task-owned paths to `economy-and-progression` + `ui-input-lifecycle` and flagged `deepAuditCandidate: true` ("cross-system change: 2 domains"). **Escalation declined, bounded by code inspection:** every gameplay call (`investBodyChapter`, `canTriggerBreakthrough`, `getBreakthroughRequirements`, `canPurchaseNode`/`canUpgradeNode`, respec ops) is an unchanged read/invoke against existing domain APIs; no state authority, persistence schema, economy quantity, or unlock rule moved. The economy-and-progression hit is the directory layout (`realm/`, `skill-path/`), not a behavior change. No save/cloud, clock/offline, or combat path is touched, and no Pinia/Phaser ownership changed (L8 DOM-only reskin per task).

`unmappedPaths` (locales): manually routed — pure data additions `panels.realm.nodes.next` + `panels.realm.body.{title,navAria}` consumed by `t()` in RealmPanel/BodyChapterNav; both locales updated symmetrically (P16).

One-hop consumers inspected: `LeftPanel` (CharacterPanel mount), `OverlayPanel` (realm/skill overlays, `container-name: overlay-panel` used by the new media rules), `useRealmStatPassives`, `realmAdvanceOps`, `useThienCoEntries` (untouched, Phase-2 lane).

## Invariant Ledger

| # | Invariant | Operator | Hypothesis | Result |
|---|-----------|----------|------------|--------|
| 1 | Pinned test selectors never regress (`.meridian__node*`, `.element-node*`, `.realm-panel__actions` > requirements, `.node-tree__node*`, section `--status` classes, `creation-*` testids) | diff + scoped vitest | A restructured template drops/renames a pinned selector | Killed — all pinned selectors preserved verbatim; new classes additive (`is-next`, `is-available`, `is-upgradable`, `is-ignited`) |
| 2 | Ignite watchers only fire on progress increase and never leak timers | read | `watch(...completed)` on non-monotonic input or unmount mid-flash leaks a timer or throws | Killed — `now <= before` guard, `onBeforeUnmount` clears timer in RealmPanel + 3 sections |
| 3 | `tierRows[now-1]` index for ignited row stays in bounds | bounds | Completed count exceeds row array on restore/multi-jump | Killed — `?.id ?? null` bounds-guarded |
| 4 | Hidden progression stays hidden (spec §16.1) | read | Thiên Lộ path or body nav reveals hidden realms early | Killed — `comingSoon` renders "Coming soon", no hidden rung authored; Quan The / Nghich Chu Thien keep existing `discovered`/`revealed` gates |
| 5 | Element disc URL resolves for every element + pre-path fallback | read | `getActiveElement`/`chosenKit.element` returns an element with no asset | Killed — `el-{wood,fire,earth,metal,water,primordial}.png` + `el-formation-ring.png` all exist in `public/assets/ui/elements/` |
| 6 | Study Mode action rails never orphan a dead control | read | Action buttons moved to rail lose handlers/disabled state | Killed — handlers/disabled bindings moved verbatim (details toggle, quan-khi, breakthrough CTA, respec, invest) |
| 7 | Locked chapter nav stays informative, not dead | read | Locked BodyChapterNav item is a dead control | Killed — locked items intentionally clickable; they open the chapter column which renders its own gate explanation |
| 8 | Realm path ordering renders ascending bottom-up | read | `column-reverse` puts mortal at top | Killed — DOM order + `column-reverse` places realmNodes[0] (mortal) visually at the bottom; spine gradient `to top` matches |
| 9 | `is-unlocking` must win over `is-upgradable` breathing | read | Both classes -> two animations conflict | Bounded — `is-unlocking` rule is later in the stylesheet and overrides `animation` |
| 10 | `v-tooltip` resolves on talent seals | read | Directive unregistered -> runtime error | Killed — `src/directives/tooltip.ts` exists and is registered (used by SlotView etc.) |
| 11 | `player.name.charAt(0)` seal on current rung | read | Empty name -> empty seal box | Nit — cosmetic edge; name is required non-empty at creation |
| 12 | Second invest within the 1.4 s flash window replays animation | read | `igniting` already true -> animation does not restart | Low — cosmetic; invest is a deliberate single click, re-arm is 1.4 s |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` (vue-tsc --build) | PASS, exit 0 | Full project graph |
| `npx vitest run` on 8 touched-scope files (RealmPanel, RealmBodySections, SkillPathPanel, NodeTreePanel, TechniqueBand, TechniqueRuneRing, CharacterPanel.meridian, CharacterCreationScreen) | PASS — 52/52 tests | Scoped per P3 quick; no full-suite run (not a P3-full trigger) |
| Asset existence check `public/assets/ui/elements/el-*.png`, `stat-meridian-figure.png` | All present | Direct `ls` |
| `v-tooltip` registration | Registered (`src/directives/tooltip.ts`) | Source inspection |
| Container name `overlay-panel` for new `@container` rules | Confirmed (`OverlayPanel.vue:92`) | Source inspection |

## Findings

### QA-2026-09-30-HK3-1: Double-invest inside the 1.4 s window does not replay ignite flash
- Severity: Low
- Status: Suspected
- Invariant: #12
- Preconditions: Player invests twice within 1400 ms on zhou_tian/meridian.
- Reproduction: Invest -> `igniting` true; second invest inside window -> watcher re-arms timer but class never toggles off, so the CSS animation does not restart.
- Expected: Each landed invest replays the flash.
- Actual: The flash from the first invest simply persists slightly longer.
- Evidence: Source inspection (`watch` in each section / RealmPanel).
- Test file: none
- Owner subsystem: realm body sections (presentation only)
- Blast radius: Cosmetic only; no state.

### QA-2026-09-30-HK3-2: Empty player name renders an empty current-rung seal
- Severity: Nit
- Status: Suspected
- Invariant: #11
- Preconditions: `player.name === ''` (creation enforces non-empty; no runtime path empties it).
- Expected: Seal shows an initial or falls back.
- Actual: `charAt(0)` renders '' inside a small bordered box.
- Evidence: Source inspection.
- Test file: none
- Owner subsystem: RealmPanel hero path
- Blast radius: Cosmetic edge; unreachable through normal play.

## New or Changed QA Tests

- `game/src/components/panels/skill-path/TechniqueRuneRing.test.ts` (new) — proves lit/total rune counting, clamping, and aria-hidden decoration for the new §18 rank ring.

## Gaps and Residual Risk

- Visual-only change; no Playwright pixel evidence was produced (P13/P14 not triggered by a style reskin, and dev-server runtime verification is delegated to the P5 integration pass's scope decision).
- `is-next`/`is-future` semantics on the Thiên Lộ path are only source-inspected; a live screenshot would confirm the gold-trace/mist separation.
- Full vitest suite not run (P3 quick scope per AGENTS.md).

## Pre-existing Failures

None observed during scoped verification.
