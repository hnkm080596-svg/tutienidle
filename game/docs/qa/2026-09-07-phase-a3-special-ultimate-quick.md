# QA Review: Phase A3 — Special/Ultimate Skill Content

- Date: 2026-09-07
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/turn/TurnBattleSystem.ts` (gain hook, consume-for-damage, specialAttacks reader)
  - `game/src/core/battle/turn/TurnSkillAction.ts` ('the' in RESOURCE_FIELD, 4 consume fields) + test
  - `game/src/core/battle/turn/TurnBuffSystem.ts` (getAllById/removeAllById wrappers)
  - `game/src/core/game/SkillToTurnSkillConverter.ts` (new) + test
  - `game/src/core/game/TurnBattleAdapter.ts` (resolved override param, ULTIMATES_BY_BUILD) + test
  - `game/src/core/game/GameManager.ts` (resolvePlayerSpecialUltimate + buildTurnBattle wiring)
  - `game/src/data/skill/BatKiemThuat.ts` (TRU_TIEN_KIEM_TRAN)
  - `game/src/data/enemy/Enemies.ts` (2 new boss specialAttacks + 1 existing live)
  - `game/src/core/skill/SkillTypes.ts`, `SkillResourceLabels.ts`, `game/src/core/player/Player.ts` ('the' type + label + pool init)

## Scope and Risk Map

Risk map: 4 domains, `deepAuditCandidate: true`, `unmappedPaths` only for the
new converter file (routed manually: pure field mapper, no persistence, no
timing surface). Bounding:

- **time-and-offline**: no clock/timestamp surface; all hooks run inside the
  existing fixed-step turn resolution.
- **economy-and-progression**: `currentThe` is battle-scoped (entity field
  reset per battle entity construction; not persisted — INV-4 precedent);
  damage multipliers are combat-internal, no reward/cost path.
- **pinia-phaser-sync**: `presetId` flows through the existing action-impact
  event payload (`water_surge` already wired — the A3 reader makes it fire
  in turn-based production for the first time for boss attacks, but the VFX
  surface itself is pre-existing and was visually verified in the
  wave-vfx-capture e2e; no new render surface).
- **combat-and-tribulation**: primary domain — in-depth below.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
|---|---|---|---|---|---|---|---|
| INV-A3-1 | `hasResourceFor`/`consumeResourceFor` with 'the' | Ultimate cast attempt | Boundedness: gate reads optional currentThe correctly; consume zeroes the pool | Value mutation (40/100, uninitialized) | false→true at threshold; 100→0 after cast | Unit (TurnSkillAction.test) | High |
| INV-A3-2 | TurnBattleSystem gain hook | Landed special/ultimate hit | Exactly-once per landed action; basic hits grant 0; cap MAX_THE | Repeat (cap at 95→100 not 105); wrong slot (basic) | currentThe exact values | Unit (theResource.test, 4 tests) | High |
| INV-A3-3 | Gain ordering vs pool consumption | Ultimate cast (cost 100) + finisher gain | Ordering: gain lands on post-consume pool (0+20=20), not pre-consume | Reorder | currentThe === 20 | Unit | High |
| INV-A3-4 | `getStacks`/`removeAllById` via TurnBuffSystem | Consume resolution | Ownership: stack read/clear only through TurnBuffSystem API (P17) | Cross-system mutation | stacks summed/cleared correctly | Unit (consumeDamage.test) | High |
| INV-A3-5 | Detonate resolution | Target holds 3 stacks; skill consumes | Conservation: bonus = stacks × damagePerStack as true damage; ailment fully cleared (all sources) | Repeat (multi-stack), residue check | HP drop exact; pool empty after | Unit | High |
| INV-A3-6 | Ward-burst resolution | Source holds 20 ward | Conservation: bonus = ward × damagePerWardPoint; source ward zeroed | Value mutation | HP drop exact; ward 0 | Unit | High |
| INV-A3-7 | specialAttacks reader | Enemy basic actions | Exactly-once: 1-based counter, fires when counter % everyNth === 0; not applied to explicit skill slots | Repeat (4th/8th/...), reorder (slot guard) | counter value; damage swap; non-fire before threshold | Unit (specialAttacks.test, 2 tests) | High |
| INV-A3-8 | Converter mapping | Any Skill with damage/debuff/consume effects | Determinism: pure mapper over getEffectiveSkill output; no specialization reads | Stale state (unresolved variant) | exact field mapping incl. specialization override (Tán Diễm branch) | Unit (converter.test, 4 tests) | High |
| INV-A3-9 | buildTurnBattle wiring | Pháp Tu player battle | Wiring: player participant carries converted special/ultimate (buildId bug fix) | Stale state (empty map lookup) | adapter override precedence tests + GameManager suite | Unit/Integration | High (P13 class) |
| INV-A3-10 | Kiếm Tu ultimate | buildId 'kiem_tu' participant | Content: TRU_TIEN_KIEM_TRAN in ultimate slot; special stays bat_kiem_thuat | Content drift | slot ids + resource gate fields | Unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| Full suite (worktree) | **2897/2897 pass, 442 files** | includes 12 new A3 test files/tests |
| `npm run type-check` | 0 errors | after every task |
| `npm run build` | BUILD OK | final gate |
| SkillResourceLabels test (pre-existing, 3-key count) | FAILED during development → updated to 4 keys with 'the' label | P12 self-corrected; regression updated, not weakened |
| Playtest.continuousCombat | passing in full suite | legacy engine unaffected |

## Findings

### Suspected (non-blocking)

1. **`currentThe` accrual for Kiếm Tu ultimate depends on BAT_KIEM_THUAT
   occupying the special slot** — it does (adapter), and its landed hits
   grant +10/turn toward MAX_THE 100. Reachability: ~10 special hits per
   ultimate. No test drives the full accrual-to-cast loop end-to-end
   (unit-tested on both sides of the boundary instead). Coverage gap, low
   risk.
2. **Specialization AOE (Tán Diễm) targeting** maps through the converter
   to the turn engine's `square` shape — supported by ActionTargetingShape.
   No integration test casts the AoE variant in a real multi-enemy battle
   (unit test asserts the mapping). Coverage gap, low risk.
3. **Divergence from legacy, deliberate (per plan Global Constraints):**
   chain-gating (Thuần-path basic→special→ultimate ordering) is NOT ported
   — special/ultimate are castable purely by cooldown+resource gate. Plan
   explicitly mandates this and requires flagging to the user — flagged
   here and in the summary.

### Confirmed: none.

## New or Changed QA Tests

- `TurnSkillAction.test.ts` (+2): 'the' gate + consume-to-zero.
- `TurnBattleSystem.theResource.test.ts` (new, 4): special/ultimate gain,
  basic no-gain, MAX_THE cap, post-consume ordering.
- `TurnBattleSystem.consumeDamage.test.ts` (new, 2): Detonate + ward burst
  exact damage and full state clear.
- `TurnBattleSystem.specialAttacks.test.ts` (new, 2): everyNth fire +
  non-fire-before-threshold.
- `SkillToTurnSkillConverter.test.ts` (new, 4): field mapping, specialization
  override, consume fields, resource mapping.
- `TurnBattleAdapter.test.ts` (+3): override precedence, omission, Kiếm Tu
  ultimate slot.
- `SkillResourceLabels.test.ts`: 3→4 keys regression update.

## Gaps and Residual Risk

- Accrual-to-cast loop and AoE variant cast not integration-tested
  (Suspected 1/2) — bounded, unit-level covered both sides.
- P14: not triggered — no new render surface; boss special VFX preset is
  pre-existing (`water_surge`, visually verified in the wave-vfx-capture
  e2e previously).

## Pre-existing Failures

None — full suite green before and after on this branch.
