# Balance Check — Thể Tu Reimagined (the_tu + the_tu_an)

- Date: 2026-09-16
- Run mode: inline (`balance-check` skill's `economy-designer` profile unavailable; same workflow executed by hand).
- Health: **CONCERNS** — no blockers; three watch items below.

## Data sources

- `src/data/skill/TheTuSkills.ts` (kits, ratios, `buildTheTuKit`/`buildTheTuAnKit`)
- `src/data/buff/TheTuBuffs.ts` (buff defs, markers, durations)
- `src/data/progression/TheTuNodes.ts`, `TheTuAnNodes.ts` (node effects)
- `src/core/the-tu/TheEconomy.ts` (Thế constants), `src/core/stats/TheTuStatChannels.ts` (chance channels, cap)

## Thế economy math

Cost/attempt 15 (tu_the −5; trunk −1×5; tro extra −2×5 → min 0). Success +20 (trunk +2×5 → 30; Hộ intercept +4×5 → +50 total on intercepts). Income: basic +4 (+5 max), evade +8 (+5), taken +6 (+5), round +5 (+5). Cap 100 (+10 node).

| Investment | EV per proc attempt (p=0.60 cap) |
|---|---|
| Base (15 cost / 20 gain) | −3.0 — net drain; free income is the fuel (by design, "throughput budget") |
| Economy trunk maxed (10 / 30) | +8.0 |
| Hộ branch maxed (10 / 50 on intercepts) | +14.0 per enemy single-target attack on an ally |

Break-even is p=0.75 at base — the loop only turns positive via node investment or Hộ intercepts. Free income (~9–19/round) funds ~1 proc/round baseline. Deliberate battery design; consistent.

## Outliers detected

| Item | Expected | Actual | Issue |
|---|---|---|---|
| `tran_ap` basic | ~×1.0 single-target | ×0.8 `all_lanes`, no CD | Strongest basic in the game on multi-enemy pulls; tank's only offense so acceptable, but watch vs other paths' basics |
| `bach_ung` + `minor_phan_pha_the`×5 | strong window | 70% `choang` stun chance per counter hit (two independent rolls: 40% node + 50% payloadAilments, concatenated — NOT additive 90%), counters free for 3 turns | Top degenerate candidate — see below |
| `bat_tu_ba_the` | burst survival | 3→4 holder-turns undying per 8 CD ≈ up to 50% uptime + auto-lethal trigger | Marquee ultimate; acceptable but it's the hardest invulnerability in the game |
| `son_nhac` | team shield | 30% tank maxHp external ward on ALL allies + 30% self DR + 2-turn taunt / 6 CD | 50% coverage on a three-effect ultimate; stacked with Hộ wards risks unkillable-party states vs sustained-damage checks |

## Degenerate strategies found

1. **Bách Ứng stun-lock** (highest risk): during the 3-turn free-proc window, every taken hit AND every dodge procs a counter (≤60%) carrying ≤70% choang (1 − 0.6·0.5 across two independent ailment entries) → each enemy attack ≈42% chance to stun the attacker, not 54% as previously estimated. Multi-attacker waves can self-lock. Mitigations present: enemy ailment resist on choang (ailment_scaled), CD8, sudden-death rounds. Watch: consider whether `choang` on a counter should respect per-target diminishing returns.
2. **Hộ fuel-positive intercepts**: maxed intercepts are economy-positive (+14 EV) AND grant a 25%-protector-maxHp shield per success — the branch is simultaneously the best Thế faucet and a defensive mechanic. Self-limited by enemy single-target frequency, but in single-boss fights attacking the squishy it can chain-shield indefinitely.
3. **Low-HP Cuồng Chiến floor**: `cuong_quyen` at ~1% HP ≈ ×2.98/turn every turn; `loan_dau` adds only ~+0.25 avg/turn over it. Correct risk/reward shape (Bất Tử enables the low-HP stance safely 3-4 turns), but the special slot is nearly dead weight at max missing-HP — consider if `loan_dau` needs a rider (it doesn't; acceptable).

## Progression analysis

- Chance channels: counter = 0.004·(STR+DEX), protect = 0.004·VIT+0.003·DEX, followUp = 0.004·DEX+0.003·INT; cap 0.60 → reachable at ~150 combined relevant attributes. DEX feeds all three channels — DEX-stacking is the dominant Ẩn build; INT only serves followUp (weakest income relevance). Minor asymmetry worth watching, not broken.
- Roots are free (insightCost 0, realm-gated); keystones cost 2 insight at foundation_establishment — smooth curve, no dead zone.
- Trunk economy minors (7 × 5 levels) fully fund the loop — high total insight sink but each +1 is legible.

## Recommendations

| Priority | Issue | Suggested fix | Impact |
|---|---|---|---|
| Medium | Bách Ứng + choang stun-lock | Lower `payloadAilments` chance to ~0.3 or make `counterChoangChance` node additive-smaller (+0.05/lvl → 0.55 cap) | Removes near-lockdown without touching the window fantasy |
| Medium | `tran_ap` ×0.8 all-lanes basic | Verify vs zone enemy counts; consider ×0.7 or lane-limited shape if it outperforms | Keeps basic parity across paths |
| Low | Hộ intercept economy-positive at max | If intercepts prove too frequent, raise intercept `theCost` via ho_mon marker | Keeps faucet neutral |
| Low | INT only feeds followUp | Acceptable; revisit if Ẩn INT builds feel dead | — |

Re-run `/balance-check` after any tuning change.
