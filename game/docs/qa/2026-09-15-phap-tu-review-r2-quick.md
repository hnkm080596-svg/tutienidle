# QA — Pháp Tu review round 2 fixes (quick)

- Scope: HEAD `e72a33ad` + round-2 repair diff (route-switch lifecycle, Cộng Minh
  once-per-instance, phap basic fail-fast, save atomicity).
- Task-owned paths: `GameManagerProgressionOps.ts`, `GameManagerTurnBattleOps.ts`,
  `GameManager.ts`, `TurnReactionManager.ts`, `BuffSystem.ts`, `BuffTypes.ts`,
  `TurnBasicAttacks.ts`, `saveShapeValidation.ts` (+ paired test files).
- Risk-map: 5 domains, `deepAuditCandidate: true`. **Bounded, no escalation** —
  the save-boundary change only *rejects* states that were never legally
  writable (`selectPhapTuElement` has committed `{element, route}` atomically
  since the feature landed; `phapTu` did not exist before it). `time-and-offline`
  is transitively mapped via GameManager; the diff touches no accrual path.
  `GameManagerProgressionOps`/`GameManagerTurnBattleOps` were unmapped — routed
  manually to combat-and-tribulation (battle-lifecycle gate) +
  economy-and-progression (route switch), both covered by tests below.

## Findings checked

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| R2-1 | `switchRoute` locked forever after first battle (retained terminal `TurnBattle`) | **Confirmed pre-fix → fixed** | New test drives a real battle to `victory` via `ManualClockSource`, then `switchRoute` returns `true` (RED→GREEN). `isTurnBattleInProgress()` on the battle owner gates on `isBattleInProgress(state)` — the same authority the UI uses. |
| R2-2 | Other ops gated on battle *existence* | **Not a defect** | `realmAdvanceOps` (setArtifactPath/tryUpgradeArtifactGrade) already checks `intro/countdown/fighting`. `effectOps.resolvePersistentBuffEntity` uses existence to read the live entity — correct semantic. `useCombatSceneActive` keeps terminal-visible semantics intentionally (result screen). |
| R2-3 | Cộng Minh compounds on re-application of the same child instance | **Confirmed pre-fix → fixed** | Repro: bong+trung_doc, trigger, re-apply trung_doc, trigger again → dot `3.375` vs expected `2.25` (RED). `potencyAmplified` instance flag consumed once by `scaleBuffPotency`; repeat pairs skip potency+duration AND emit no phantom `cong_minh` event. |
| R2-4 | Once-per-instance is a per-instance bound, not global | **Verified** | A fresh instance (post-remove) consumes its own one-time amp — test GREEN. Cross-source pairs: flag lives on the instance, so actor B's sinh parent cannot re-amp actor A's already-amplified child — intended. |
| R2-5 | `stack`-mode re-application still compounds via stacks | **Bounded** | `stacks` growth is the authored stacking mechanic (separate, `maxStacks`-bounded). Flag only bounds the Cong Minh multiplier — stack×potency no longer multiplies amp-on-amp. |
| R2-6 | `PHAP_TU_BASICS` fallback silently substitutes wrong gameplay | **Fixed** | phap_tu/phap_tu_an now rethrow converter rejections; `phap_tu_*` entries removed from `BASIC_ATTACKS_BY_BUILD`/`REQUIRED_BUILD_IDS`; `PHAP_TU_BASICS.wood` phantom damage removed and the table marked fixture-only. Corrupted-template tests prove `startBattleWithPlayer` throws. |
| R2-7 | Fixture regression: unlearned basic previously masked by fallback | **Found + fixed** | `GameManager.turnStatusVfx.test.ts` set `{element:'wood', route:null}` and never learned `doc_chuong` — the deleted static map silently supplied it. Fixture now learns the skill + uses the valid atomic pair. Suite sweep: this was the only file relying on the phantom fallback. |
| R2-8 | Save validator accepts half-set `{element, route}` pairs | **Fixed** | `(element===null) === (route===null)` enforced; committed state on non-`phap_tu` paths rejected. 5 new validator tests cover both directions + path ownership. |

## Residuals / notes (non-blocking)

- `GameManager.authoredParity.test.ts` fixtures still use `{element, route:null}` —
  an invalid pair under the new invariant, but engine-internal scaffolding that
  exercises "conversion with no route profile" (learned skills → canonical path;
  route:null → `routeProfileProvider` returns undefined). Save payloads hitting
  this shape are now rejected at the boundary. Fixture-fidelity smell only.
- `phap_tu` player with element committed but basic never learned degrades to
  `GENERIC_PHYSICAL_BASIC` (honest "no skill" melee — not a wrong-content
  substitute). Unreachable via real writes (`selectPhapTuElement` grants the
  basic atomically); only a corrupt save hits it — and that save is now
  shape-rejected anyway.
- `potencyAmplified` is consumed even when the child has no numeric carriers
  (empty-effects ailment): the event + duration amp still apply once — same
  observable behavior as before for that case, now bounded.

## Verification evidence

- `npm run type-check` — clean.
- `npm run build` — clean (chunk-size warnings only).
- `npx vitest run` — 558 files / **4209 pass**, 4 expected-fail, 2 failures:
  `turnStatusVfx` (task-caused fixture reliance on the deleted fallback —
  fixed, re-verified green) and `eslintCoreSeverity` (known parallel-load
  flake, passes isolated in 2.2s).
- Scoped: 12 files / 307 tests green; save suite 141 tests green.

## Verdict

**PASS WITH GAPS** — all four round-2 findings repaired with failing-test-first
evidence; residuals documented above are fixture-hygiene notes, not defects.
