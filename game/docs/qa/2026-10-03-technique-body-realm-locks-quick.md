# Quick Adversarial QA — Technique/Body/Realm locks (2026-10-03)

Scope: task-owned diff only (technique tab progression lock + placeholder
cleanup; body tier lock + canonical naming restore + font shrink; realm
staircase even spacing). changed-risk-map.mjs returned every path as
`unmappedPaths`; manual routing: domain pack `ui-input-lifecycle` (panel
mount seams, nav locks, chapter flips) plus `economy-and-progression`
(progression gating only — no economy mutation). Preview fixtures
(`src/ui-preview/*`) reviewed as evidence-only files, not gameplay.
`deepAuditCandidate: false`; risk bounded by code inspection — no save,
offline, economy-mutation, or Phaser lifecycle surface touched, so quick
mode stays authoritative.

## Invariant ledger

| ID | State/owner | Attack operator | Invariant | Oracle | Result |
| --- | --- | --- | --- | --- | --- |
| INV-LOCK-1 | `ui.standalonePanel` / GameRoot mount watcher | direct write bypass | sealed panel never mounts | `standalonePanel` reset to null before `mountedStandalone.add` | Holds (code path inspected + watcher immediate) |
| INV-LOCK-2 | corrupt save: mortal + cultivationWay | value mutation | realm gate still seals | `getRealmIndex('mortal') < qi_refining` fails closed | Holds (unit test added) |
| INV-LOCK-3 | `usePaperNavigation` items/navigate | reactivity + repeat | dimmed item refuses every click | `progressionLocked` inside computed tracks `player.$state` | Holds |
| INV-BODY-1 | filtered `units` arrays | value mutation | `realm_locked` keeps honest gate line, only `locked` hides | filter drops `status==='locked'` only | Holds |
| INV-BODY-2 | empty `units` (page-locked meridian, sealed zhou_tian) | value mutation | no fake rows, one real gate line, no invest CTA | `lockHint` rendered in detail card, `unit=null` | Holds (preview + test) |
| INV-BODY-3 | `selectedUnitId` after progress changes | stale state | selection never dangles | unit visibility is monotonic (locked→next→done only) | Holds |
| INV-BODY-4 | sealed chapter tab click | repeat/reorder | sealed page cannot open | `selectChapter` refuses `!unlocked` | Holds (test asserts refusal) |
| INV-TECH-1 | `hasTechnique=false` model | value mutation | info card alone; no artifact vista, stage track, upgrade rail, no '—' fakes | `v-if` unmounts both rails; h1 hidden | Holds (preview + test) |
| INV-REALM-1 | `realmMapAnchors` (18 pts) | bounds | 6 majors pinned to landing ovals, minors at arc-length thirds per flight | overlay render on artwork verified pre-edit | Holds |
| INV-NAV-1 | imperial scroll rail (shares composable) | cross-system chain | same lock on both rail types | one composable feeds both | Holds |

## Sequential review passes (P5)

- **Pass 1 — Local correctness**: re-read full diff. No defects found.
  Nit: `panels.body.unit.tierTitle` locale key now unused (orphaned by
  the canonical-name restore); removal would touch locale parity outside
  the minimal scope — deferred, recorded.
- **Pass 2 — Architecture/authority**: lock predicate lives in
  `betaScopeTechniqueDomain.ts` (read-model authority); nav + mount seam
  consume it without re-deriving; body filtering stays inside the
  read-model layer; `hasTechnique` maps the domain state, not raw player
  fields; no new store→store coupling. Clean.
- **Pass 3 — Adversarial integration**: mount-bounce leaves no stale
  mounted panel; watcher `immediate:true` covers boot-time stale writes;
  both rail types share the gated composable; unit visibility monotonic
  (realm/progression never regress); sealed tab click is a no-op.
  No defects found.

## Findings

No confirmed defects. No suspected defects. Coverage note: the mount-seam
bounce is verified by source inspection + unit tests of the predicate;
there is no mounted-GameRoot e2e asserting the bounce end-to-end — gap
recorded, low risk (watcher body is 4 lines beside the proven beta-scope
chokepoint).

Verdict label (evidence input only): PASS WITH EVIDENCE.
