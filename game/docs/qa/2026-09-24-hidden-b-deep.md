# HIDDEN-B QA report — Ancient Beast trial + Quán Thể (PR #24)

Branch `devin/1790235462-beta-hidden-b`, base `beta/rc`. Contract:
`game/docs/design/2026-09-23-hidden-perfection-lineage.md` sec.9-10 +
`game/docs/specs/2026-09-23-hidden-perfection-lineage-master-spec.md` sec.8.2/8.4.

## Gate evidence

- **P3 verify**: `npm run verify` clean — type-check + build + vitest
  (fails = env noise canvas/libuuid + magick, identical to master). Touched-scope
  tests green incl. 3 new suites + GameManager integration.
- **P18 OCR** (delegation mode): 18/18 files reviewed, 0 Medium+. Nits recorded:
  settleHiddenTrialIfDue realmId-undefined fallback (defensive); CombatTopBar
  banner hardcodes hidden.mortal.beastName (only mortal trial exists); declined-
  launch advances pity counter (malformed-content only); QuanThe header comment.
- **P4 adversarial (quick)**: PASS WITH EVIDENCE — mid-trial save/reload,
  abandon/discard teardown, settlement isolation (fresh policy → no stage
  binding → no loot/kill-credit/perfect-clear), dual seam consult (manual +
  repeat), post-completion resolver decline, module registration ordering,
  undefeatable clamp ordering vs Bat Tu, UI reactivity.
- **P5 sequential**: Pass 1 fixed watcher self-disarm on intro/countdown
  (beast would stay immortal at 1hp forever — real bug, pinned x3). Pass 2
  authority map verified (resolver owns pity/encounters, watcher owns survival
  adjudication, completeHiddenBody owns +10pp). Pass 3 consumer trace — zero
  unresolved Medium+.

## Sealed-review chain (blind reviewers, no qa-doc access)

- **Clean-A** (dbe3dcff): INT FINDINGS → INT-1 Medium FIXED (resolver ran before
  stage admission — refused start consumed rolls/pity + fired trial killed live
  battle; `canStart` probe added) + INT-2 FIXED (releaseHiddenTrialEnemies at
  both watcher exits) + INT-3 deferred (auto-farm seam scope — contract is
  turn-battle cycles only). AUTH FINDINGS → AUTH-1 FIXED (overcharge pour routes
  diversion seam) + AUTH-2 FIXED (frozen hidden rows suppressed) + AUTH-3 FIXED
  (canonical-set meridian gate).
- **Clean-B** (2b2294dc→51da55cd): COR FINDINGS → COR-1 Medium FIXED
  (cycle-replacement orphaned undefeatable beast — release inside
  `clearCycleEntryState`, covers replace/abandon/discard; pin test 6/6) +
  COR-2 deferred (pity roll on refused start — malformed-only reachability,
  player-favorable) + COR-3/COR-4 FIXED (canStart docstring; non-positive gain
  exits before discovery). INT+AUTH suspended mid-run, terminated (stale head).
- **Clean-C** (51da55cd): COR SEAL + INT SEAL + AUTH FINDINGS→adjudicated
  (sec.8.4 MeridianSection matrix breach — REJECTED for action: matrix guards
  parallel collision with A's retirement, A merged first @83a6e967 so the
  invariant held; edit display-only and verified; recorded as contract note,
  spec amendment candidate).
- **Clean-D** (51da55cd→dbcc1122): COR SEAL; AUTH FINDINGS → Medium save-version
  re-bump skipped FIXED @2aa911c8 (82→83, spec sec.8.4 later-merge rule;
  exact-match rejection, 500/500 save tests) + Low `co_thu` realmId
  qi_refining→mortal FIXED @dbcc1122 (latent cross-band kill bookkeeping);
  INT sealed with delta scope; delta reviewer sealed the 2-commit delta.

## Verification evidence

- `npm run type-check`: clean.
- Scoped vitest at final head: save layer 500/500; touched suites (ancient
  trial, quan the, hidden channel, RealmBodySections, useAppLifecycle) green.
- `npm run verify` at dbcc1122: see merge commit notes.

## Deferred (recorded, safe)

- COR-2 pity roll on refused start — malformed-content/throw-only reachability,
  player-favorable direction.
- First-encounter pity unbounded tail — documented design choice (pity counts
  post-discovery rolls), BALANCE-deferred per sec.18.
- Crafted-save mechanic-vs-record coherence (mechanic-less discovered record,
  active/frozen combinations) — one deferral class; no production writer
  produces those shapes.
- auto-farm never consults the trial seam — contract scopes to turn-battle
  cycles.
- `startTribulation` doesn't tear down a live trial — headless-only
  reachability, pre-existing semantics, self-heals next cycle.
- `hidden.trial.*` i18n keys beyond the enumerated §8.4 grant — functional
  necessity, consistent with the key-ownership spirit.
- MeridianSection §8.4 matrix note — recorded; spec amendment candidate
  ("no edits until A merges").
- getStageProgress shows interrupted-stage counters during trial — cosmetic,
  self-heals at settle.
