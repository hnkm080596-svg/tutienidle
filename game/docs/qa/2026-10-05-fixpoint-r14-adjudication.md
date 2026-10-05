# Fixpoint r14 adjudication — codex aggregate @83525b8e

Auditor wave r14 ran blind against `33888b12` (r13 batch). Reports delivered in
auditor sessions (COR `55afe394`, AUT `da52fbc5`, INT `c37c403e`); the auditors'
`game/docs/qa/2026-10-05-fixpoint-r14-*.md` files lived uncommitted in their own
worktrees/VMs — the verdicts and finding bodies are captured in those sessions'
final messages and adjudicated below. The r14 INT adjudication commit
`83525b8e` landed between audit and this batch and already closed INT-1/INT-6
and COR-2 (dedup verified below).

## Medium+ findings

| ID | Finding | Disposition |
|----|---------|-------------|
| COR-1 (Medium) | Window START anchored at `authorityNowMs` while `lastSavedAt` is client-stamped and `untilMs` server-stamped — honest fast clock loses the skew every cold-boot; skew ≥ gap collapses the window to `[until, until]` so cultivation/production/decompose pay 0 while auto-farm pays full elapsed | **FIXED** — the start anchor is now `authorityNowMs − elapsed` in both `player.ts` (`windowStartMs`) and `GameManagerSaveRestore.ts` (`offlineSinceMs`). The window is the authorized DURATION positioned at the payload marker; the END still clamps at `authorityNowMs`, so nothing past the approved end ever pays. A crafted-future `lastSavedAt` gains nothing beyond the server-authorized span (the r12-AUT-3 pin updated to assert exactly that). |
| AUT-2 (High) | Non-stackable `expiresAtMs` bound anchored at boot-now (`authorityNowMs + 24h`) — a forged `expires = +1y` on a stale save revived a dead TLT buff for a free day | **FIXED** — `boundTimedEffectClocks` now bounds non-stackable expires at `provenanceMs + TU_LINH_TRAN_DURATION_MS` with `provenanceMs = min(lastSavedAt, authorityNowMs)`. Honest invariant: every extension is `appTime + duration` with `appTime <= lastSavedAt`, so `expires > lastSavedAt + duration` is impossible provenance. Applies to both the payout copy and the restore map. |
| AUT-3 (Medium) | `hasLiveTlt` read raw `expires > lastSavedAt` — a forged TLT record loosened the `cultivationPerSecond` cap +25% during normalize | **FIXED** at the gate: the TLT branch now rejects `expiresAtMs > lastSavedAt + TU_LINH_TRAN_DURATION_MS` (honest-tight: rebuy max-extends `expires = lastApp + duration <= lastSavedAt + duration`). A forged deadline that would feed `hasLiveTlt` now rejects the save outright instead of passing and being rewritten at restore — this also resolves INT-2's round-trip break for the crafted class. Residual noted below: a forged record with `expires` inside `(lastSavedAt, lastSavedAt + 24h]` remains indistinguishable from a just-bought TLT — inherent to any claim-based field. |

## Low findings

| ID | Finding | Disposition |
|----|---------|-------------|
| COR-2 / INT-1 | auto-farm settle anchored at `Date.now()` | **DEDUP/FIXED @83525b8e** — `settleAutoFarmOffline` takes `settleNowMs`; verified: no `Date.now()` anchor remains on the settle path. |
| INT-6 | `QuestManager.restore` daily-reset anchor + `reconcileBuildings` machine-clock anchor | **DEDUP/FIXED @83525b8e** — both take `restoreAuthorityNowMs`; shared helper in `saveTypes.ts`. |
| COR-3 / INT-3 / AUT-1 | Stackable `expiresAtMs` exemption — a forged record with far-future expiry on an authored stackable regen pill passes validator and survives restore (free bounded-magnitude buff). AUT rated High; COR/INT rated Low | **ACCEPTED RESIDUAL** — verified no honest bound exists: a stackable chain's expiry is `max(now, prevExpires) + perDrinkDuration` per drink, so honest `expiresAtMs` is unbounded over the save lifetime; AUT's "blocked at the shape gate before r13" claim does not hold (the pill branch never carried an expires bound — verified `389ad4b2`). Magnitude IS bounded (one `manaRegenPerTurn` modifier, `flat <= mpPerSecond x 1.5`, group/flag pinned to authored). A cap is a design ruling — logged in `decisions-needed.md`. |
| COR-4 | TLT validator accepts `cultivationSpeedPercent ∈ (0, 0.25]` though only `0.25` is authored | **ACCEPTED** — a claim below the authored magnitude is strictly self-weakening (deny direction); no mint vector exists. Tightening to `== 0.25` buys nothing and adds a rejection surface for edge saves. |
| INT-2 | TLT `expires > 24h` passed validator then restore rewrote → round-trip break for the crafted class | **FIXED** via the new gate bound above — the crafted class now rejects loudly at validation instead of silently rewriting at restore. Accepted saves are never rewritten by `boundTimedEffectClocks` (the bound is honest-tight), so restore→save identity holds. |

## Nit findings

| ID | Finding | Disposition |
|----|---------|-------------|
| INT-4 | `ProductionSystem.ts:631` implicit `-1` guard via `realmIds[-1] -> undefined` | **FIXED** — explicit `if (tierIndex < 0) return []` matching the `ageIndex` sites; the `!tierRealmId` guard stays as second layer. |
| INT-5 | `rollBreakthroughTalentOffers` missing the `total <= 0` fail-closed its siblings got | **FIXED** — throws like the non-finite case (unreachable today: `isLegalBreakthroughOffer` requires `weight > 0`, so a non-positive total means corrupted data). |
| COR/INT misc nits | (naming, comments) | Recorded, no action. |

## Accepted residuals (recorded, not blocking)

- **Stackable expires** — no honest bound exists for additive chains (above);
  whether to cap `expires - lastSavedAt` at a design maximum is a product
  ruling → `decisions-needed.md`.
- **Forged-but-shapely TLT claim** with `expires ∈ (lastSavedAt, lastSavedAt+24h]`
  is indistinguishable from a just-bought TLT; the claimed percent stays ≤
  authored so the only loosened channel is the cps cap relaxation itself
  (bounded at +25% of the legit ceiling). Claim-based fields cannot be
  authenticated locally — server authority is out of beta scope (r11 ruling).

## Pins added/updated

- `player.restoreFromSave.test.ts` — crafted-future `lastSavedAt` pays ONLY the
  authorized window (updated r12-AUT-3 pin to the new anchor semantics);
  honest fast clock pays full window; in-window skew pays full span; forged
  far-future `expires` on a stale save clamps to dead provenance (r14-AUT-2).
- `SaveSystem.timeAuthority.test.ts` — cold-boot + honest fast clock:
  `productionSystem.settleOffline` gets `settleNowMs = untilMs`,
  `offlineSinceMs = sinceMs`; decompose gets the same full window.
- `betaWriterBoundsTc8.qa.test.ts` — stale r13 span pin replaced: deadline past
  `lastSavedAt + duration` rejected; honest rebuy span (>24h, inside
  `lastSavedAt + duration`) still validates; exact 24h span validates.

## Verification

- `npm run type-check` — clean.
- Scoped vitest (`src/core`, `src/stores`, `src/services`, `tests/architecture`):
  687 files / 6984 tests green, 12 expected-fail, 8 skipped.
- Pre-existing r13 debt found and fixed here: the F-TC8-8 span pin had been
  failing since the span check was retired (not caught by wave r13's verify —
  test expectations were not updated to the new rebuy semantics).
