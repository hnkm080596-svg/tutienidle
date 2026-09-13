# B3 — Full-Cycle Progression Evidence (Phàm Nhân → Trúc Cơ)

Date: 2026-09-14 · Evidence: `tests/lab/progressionSweep.test.ts` (real engine, real catalogs, real domain ops — no godMode/oneHitKill) · Verdict: **FAIL — progression hard-locks at chapter 1 floor 4**

## Method

For each of the 30 chapter floors, sweep realmLevel from the stage gate to 18 with the **full intended-power stack** built through real owner APIs:

- attributes: 5 creation + prior-realm minimum + (L−1), 50/50 vit/str (mortal cap 10 reached);
- gear: 6 slots, best quality of 30 real rolls/slot, **+30 enhancement/slot** (real ore + spirit-stone spend, fail-retries included);
- body refinement: every tier unlocked at L filled via `investBodyRefinement` (batched vs the 1000-stack cap);
- pills: 3× each permanent-stat family;
- talent `tat_phong` synced via `syncTalentCombatPassive`;
- qi/foundation: `phap_tu` path, Tiểu/Đại Ngũ Hành technique at **Viên Mãn** insight, realm passive synced, `hoa_cau_thuat` L10 equipped, all fire/`lap_dao`/`thuan_fire` nodes purchasable at the realm bought;
- companions: `ho_ly_tinh` + `khai_son_luc_si` + `linh_hac` exchanged/fed to the realm cap, fielded through a committed `ngu_hanh_tran` loadout (validated `setFormationLoadout`).

## Results (latest run)

| Floor band | Result |
|---|---|
| mortal F1–F3, F10 | **clear** (F1@L1, F2@L2, F3@L4, F10@L13) |
| mortal **F4–F9** | **NO-CLEAR at L18**, defeats in rounds 0–8 |
| qi F1–F3, F10 | clear (F1@L11, F2@L3, F3@L9, F10@L13) |
| qi **F4–F9** | **NO-CLEAR at L18** |
| foundation F1–F3 | clear (F1@L2, F2@L11, F3@L10) |
| foundation **F4–F10** | **NO-CLEAR at L18** |

A stress test (`tests/lab/local/b3max.test.ts`) pushed past "intended" to the absolute maximum — **9-combatant party** (all 10 companions at mortal L18, `cuu_cung_tran`), +50 enhance, full refinement — and still lost `mortal_dong_4` in round 1 and `mortal_dong_6`/`_9` in **round 0** (party wiped before completing a round).

## Root cause (structural, not a bug in one number)

1. Every normal floor spawns `9 + floor` enemies in 3 wave batches — **4–5 concurrent** from floor ~4 up.
2. Every enemy's `attackSpeed: 5` clamps to **speed 200** (`EnemyStatInput.ts` → `normalizeEnemyAttackSpeed` 0.8–2.5 → ×100). Player and companions run ~95–120 and cannot approach parity (dex +0.15/pt, affix speed ≤ ~13%).
3. Incoming action rate ≈ `concurrent_enemies × 2` per party action — **6–10 enemy turns per party turn**. Burst trace on `mortal_dong_6`: 15 consecutive enemy turns opened the battle; 9 combatants dead by t+12s.
4. Mitigation caps at 75% and defense can't close a ~6× action-rate deficit; single-target builds can't outkill waves; the only AOE (earth pure line: `tho_truc_co_tho_the` + `minor_earth_aoe`) is foundation-gated and made `foundation_floor_4` a coin-flip win at L18 — mortal and qi have **no AOE access at all**.
5. Boss floors (single enemy, floor 10) are paradoxically the easiest floors — they clear while mid floors don't. Difficulty scales superlinearly with **enemy count**, not with enemy stats.

## Gate impact

`isStageUnlocked` is strictly linear: floor N requires floor N−1; the next chapter requires the prior chapter's floor 10. **mortal_dong_4 blocks everything** — a player cannot finish chapter 1, cannot perform Quán Khí, cannot reach Luyện Khí or Trúc Cơ through any amount of investment.

**The current content is unprogressable for every player archetype tested.** This supersedes B2-1's framing: the problem is not floor-1 difficulty, it's the wave-concurrency × speed-clamp interaction making floors 4–9 unreachable.

## What this does NOT prove

- Real-time play differs from the manual clock only in cadence, not mechanics — the action-rate math holds.
- Enemy wave composition is random per roll; individual runs vary (the L18 earth-AOE F4 victory shows variance exists), but the wall reproduces across every modeled build.
- Untested levers: timed pill buffs mid-battle (hp regen ~4/s vs ~30+/s incoming — negligible), `dotResistance`/`evasion` stacking, Kiem Tu route (single-target too), manual ult usage.

## Decision needed (user)

Floors 4–9 need a design ruling — likely candidates:

1. Reduce `totalEnemyCount` growth or wave concurrency cap (the multiplier lives in `9 + floor` + 3-wave split);
2. Lower the enemy `attackSpeed` clamp (2.0→~1.2) or make speed scale with floor;
3. Buff player-side multipliers (companions already maxed in the test — insufficient);
4. Re-target difficulty: fewer, tankier enemies rather than many fast ones.

Until ruled on, **beta is blocked**: the headline loop (cultivate → breakthrough → next chapter) cannot complete.

## Reproduce

```
npx vitest run tests/lab/progressionSweep.test.ts   # prints the full table
npx vitest run tests/lab/local/b3max.test.ts        # max-build stress (local scratch)
```
