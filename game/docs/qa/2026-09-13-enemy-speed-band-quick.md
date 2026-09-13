# QA Quick — enemy attackSpeed re-authoring (speed band fix)

Date: 2026-09-13 · Branch: fix/enemy-speed-balance · Mode: quick · Verdict: **PASS WITH EVIDENCE**

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

- **Empirical sweep** (`tests/lab/progressionSweep.test.ts`, real engine, intended build): mortal F1–F10 clear at gate level; qi F1–F10 clear (max +10 overlevel on F7); foundation F1–F8 + F10 clear. F9 needs the full-investment build (see below). **Pre-fix:** floors 4–9 never cleared at any level in all three chapters.
- **Max-investment stress** (`tests/lab/local/f89max.test.ts`, 5 trials × 3 floors): F8/F9/F10 all 15/15 victories at realm cap with the complete intended build.
- **Band pin** (`Enemies.test.ts`): all enemies speed ∈ [80, 130] — was RED pre-fix, now green.
- Suite: 82 files / 595 tests in combat+data scope green; type-check clean.

## Invariant ledger

- Speed is spawn-derived static data (normalize once at `defineEnemy`); not persisted, no save/restore surface.
- Rewards/loot untouched — only action frequency changed.
- `spawnTelegraphTicks` keys off isBoss/isElite, not speed — unchanged.
- Boss/enrage `+speed%` buffs compound on the new base (120 → ≤144) — still bounded, intended.
- No consumer requires speed ≥ threshold; `TurnQueue` only orders. Speed ≤0 infinite-loop guard untouched.

## Residual — RESOLVED 2026-09-13 (same branch, follow-up change)

The earlier F8/F9 defeats were a **test-model artifact, not a game defect**: the "maxed" build fed companions `mortal_ore_decade` (not feedable — companions stayed L1) and used only 3 pills/family vs the designed `attributeCap: 100`. With the true intended ceiling (9 fed companions, pills to cap, tank-per-row formation, earth AOE + CC chain):

- **F8: 5/5 victory** (rounds 17–25, ~2/9 allies left)
- **F9: 5/5 victory** (rounds 22–29, ~2/9 allies left) — hardest floor in the game, correctly
- **F10: 5/5 victory** (rounds 11–16, ~8/9 allies left)

Follow-up changes that shipped with this resolution:

- `FoundationEnemies.foundationBeast` HP growth 1.2 → **1.15** — modest tail margin inside the file's own "first pass, playtest chỉnh" license. ATK stays 1.15.
- `EnemyStatInput.BOSS_ATTACK_MULTIPLIER` ×1.6 → **×2.0** — the ×1.6 was originally capped *because* legacy speed 3–7 gave the boss ~2 actions/round; with the parity band (~1 action/round) each hit needed its threat back. ×2.4 was tried first and rejected (walled the mid-power build — defeat in 8 rounds).
- `progressionSweep.test.ts` — companion feed material `mortal_ore_decade` → `tinh_hoa_pham_the` (ore is not feedable; the sweep's companions were silently L1 forever).

**Remaining documented gradient:** foundation F9 is the only floor the minimal sweep build (3 hoang companions, 5-cell formation, +12 pills) cannot clear at L18 — it requires the real party systems. Defensible for floor 9/10 of the final beta chapter; flagged here so future regression runs don't read it as a wall.

**F10 vs F8/F9 shape:** a solo boss cannot out-attrition a 17–18-enemy gauntlet — inherent to the engine. ×2.0 gives the boss real per-hit threat without making it a wall; the gauntlet remains the attrition test and the boss the decisive duel.

## Gaps

- P14 live-browser check deferred (worktree) — enemy attack animation cadence may look slower; cosmetic only.
- Sweep is stochastic per-roll; single-run clear levels have variance, but the wall→clear flip is consistent.
