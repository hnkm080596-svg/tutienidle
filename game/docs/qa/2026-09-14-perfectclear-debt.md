# Perfect-clear feasibility — retained playtest debt (ARCH program, Wave 4)

**Status:** conditions unchanged; multi-hit fixture quarantined via `it.fails`.

## Decision (user-locked)

Keep the current `perfectClearTurnLimit` conditions unchanged. The
solo/basic-attack-only synthetic fixture is retained. The failures are
acknowledged playtest debt — the skill/party system is not yet complete, so
"can a realistic build earn the clear" is deliberately unverified. No limit
rebalance, no fixture semantics change, no weakened assertions.

## What changed in `GameManager.perfectClear.feasibility.test.ts`

1. **Deterministic RNG** — `Math.random` is pinned per floor with a mulberry32
   stream (`0x9e37 + floor * 7919`). Unseeded dodge/crit/placement draws let
   floors straddle the limit nondeterministically (observed subsets 1/5/9/10,
   5/9/10, 1/9/10 across runs). This fixes reproducibility only — conditions,
   floor shapes, and stat budgets are identical.
2. **`it.fails` quarantine** — the 4 multi-hit floors now fail
   deterministically and are marked `it.fails`, keeping them visible:
   vitest flags any future change that makes one pass.

## Pinned-seed measurements (2026-09-14, post-Wave-3)

| Floor | Rounds at victory | Limit | Recorded |
|-------|-------------------|-------|----------|
| 1  | 21 | 20 | false |
| 5  | 24 | 24 | false |
| 9  | never reached (5000 steps) | 28 | false |
| 10 | 16 | 15 | false |

Best-case (one-shot) floors all still pass deterministically and keep running
as normal `it` assertions — they must stay green.

## Reopen conditions

- Skill system completion + authored party composition exists.
- A playtest with a realistic build determines intended achievability.
- Any engine change flips an `it.fails` case to passing — revisit immediately.
