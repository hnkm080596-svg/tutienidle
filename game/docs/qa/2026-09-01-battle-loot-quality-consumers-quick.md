# QA Review: battle-loot-quality-consumers

- Date: 2026-09-01
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/game/BattleLootSystem.ts`
  - `game/src/core/game/BattleLootSystem.realmReward.test.ts`
  - `game/src/core/game/BattleLootSystem.talentHooks.test.ts`

## Scope and Risk Map

`changed-risk-map.mjs` routed the production path to `combat-and-tribulation` and
`economy-and-progression`, with the one-hop consumers combat presentation,
loot/progression persistence, and UI notification presentation. It marked a
deep-audit candidate only because two domains are mapped.

Current-code inspection bounds this change below deep-audit scope: neither
equipment creation, bag mutation, reward summary, persistence, nor event
lifecycle changed. The two equipment routes retain their exactly-once bag and
summary calls; Task 6 changes only their quality-keyed particle colour and
transient toast accent. Pills retain their distinct grade-keyed particle API
and unchanged presentation. `ToastContainer.vue` resolves `accentColorVar` as
a CSS custom property, and `theme.css` defines `--rank-color-1` through
`--rank-color-5`. The existing Task 4 `instance.rarity` to `instance.quality`
prerequisite hunks in the same production file were retained, not reworked.

The mapper leaves the two test paths unmapped. They are manually routed as
BattleLootSystem boundary fixtures and assertions; they introduce no production
consumer. All other dirty equipment, UI, save, and QA-document paths in the
shared worktree were excluded from this review.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-loot-quality-1 | `BattleLootSystem` / equipment bag | A realm reward rolls an explicit equipment drop and emits presentation | The exact new `{ grade, quality }` instance is bagged once; `tien` selects `0xfff6d8` and rank 5 toast accent | Value mutation to highest quality | Bag argument, `reward_particle`, and queued loot notification | Focused integration | Medium: normal reward route; transient presentation only |
| INV-loot-quality-2 | `BattleLootSystem` / equipment bag | A talent-amplified boss random equipment roll succeeds | The exact new `{ grade, quality }` instance is bagged once; `huyen` selects `0x6fbf73` and rank 2 toast accent | Deterministic roll and non-default quality | Bag argument, `reward_particle`, and queued loot notification | Focused integration | Medium: independent direct drop route; transient presentation only |
| INV-loot-quality-3 | `BattleLootSystem` / pill bag | An explicit pill drop emits presentation | Pill grade selects its established particle colour and grade accent through the grade API | Value mutation to highest grade | `reward_particle` and queued loot notification | Focused integration | Low: transient presentation; validates semantic axis isolation |
| INV-loot-quality-4 | `BattleLootSystem` / battle summary | Either equipment route completes after presentation emission | Existing reward summary and bag side effects remain on their pre-existing single execution path | Repeat/ordering inspection | Exactly one bag, particle, and notification side effect per controlled drop | Focused integration + full Vitest | Medium: guards against accidental reward duplication |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| RED: `npm.cmd test -- src/core/game/BattleLootSystem.realmReward.test.ts src/core/game/BattleLootSystem.talentHooks.test.ts` | Expected failure | Both new tests failed only because their received accents were `--eq-quality-tien` / `--eq-quality-huyen`, not the asserted rank tokens. |
| GREEN: same focused command | Pass | 2 files, 26 tests passed. Both direct equipment routes assert exactly one bag, particle, and notification effect plus their literal grade/quality shape, particle hex, and rank accent; the pill route asserts its unchanged grade presentation. |
| `npm.cmd run type-check` | Pass | `vue-tsc --build` exited 0. |
| `npm.cmd run test` | Pass | 276 files and 1,684 tests passed. |
| Current-code consumer inspection | Pass | `ToastContainer.vue` consumes the token through `var(...)`; `theme.css` provides ranks 1–5. |
| `git diff --check` | Pass | No whitespace errors in the task-owned diff. |

## Findings

No confirmed defects, suspected defects, or material coverage gaps were found.

## New or Changed QA Tests

No QA-only reproduction test was needed. The Task 6 TDD regressions in
`BattleLootSystem.realmReward.test.ts` and `BattleLootSystem.talentHooks.test.ts`
are the lowest conclusive boundary checks for the two altered drop routes.

## Gaps and Residual Risk

The coordinator ran targeted UI/UX guidance with Python and confirmed the
existing semantic-token approach: colour supplements the toast's text and icon
rather than carrying the reward meaning alone. No persistence, timing, economy
amount, or lifecycle transition changed.

## Pre-existing Failures

None observed in the focused suite, type-check, or full Vitest run.
