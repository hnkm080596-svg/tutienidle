# QA Review: speed-pace ceiling (ho_tich_bat_phat ramp 0.1 → 0.05)

- Date: 2026-10-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/data/talent/Talents.ts`, `game/src/core/cultivation/CultivationTick.test.ts`, `game/src/stores/player.talentM2.test.ts`, `game/docs/balance/2026-10-05-speed-pace-ceiling.md`, `game/docs/qa/2026-10-05-speed-pace-ceiling-quick.md`

## Scope and Risk Map

One authored constant (`perRealmLevel` of the only `cultivation_ramp` effect) plus
matching description and test pins. changed-risk-map flagged
`deepAuditCandidate: true` ("cross-system change: 3 domains") — bounded, not
escalated, because the edit is a scalar inside a pure function
(`getCultivationRampMultiplier`) with exactly two production consumers verified
in code: `cultivateTick` (the only `cultivationPerSecond` writer) and the
F-TC9-4 validator bound (same getter — bound tightens automatically). No state
shape, timing, persistence schema, entitlement, or draw-weight change; the
domain fan-out is nominal (the file feeds talent systems, but this edit cannot
alter which code paths execute). unmappedPaths: the balance doc (markdown,
documentation only — reviewed manually).

## Invariant Ledger

| Invariant | Check | Result |
|---|---|---|
| ramp(L) = 0.5 + 0.05×(L−1) at L1/L11/L18 = 0.5/1.0/1.35 | updated pins in `CultivationTick.test.ts` (real `cultivateTick`, observable `cultivationPerSecond`) | green |
| store path agrees | `player.talentM2.test.ts` t11=100, t12=105 | green |
| description matches authored effect ("5%") | verbatim-rendered by every talent UI (TalentCard, TalentEntitlementModal, CharacterTalentSeals, fidelity stats — all bind `talent.description`) | consistent |
| validator bound auto-tightens | F-TC9-4 derives via same getters; old saves clamp into `normalizedSave` (documented harmless — next tick rewrites cps) | consistent |
| no hardcoded ramp consumer | grep `cultivation_ramp`/`perRealmLevel`/`ho_tich`: only TalentEffects + validator + tests | confirmed |
| offline accrual unaffected | EM-02 reads savedCps + TLT segments; ramp rides inside snapshot; no segment/timing change | confirmed |
| journey sim unaffected | BetaJourney uses `hap_linh` only | green |
| stacked ceiling ≥ ~0.35x | max wired inst (L18, talents+TLT+ramp) = 2.11 → 0.474x | confirmed |

## Verification Evidence

| Command / observation | Result | Evidence/limitation |
|---|---|---|
| `npm run type-check` (vue-tsc --build) | exit 0 | full project |
| `npx vitest run` (CultivationTick, talentM2, cultivationSpeed, TalentEffects, TuLinhTranBalance, betaWriterBounds T21/Tc8) | 154 passed | scoped |
| `npx vitest run src/core/simulation` | 124 passed, 1 expected-fail | BetaJourney green |
| `npx vitest run src/stores src/core/cultivation src/core/talent src/core/economy src/core/pill` + save suites | 292 + 429 passed | consumers |
| grep consumers of `getCultivationRampMultiplier` / `cultivation_ramp` / `perRealmLevel` | 2 prod call sites; no renderer of the raw value | source inspection |
| UI description rendering | all bind `talent.description` verbatim | source inspection |

## Findings

None (no Confirmed / Suspected / Coverage gap on the audited diff).

Pre-existing structural observations carried to the balance doc as flags for
Minh (not findings against this diff): stale-TLT offline-snapshot edge in
`computeOfflineProgress` (≤ +25% grant, bounded, design-level fix);
`getCultivationRampMultiplier` is last-wins across `cultivation_ramp` effects
(unchecked if a second ramp talent is ever authored); `activateTuLinhTran`
currently has no production caller.

## New or Changed QA Tests

None added by QA (write boundary honored; the diff's own pins were updated by
the implementation and reviewed above).

## Gaps and Residual Risk

- Declared realm bases (LK 70, TC 550) are not on the branch tip — absolute
  duration numbers are model-computed, ratio ceilings are data-verified.
- pnc/wired ceilings assume a live TLT effect, which no UI can produce today;
  measured anyway so the envelope holds once wired.

## Pre-existing Failures

`src/core/simulation` reports 1 expected-fail test (marked `.fails` style);
unrelated to this diff.
