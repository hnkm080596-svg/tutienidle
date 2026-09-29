# HANDOFF — QA fixed-point run pr51-merge-gate-2026-09-29

Status: RUNNING, blocked at C6 (exec-capable clean pair rate-limited). All other
clauses either satisfied or prepared. Last coordinator: local Devin (swe-2-max).

## Identity
- productStateId (S9, frozen candidate): b1b1c5ff0d9772d9362be9feac89e052e638f32f3eab4ff545636b52ca42b5b1
- contractId: cf9466eb0fb911d2039732d61be60befff0917077575e9bab9a67a6dc3949644
- attackModelId: 750d1a53dd23d28520c90ccde46c91a126193193b12a7c74e9dcbbe5dbc41d5c
- environmentId: b11d13feb2317104838737db5dbe15a1a241298030987eaf953a9b01b445ccbd
- Approval object: aggregate delta `git diff f196b8d0..HEAD -- game/` (PR51 merged
  aggregate on master merge-commit 89135530; reviewed tree == merged tree, verified)
- Ledger: docs/qa/runs/pr51-merge-gate-2026-09-29/ledger.json (schema v2)
- Blind briefs: briefs/clean-a.md, briefs/clean-b.md (both bound to S9 hash)

## Review rounds so far
Independent blind reviews (subagents):
1. Clean A  (ctx subagent-clean-a, state S2)  -> FAIL, 5 findings (F-MG-09..13), all repaired + mutation-killed
2. Clean A2 (ctx subagent-clean-a2, state S7) -> FAIL, 4 findings (F-MG-14..17), actionable ones repaired
3. Clean B-explore (ctx subagent-clean-b1-explore, state S9) -> sealed PASS_WITH_GAPS, 0 findings.
   Access limitation: explore profile has no exec -> recorded honestly ->
   does NOT satisfy C6 (contamination clause rejects accessLimitations).
   Its blind TERMINAL_CHECK portion satisfies C8 (only SEALED+sameState+!priorFindingsVisible required).
4. Clean A-final (exec profile, state S9) -> DISPATCHED, killed by model rate limit before result
5. Clean B-final (exec profile, state S9) -> DISPATCHED, killed by model rate limit before result

Coordinator sequential cycles (3 phases each): CYC-P5-1..3 STALE on superseded
states; CYC-P5-4 SEALED/CLEAN on S9.

Novel attacks between clean rounds: EV-NOVEL-S9 (band-oscillation probes,
starter-pin mutant, hpBelow/hpNotBelow partition check) — pinned as
src/core/skill/PassiveSystem.bandOscillation.qa.test.ts.

## Findings: 17 total
- CLOSED 13: F-MG-01,02,07,08,09,10,11,12,13,14,15,16,17 (incl. 1 High per_second
  ramp, 2 Medium coverage gaps closed by new pin tests, Medium starter-pin miss)
- REJECTED_WITH_PROOF 3: F-MG-03,04,05 — the 4 pre-existing master suite failures
  (combatContract R14.4, dynamicRegionHost, i18nKeyParity, PlayerPortrait) —
  identical on base ref; not delta-caused
- HUMAN_EXCEPTION 1: F-MG-06 — deferred audit Lows/Nits (human-deferred earlier)
- Open actionable: 0

## Mutations: 12 records, all KILLED_EXPECTED
Every HIGH-risk invariant has a killed mutant: I-STAT-ZEROBASE-FLAT (4),
I-BUILDING-ACCRUAL-PIN (3), I-OFFLINE-BUFF-SEGMENT, I-CLOUD-REV-CAS (2),
I-MERGE-INTEGRITY, plus starter-pin. Two initially SURVIVED -> pin tests added ->
re-killed (documented in equivalenceReason).

## Evidence (CURRENT on S9)
- EV-VERIFY-S9: full npm run verify — typecheck+build clean; vitest 7129 pass /
  5 expected-fail / 4 fail (only the adjudicated pre-existing files). result=FAIL.
- EV-VERIFY-S9-SCOPED: vitest --exclude those 4 files — 7114 pass / 0 fail. PASS.
- EV-RUNTIME-S9: FE-06 nameplate home+combat PASS, FE-08 HUD overlap 0,
  FE-17 ritual->qi_refining->ceiling-note PASS (Playwright vs :5608).
- EV-NOVEL-S9: novel attacks. PASS.
- Art-tracking audit (coordinator, exec): 0 runtime-referenced assets untracked;
  closes Clean-B-explore's flagged Critical-hiding spot.

## Remaining work to reach terminal predicate
1. Redispatch Clean-A-final + Clean-B-final (exec-capable blind contexts) on S9.
   briefs/clean-a.md + clean-b.md are already bound to S9. Requirements per
   protocol C6: two DIFFERENT contextIds, priorFindingsVisible=false,
   accessLimitations EMPTY (must have exec). Attach EV-NOVEL-S9 as
   noveltyEvidenceIds on the A cycle.
2. Record their reviews + cycles (CYC-CLEAN-A-FINAL / CYC-CLEAN-B-FINAL),
   set ledger.run.cleanRoundA / cleanRoundB.
3. Set ledger.run.finalEvidenceIds = [EV-VERIFY-S9-SCOPED, EV-RUNTIME-S9,
   EV-NOVEL-S9] (+ any new green evidence the pair produces).
4. Write coverage rows for each invariant x requiredEvidenceSurfaces on S9
   (DETERMINISTIC/STATIC_SEMANTIC/RUNTIME_E2E via the above evidence;
   INDEPENDENT_REVIEW via the clean pair's review ids).
5. `node scripts/qa/cli.mjs validate --run pr51-merge-gate-2026-09-29` then
   `node scripts/qa/cli.mjs decide --run pr51-merge-gate-2026-09-29`.
Expected outcome: QA_ACCEPTED_WITH_EXCEPTIONS (F-MG-06 HUMAN_EXCEPTION blocks
unqualified FIXED_POINT by design). QA_FIXED_POINT_REACHED only if the user
withdraws the exception by resolving those deferred items.

## Warnings / honesty notes
- requiredReadiness was defaulted true by init; set to false with readinessNote
  (merge-gate audit has no construction brief phase; request never opted in).
- Do NOT re-snapshot after reviewers start — S9 hash must stay stable.
  extraExclude covers the QA run dir + scratch play/probe/verify scripts + pngs.
- verify-fixes.mjs now writes re-fixes-*.png (inside excludes). Do not rename back.
- ASGN-CLEAN-A-FINAL / ASGN-CLEAN-B-FINAL are QUEUED in ledger — admit already
  recorded; mark them CANCELLED or reuse if redispatching.
- 4 suite failures are PRE-EXISTING on master (byte-identical test+source on
  f196b8d0/51b9efdb) — do not "fix" inside this run's scope.
- PR #51 is MERGED (89135530); PRs 45/49/50 CLOSED. Art stays on local disk
  untracked by user requirement — never `git add` them.
