# QA Review: Phase A4 — Reaction Path Content

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/data/buff/buffs.ts` (reaction_empowerment entry) + test
  - `game/src/core/game/GameManager.ts` (gating + pool wiring) + new test
  - `game/src/core/battle/turn/TurnBattleSystem.reactionPathE2E.test.ts` (new)
  - `game/docs/` (spec + plan, written worktree-free per P2 doc exception)

## Scope and Risk Map

Risk map: 4 domains, deepAuditCandidate (inherited from GameManager's size).
Manual bounding: no persistence surface (nodeLevels read-only), no clock
surface, no Phaser surface (marker special renders through the existing
skill bar / action-impact pipeline; reaction_empowerment is an invisible
stat buff).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A4-1 | `TURN_BUFF_REGISTRY` | Ultimate cast → appliesBuff lookup | Recoverability: `reaction_empowerment` resolves (previously a known-gap id missing from the registry — the unguarded appliesBuff lookup at TurnBattleSystem.ts:869 would have thrown) | Value mutation (cast ultimate) | `participant.buffs.hasAny('reaction_empowerment')` true | Integration (e2e test 2) | High |
| INV-A4-2 | Slot population | Player with/without `reaction_path_unlock_*` node | Synchronization: nodeLevels (§6.8 authority) decides marker vs element chain slots | Stale state (skillManager learned-state) | marker ids present only with unlock node | Integration (reactionPath.test, 2 tests) | High |
| INV-A4-3 | Pool wiring (both sites) | Marker special cast | Exactly-once interception: `reactionPathPool` populated → marker resolves to TWO distinct elemental picks (not the 0-hit markerNoPool fallback) | Missing collaborator | battle log shows the marker cast; no throw; mp cost 20 consumed | Integration (e2e test 1) | High (P13 class — pool was `undefined` since Slice 6) |
| INV-A4-4 | Empowerment fold | Buff applied | Conservation: +25% reactionEffectPercent as a statModifier with correct percent/polarity | Value mutation | pool getAllById shows the effect | Integration (e2e test 2) | Medium |
| INV-A4-5 | Non-awakened player | Battle without unlock node | No regression: element chain special/ultimate unchanged | Missing unlock | tam_muoi_chan_hoa / hoa_ha_cuu_thien ids | Integration | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Full suite (worktree) | **2901/2901 pass, 444 files** | after pool wiring |
| `npm run type-check` | 0 errors | every task |
| `npm run build` | BUILD OK | final gate |
| e2e test 1 (marker special through real GameManager loop) | cast proven by cooldown commit + battle log; mp 100→70 (ult) →50 (special) | runtime wiring evidence |
| e2e test 2 (ultimate → empowerment buff) | buff present on player pool with +25% statModifier | integration evidence |

## Findings

### Suspected (non-blocking)

1. **The `phap_tu_reaction_ultimate`'s appliesBuff lookup is unguarded in
   TurnBattleSystem (A2's known note)** — this phase CLOSES the risk by
   adding the id to the registry (INV-A4-1); the unguarded lookup itself
   remains a latent hazard for future content and stays tracked in
   roadmap 10.4.
2. **Reaction Path slot REPLACEMENT semantics** (marker replaces the
   element chain's special/ultimate for awakened players) — deliberate
   per design; flagged for review.

### Confirmed: none.

## New or Changed QA Tests

- `GameManager.reactionPath.test.ts` (new, 2): gating matrix
  (awakened → marker slots; non-awakened → chain slots).
- `TurnBattleSystem.reactionPathE2E.test.ts` (new, 2): real-loop special
  cast proof + empowerment buff fold.
- `buffs.test.ts`: registry count 51 → 52.

## Gaps and Residual Risk

- Reaction damage VARIETY (which elemental pair triggers which of the 10
  reactions) is data-driven from ELEMENT_REACTIONS and already covered by
  the A1 ported suite — not re-tested here.
- Visual confirmation of the reaction skills in the skill bar is generic
  rendering (existing surface) — no dedicated P14.

## Pre-existing Failures

None — full suite green before and after on this branch.
