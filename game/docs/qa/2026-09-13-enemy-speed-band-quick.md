# QA Quick — enemy attackSpeed re-authoring (speed band fix)

Date: 2026-09-13 · Branch: fix/enemy-speed-balance · Mode: quick · Verdict: **PASS WITH EVIDENCE** (one residual needs a ruling)

## Scope

Task-owned paths: `src/data/enemy/MortalEnemies.ts`, `FoundationEnemies.ts`, `HiddenBeasts.ts`, `Enemies.test.ts`. Mapper: domain `combat-and-tribulation`, `deepAuditCandidate: false`, no unmapped paths.

## What changed

All 63 enemies re-authored from legacy `attackSpeed` 3–7 (→ speed 120–250) to the documented new scale:

- **Mortal (20):** family classes — ox/crocodile 0.9, boar 0.95, bandit/dog/wolf 1.0, tiger/lynx/fox 1.1
- **Qi (22):** authored ordering compressed — legacy 3→1.0, 4→1.05, 5→1.1, 6→1.15, 7→1.2
- **Foundation (20):** flat 1.6 → 1.2
- **Huyết Mông:** 4 → 1.1

Resulting speed band: **90–120** vs player base 100 + dex×0.15 (mortal ~101, foundation ~115+buffs). Ruling: speed is high-leverage — grows a small fraction vs other stats, not ×2/×3.

## Evidence

- **Empirical sweep** (`tests/lab/progressionSweep.test.ts`, real engine, intended build): mortal F1–F10 clear at gate level; qi F1–F10 clear (max +4 overlevel); foundation F1–F7 + F10 clear. **Pre-fix:** floors 4–9 never cleared at any level in all three chapters.
- **Band pin** (`Enemies.test.ts`): all enemies speed ∈ [80, 130] — was RED pre-fix, now green.
- Suite: 82 files / 595 tests in combat+data scope green; type-check clean.

## Invariant ledger

- Speed is spawn-derived static data (normalize once at `defineEnemy`); not persisted, no save/restore surface.
- Rewards/loot untouched — only action frequency changed.
- `spawnTelegraphTicks` keys off isBoss/isElite, not speed — unchanged.
- Boss/enrage `+speed%` buffs compound on the new base (120 → ≤144) — still bounded, intended.
- No consumer requires speed ≥ threshold; `TurnQueue` only orders. Speed ≤0 infinite-loop guard untouched.

## Residual — needs user ruling (not fixed in this change)

**Foundation F8/F9 lose at max investment** — 5 trials of a 9-companion L18 party (full refine/enhance/nodes/pills): F8 kills ~11–13/17, F9 kills ~15–16/18, all defeats rounds 15–22. F10 boss clears every trial (8/9 allies survive) — **difficulty inversion: the chapter climax is easier than the floors before it.**

Mechanism: no longer a speed problem — it's raw HP/ATK magnitude (T9-10 beasts ~1900–3700 HP each, 17–18 total enemies) vs party sustain, with the new sudden-death mechanic (round 11+, +30%/round symmetric) ending the race.

Options:
1. Accept as endgame pinnacle — F8–F10 are the last content before (post-beta) Kim Đan; nothing unlocks after them. Weakens the "must clear" argument.
2. Soften `beastHP`/`beastATK` late-tier growth in `FoundationEnemies.foundationBeast` (~15–20% would close the observed gap).
3. Reduce `totalEnemyCount` on F8/F9 in `Stages.ts` (fewer, same-strength enemies — keeps the stat curve intact).

## Gaps

- P14 live-browser check deferred (worktree) — enemy attack animation cadence may look slower; cosmetic only.
- Sweep is stochastic per-roll; single-run clear levels have variance, but the wall→clear flip is consistent.
