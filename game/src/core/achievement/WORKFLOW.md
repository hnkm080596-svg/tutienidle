# S5 achievement task card and evidence

Worktree: `E:/tutienidle/.agent-worktrees/quest-v2-achievements`.
Branch: `codex/quest-v2-achievements`; baseline `c516dab9cb99403524b5806e84d675443b20b200`.
Local commit authorized; no deletion, push, integration or master edits.

## G0/G1 (before production edits)

The inherited untracked `Achievement.ts`, `AchievementSystem.test.ts` and
`data/achievement/achievements.ts` are preserved and continued, not discarded.
The user explicitly authorizes their overlap. Missing owner: `AchievementSystem`.

- Q1: 25 authored objectives; count only committed producer witnesses; lifetime claims once.
- Q2: AchievementSystem owns progress/dedupe/claims; reward settlement remains RewardSystem's job.
- Q3: One ledger per player; detached snapshot; validated replacement restore; no async work/timers.
- Q4: No live caller at this base. Headless direct APIs are supported boundaries only. Wiring is excluded.
- Q5: Reuse Reward contract; follow QuestRegistry duplicate rejection. No QuestManager mutation.
- Q6: Core uses core contracts, registry receives authored data at construction. No Vue/Phaser imports.
- Q7: Explicit period witnesses only; no local clock inference or presentation outcomes.
- Q8: Delivered quantity, distinct operation IDs, intrinsic reward band must survive projection/restore.
- Q9: get/list/snapshot are pure; reconcile/ingest/claim/restore are explicit commands.
- Q10: Dedupe by receipt and operation identity; settlement reservation blocks reentry; failure rolls back.
- Q11: New dormant owner; no competing live achievement owner found in quest/reward call chain.
- Q12: Only two authorized new directories. Tests + full verification + OCR + adversarial + sequential review.

Triggered modules: S1-S3 snapshot/restore; E1-E4 claim/identity/delivery; L1-L4 headless progress.
S4-S5 async/lifecycle N/A (synchronous APIs, no timers/listeners); U/P13/P14 N/A (no rendering or wiring edits).
R8.1 requires observational queries. S5 design rows are binding; broader IMPLEMENTATION wiring is explicitly excluded by the current user.

## Plan

1. Preserve and characterize inherited files; prove missing owner RED.
2. Implement immutable registry, evaluator, lifetime ledger and strict persistence boundary.
3. Cover authored predicates, replay/operation dedupe, failure atomicity, restore and malformed input.
4. Simplify; full verify; OCR; adversarial tests; three temporal reviews; independent falsification.
5. Report integration blockers and exact QA limits; commit only authorized paths locally.

## Initial evidence

2026-10-14: inherited test cannot import absent AchievementSystem (RED, no assertions executed).
Sandbox default Vitest cannot write shared `.vite-temp`; runner loader avoids that location,
but sandbox also rejects temporary module-cache rename. Unsandboxed `--configLoader runner`
executes worktree source and reaches the expected missing-module error. No checkout/config edits used.

## Integration blockers

No receipt producers/adapters, source authentication, feature activation baseline, save coordinator,
RewardSystem atomic settlement/idempotency port, UI or recurring board wiring is implemented here.
Typed witnesses are trusted owner inputs, not proof of authenticity or anti-cheat protection.
Claim callback must be synchronous, atomic and durable/idempotent by claimId, including after crash.
A boolean fixture settlement cannot prove real economy persistence or overflow handling.
Same-owner restore can reject rollback; a fresh owner needs trusted external latest-save selection.
Do not enable achievements until these producer/settlement/save contracts are integrated and verified.

## G4 OCR and sequential resulting-state review

P18 on latest candidate: host delegation review of all source/test entries and task/brief/request JSON;
generated QA JSON is skipped with reason (machine-generated evidence, not application code).
Unsupported declaration/Markdown entries are manually inspected. Coverage details are in qa/ocr-preview.json.
No unresolved confirmed Medium+ source finding at this checkpoint. Full suite failures remain independent evidence, not a clean P3 full gate.

Sequential Review Pass 1 (2026-10-14T09:12:44.6234909+07:00)
  Reviewed state: 7c82631d335e, post-OCR headless candidate.
  Findings: zero confirmed actionable findings. Supported-boundary validation, counter thresholds,
  global receipt and operation identity, same-companion conjunction, pending settlement, and rollback checked.
  Fixes: none; ordering defect was repaired before this cycle.
  Verification: focused 5 files / 149 tests green; final type-check exit 0. Full Vitest failed outside the dormant slice.

Sequential Review Pass 2 (2026-10-14T09:13:27.5017730+07:00)
  Reviewed state after Pass 1 fixes: YES (none; source state unchanged).
  Findings: zero confirmed actionable findings. One writer owns the ledger; projections detach;
  authored enemy/material selectors reside in data, data imports only core types; GameClock's UTC day
  conversion reused. Import/consumer census confirms zero GameManager/save/UI callers at this base.
  Fixes: none. Live wiring is an explicitly excluded integration blocker, not fabricated completion.
  Verification: reused unchanged-state focused/type-check evidence; no unjustified rerun.

Sequential Review Pass 3 (2026-10-14T09:14:31.1945210+07:00)
  Reviewed state after Pass 2 fixes: YES (none; same frozen source).
  Findings: zero confirmed actionable findings in supported headless boundaries. Cross-achievement
  reentry, truthy-but-not-true settlement, shuffled daily history, Monday boundary, baseline mismatch,
  JSON reopen and operation alias attacks examined against actual API outcomes.
  Fixes: none.
  Verification: 149 focused tests, 100x100 model campaign, 5 killed semantic mutants plus valid control,
  and 5 novel Node headless attacks on the unchanged compiled control. P13/P14 N/A for this dormant slice.
  Aggregate conclusion remains QA_UNVERIFIED: full suite fails and complete whole-repository independent
  census/clean rounds are not established. No completion claim from three passes or green focused tests.

## Incident / learning intake (scoped copy; canonical learning writes excluded by user)

- Restore ordering: Medium, supported-boundary defect. JSON order-sensitive identity rejected a
  semantically identical equal-revision save; inherited tests only re-applied identical serialized order.
  Repro failed before canonical full-ledger comparison, then passed. Pin: reorder sets AND counter keys.
  Sibling search: repository core/services JSON equality, revision, fingerprint, receiptIds. Only achievement
  restore had this lifetime identity contract; reconcile appends uniquely to a cloned existing order;
  LegacySkillAdapter compares ordered authored IR (different semantics, no proven sibling defect).
  This is incident evidence, no independent policy qualification/promotion/prevention claim.
- Mutation harness typing: introducing global Node declarations made historical ts-expect-error Node
  imports unused. Repaired with test-only typed .mjs boundary; no tsconfig/dependency edits or suppression.
  Final type-check exit 0; mutation behavior remains green. Do not propagate Node globals into app compilation.
- Invalid empty-patch fixture was a test-oracle error: merging {} into a valid snapshot stays valid.
  Corrected the invalid-case table while retaining repeated-valid-restore controls.
- Sandbox/module-cache and npm argument forwarding failures are tooling incidents, not product defects.
  build-only -- --configLoader=runner succeeded; spaced build flags were swallowed by npm-run-all.

## Balance check

All 25 base rewards match the approved table (authored data test). Under approved intrinsic factors,
finite lifetime totals are 5,907 stones / 135 cultivation / 13,800 insight. No item rewards or reusable
material feedback loop. These are design totals; settlement/scaling is NOT wired or runtime-proved.
No balance tuning was performed.

## Final G5 handoff (2026-10-14)

- Before: three inherited untracked files, missing AchievementSystem; no evaluable/claimable owner.
  After: immutable registry, pure evaluator, character-bound activation baseline and versioned detached
  lifetime ledger; committed receipt/operation dedupe, explicit reconciliation, synchronous one-time claim
  reservation/rollback, monotone replace-on-restore and complete semantic equal-revision identity.
- Changed code: Achievement.ts (contracts), AchievementRegistry.ts (catalogue validation/freeze),
  AchievementEvaluator.ts (pure objective evaluation), AchievementPersistence.ts (shape/identity/history),
  AchievementSystem.ts (single state owner), data/achievement/achievements.ts (25 rows + authored selectors).
  Tests: AchievementSystem/Boundary/Campaign/Mutation.test.ts and data/achievement/achievements.test.ts.
  AchievementMutationSupport.mjs + .d.mts isolate test-only Node APIs from app typings.
- The original three paths remain present and their work was continued; no files discarded or deleted.
- Q1-Q3/Q5-Q12 and S1-S3/E1-E4/L1-L2/L4 have headless boundary evidence. Q4/L3 live runtime path is
  intentionally unwired under user scope. Real receipt authenticity, reward currency atomicity, save I/O,
  recurring assignment/quota/release provenance, trusted latest-save selection are integration blockers.
- Simplification: authored content selectors moved to data; unnecessary evaluator condition removed;
  filesystem test boundary isolated; no generic framework or unrelated migration introduced.
- P3 evidence: npm run type-check exit 0; npm run build-only -- --configLoader=runner exit 0 on final source;
  npx vitest run src/core/achievement src/data/achievement --configLoader runner: 5 files / 149 tests pass.
  Full npx vitest run --configLoader runner: 85 files fail / 989 pass / 4 skipped; 81 tests fail /
  10,048 pass / 16 expected fail / 11 skipped. The full run predates the final test-only helper and is NOT
  a green final gate. No failure is in achievement tests; representative legacy decompose failure reproduced
  independently on unchanged source. Canvas native binding unavailable; art/decompose/release expectations
  also fail outside this slice. Other failures are indexed, not all independently triaged.
- P18: final selection 39 reviewable files; 16 reviewed, 23 explicitly skipped generated QA metadata;
  reviewed/previewed coverage_rate 41.03%, all entries accounted for. Complete source coverage 100%;
  valid generated-file skip reasons are per-file in qa/ocr-accounting.json. Declaration/Markdown inspected
  manually. Zero unresolved confirmed Medium+ findings in host delegation review. Node --eval in the
  isolated test harness takes only trusted test-owned literal scenarios and contained candidate paths;
  no user input or production caller, so the generic injection concern is rejected with source proof.
- P4 scoped operation: PASS WITH GAPS. Manual risk routing (mapper has unmapped new achievement paths):
  persistence, economy/progression, equipment identity and explicit UTC receipt conversion; no real
  storage/clock/rendering/lifecycle integration changes. 100 seeds x 100 actions, five semantic mutants
  killed with a valid control, five additional cross-claim/period/restore/settlement attacks passed.
- P5: three chronological self-review blocks above; no fixes during that cycle, no deferred Low/Nit findings.
  This does NOT supply contextual independence. Native spawn failed with agent thread limit reached;
  reservation S5-A was blocked and cancelled with dispatch failure evidence; no reviewer was created.
- P13/P14 N/A: no runtime driving path, browser or rendering code edited. No screenshot or UI proof claimed.
- Protocol runner: prepare/preflight, init/snapshot, schedule, record, validate/decide/render used. Outcome
  QA_UNVERIFIED. Clean A/B, independent terminal audit, aggregate gates/census/golden-bug obligations and
  canonical registered readiness/conformance remain unmet. The pre-write construction draft/preflight
  was used, but its initial Git-commit planning identifier was not a schema-valid manifest hash; it is
  retained honestly as a draft, not retroactively relabeled as sealed prevention evidence. Validation
  reports these missing evidence obligations. No policy promotion, efficiency or prevention claim.
- Current user scope overrides generic report/learning destinations: all task artifacts remain inside
  the two authorized directories; canonical docs/qa/protocol/learning.md was not edited. Scoped incident
  intake is above and must be reconciled by the integration QA coordinator before qualified closure.
- Source/test/report files are selected for the user-authorized local commit. Generated QA run, logs,
  construction drafts and isolated mutant copies remain local and preserved. Nothing is push/merge-ready
  by virtue of this report. No push, master edit, integration or cleanup is authorized or performed.
