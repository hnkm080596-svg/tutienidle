# Pending integration review - 2026-10-12

## Scope and authority

User request: inspect work not yet integrated; merge safe work; report rulings.
The user waived AGENTS.md workflow requirements for this task except the rule
against deleting anything without permission. The user requested GPT-6 Luna
for all delegated agents. Three read-only reviewers used that model.

Original master: `4bd90314c3edefe1ecb54a8b97737cdf8b9b1fd9`.
Reviewed and locally integrated state: `24c59a2dc7a4fcfa5d15e8e77398cb6e968efbf9`.
This is an integration assessment, not a release or repository fixed-point seal.

## Integrated locally

| PR | Head | Purpose |
|---|---|---|
| 158 | 4bc992734 | Resize 87 UI PNGs, retaining paths/formats/alpha |
| 160 | 2965bfe28 | Complete decompose tab count/sort map types |
| 161 | cfab79777 | Align wash/refine admission, fixtures and browser expectations; remove debug CSS |
| 163 | cfcb14b81 | QA fallout fixes, scoped expectation/allowlist changes, shared forge-use hint and missing UI bundle entries |
| 164 | b3dbc3524 | Wash preserves existing affix count, rejects zero-affix items before payment |

These heads are ancestors of the integrated master. The combined diff contains
136 files, including the 87 PNGs, and no deleted files. Existing stash entries,
untracked main-checkout files and all original worktrees were retained.

Review checkout:
`C:/Users/hnkm0/.codex/worktrees/pending-merge-review/tutienidle`,
branch `codex/pending-merge-review`.

## Verification of the combined state

- Type-check: PASS.
- Production build: PASS; existing large-chunk warnings remain.
- Full Vitest: 1,026 files / 10,184 tests passed; 4 files / 4 tests failed;
  4 files skipped, 12 tests skipped and 16 expected failures. Duration 429.55s.
- All four failures are existing Windows child-process launcher failures:
  `auditR21Cor.probe.test.ts`, `auditR21Int.probe.test.ts`,
  `auditR22Aut.probe.test.ts`, `fixpointR20Cor.qa.test.ts` under
  `src/services/save`. Replayed the same four files on unchanged master
  `4bd90314c` in `E:/tutienidle/.agent-worktrees/beta-readiness-audit`:
  exactly the same four failures, 21 passing tests. The launcher attempts
  `node_modules/.bin/vitest` without a Windows executable launcher, yielding
  ENOENT or a missing child marker. No test was weakened or skipped for this run.
- Real browser: `beta-journey.spec.ts` equipment-hall admission scenario passed
  on isolated port 5794. Wash/refine both mount after clicking their tabs.
- Real browser art scenarios: creation and stage-selection scenarios passed.
  Auth navigation initially timed out under concurrent full-suite load; its
  isolated rerun on port 5797 passed, and its login screenshot was inspected.
- Technique art scenario failed because the test expects `/assets/techniques/`
  while the UI uses `temporary-manual-v1.png`. The same assertion fails on
  unchanged master at port 5796. This is a pre-existing acceptance mismatch,
  not a resize regression. It remains unresolved.
- PNG audit: 87 files; 74,357,490 -> 17,469,768 bytes, saving 56,887,722 bytes.
  No enlargement or color-type change. One thin divider has the expected
  integer rounding (767x65 -> 256x22), not a crop or contract change. A
  representative contact sheet was inspected, including figure, furnace,
  wordmark, skill-node and filter art.
- `git diff --check`: clean.

Dependencies were reused read-only through a junction to the existing complete
dependency directory in the beta-readiness-audit worktree. The primary checkout
has older installed dependencies and lacks electron-updater/pg/types; it was
not reinstalled or silently altered. Verification is of the review checkout,
not a claim that the primary checkout's dependency installation is current.

## Held work and reasons

| Work | State | Reason |
|---|---|---|
| PR 165 / origin/devin/khai-mach @5373ea039 | NOT MERGED | Broad aggregate (555 files), not just the four type fixes named in its title; two real clock exploit tests are red. Its feature retirements match the clarified Vendor/essence ruling below |
| devin/beta-readiness-evidence @109c44e59 | NOT MERGED | Overlaps the same broad aggregate; audit artifacts are not production acceptance |
| devin/dot1-timeauthority @8530e5bb2 | NOT MERGED | B0/B1 only: server rebase feeds, quota/day migration and persisted epoch migration unfinished |
| devin/quest-tabs-revamp @24e4d95bf and dirty quest reward row | NOT MERGED | Contains the unapproved broad aggregate parent; dirty row/locale edits are not committed or independently accepted |
| codex/tien-hiep-ui-redesign @8b30a8fe2 and dirty preview edits | NOT MERGED | PR 151 was closed without merge; broad preview/art alternative is not accepted production UI |
| codex/beta-final-plan @4cae45896 | ALREADY INTEGRATED BY PATCH | git cherry marks it equivalent; master contains squash commit 196c0f2b6 (PR 53) |
| feat/uitemp @3a2efd345 | SUPERSEDED | Old fixed-port override; current master already has checkout-specific port selection |
| audit-combined | HELD HISTORICAL AUDIT | Large evidence-only history, not automatic production merge material |
| stash@{0} @9cba61530 | SUPERSEDED ART WIP, PRESERVED | The intended shared Phap Tu set already exists in master; stash uses 244x252 cells while master uses 732x756 (c6493404b). Applying the old snapshot would regress art and later beta guards |
| Other four stashes | PRESERVED, NOT APPLIED | Historical specs, enemy balance and governance edits; no approval to reapply their old snapshots over current decisions |
| huyen-kim-frontend dirty tree | PRESERVED, NOT MERGED | Old base with extensive uncommitted UI source changes. GameViewportFrame and viewport/accessibility specs are potentially missing work; other scene-shell changes conflict with the current UI direction and require reconciliation |
| hk-login-fidelity scratch | PRESERVED | Untracked probe scripts, not pending committed feature work |
| ui-sound-pack deliverables | HELD FOR AUDITION/INTEGRATION | Untracked listening pack; no runtime integration or listening approval implied |
| Other main-checkout and art-worktree assets/probes | PRESERVED | Source concepts, previews and scratch artifacts are not automatically runtime consumers |

The original 22 worktrees were inventoried. A denied status read of five
Codex-managed worktrees was retried with read-only elevated access; these
were not classified as clean from the denied result. Their remaining changes
are untracked art/probe/translation artifacts. Two new isolated review
worktrees were created and retained; no branch/worktree/stash cleanup occurred.

## Confirmed blockers in the broad Beta aggregate

In separate checkout
`C:/Users/hnkm0/.codex/worktrees/beta-ui-merge-review/tutienidle`,
branch `codex/beta-ui-merge-review`, at `5373ea039`:

- Type-check passes.
- `GameManager.betaReadinessClock.qa.test.ts` fails both cases: moving the wall
  clock back reopens an exhausted day quota (actual 1, expected 0); moving it
  forward a day during a one-second healthy online lease awards 1,440 insight
  (expected 0). This matches the current GitHub CI failure.
- The separate TimeAuthority tranche passes 9 focused files / 71 tests in a
  single-worker run, but has no production `rebase()` caller. It is a partial
  migration, not closure of those exploits. Its design-only header/questions
  are stale relative to the source's locked owner/rebase contract.
- Vendor deletions have no equivalent selling/quote replacement. Decompose
  converts selected materials to refined essence, not to sale proceeds. This
  is intentional feature retirement under the final clarified user ruling,
  not completion of a replacement system. Vendor building data and art remain.
- Cross-grade essence substitution is removed rather than replaced. Direct
  investment with the chapter's exact currency still has an owner.

## User rulings and remote status

- Old standalone `poke-*.mjs` may be deleted after listing/inspection. All five
  were inspected as local CDP probes; none was deleted by this task.
- Production/test deletion was permitted only after proving complete replacement.
- Final clarified product ruling: **keep Vendor building/art, remove selling;
  remove cross-grade essence substitution**. The target retains the building
  template/art as dormant data, which satisfies the clarified art/data
  preservation intent. No sale replacement is required. Its clock defects
  still prevent merging the broad aggregate as a safe completed change.
- The admin-login dev shortcut already existed at baseline. Target packaging
  does not yet prove dev tools are excluded, and its own readiness checklist
  rejects granting dev privilege merely from loginId `admin`. This is a
  pre-existing release-readiness gap, not a defect introduced by these five PRs.
- Remote push and changing PR 158's base to master were blocked by automatic
  approval review as insufficiently explicit remote-mutation authorization.
  The dedicated approval question remains separate from product rulings.

No beta-ready, QA_FIXED_POINT_REACHED, or all-tests-green claim is made.
