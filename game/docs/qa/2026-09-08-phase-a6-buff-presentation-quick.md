# QA Review: Phase A6 — Buff Duration Presentation

- Date: 2026-09-08
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/turn/TurnBuffNames.ts` (+test) — throw-safe name resolver
  - `game/src/components/game/combat/TurnOrderStrip.vue` — badge row
  - `game/src/components/game/combat/TurnOrderStrip.test.ts` (new, 4 tests)

## Scope and Risk Map

Pure presentation: DOM badge row over TurnBuffPool (read-only), no combat
logic, no persistence, no clock. Risk map domains bounded: combat (read-only
pool access), pinia-phaser-sync (DOM-only — no Phaser), economy/time (no
surface). No deep escalation.

## Invariant Ledger

| ID | State/owner | Action | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A6-1 | Badge rendering | Battle fighting with player buffs | Synchronization: badges mirror pool instances (name, stacks, remainingTurns, polarity class) | Value mutation (2-stack debuff + buff) | badge count/text/class | Component (jsdom) | High |
| INV-A6-2 | Hidden buffs | `hidden: true` instance | Same convention as buff pipeline: hidden not rendered | Hidden instance present | badge absent | Component | Medium |
| INV-A6-3 | Registry fallback | Unknown buff id | Recoverability: display name falls back to raw id, no throw (registry.get throws) | Value mutation (unknown id) | buffDisplayName returns id | Unit | High |
| INV-A6-4 | Tooltip | Badge title attribute | Description + name surfaced (native tooltip) | Missing data → undefined-safe | title truthy | Component | Medium |
| INV-A6-5 | Null battle | No active battle | Strip hidden entirely (existing `visible` gate unchanged) | Stale state | no badges, no strip root | Component | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Full suite (worktree) | **2907/2907 pass, 446 files** | includes 6 new A6 tests |
| `npm run type-check` | 0 errors | |
| `npm run build` | BUILD OK | |
| Component tests (jsdom mount, project pattern) | 4/4 pass | badges, hidden skip, tooltip, null-battle |

## Findings

### Suspected (non-blocking)

1. `buffTooltip` re-resolves the registry name (second lookup beside
   `buffBadgeText`) — trivially cheap (map read) and keeps the two
   functions independently readable; not a defect.
2. Enemy-side buff badges not rendered (design Non-Goal — player-facing
   need first; extension is mechanical).

### Confirmed: none.

## New or Changed QA Tests

- `TurnBuffNames.test.ts` (2): registry name + unknown-id fallback.
- `TurnOrderStrip.test.ts` (4): badge rendering/polarity/stacks, hidden
  skip, tooltip, null-battle.

## Gaps and Residual Risk

- Visual pixel-level confirmation is styling-only (standard CSS classes);
  jsdom proves structure. No P14 trigger (DOM presentation, no canvas).

## Pre-existing Failures

None — full suite green before and after on this branch.
