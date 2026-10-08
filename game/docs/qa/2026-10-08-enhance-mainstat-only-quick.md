# QA Review: enhance-mainstat-only

- Date: 2026-10-08
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `game/src/core/equipment/EquipmentSystem.ts`, `game/src/core/equipment/EnhanceSlotLevel.test.ts`, `game/docs/qa/2026-10-08-enhance-mainstat-only-quick.md`

## Scope and Risk Map

Owner ruling: Cuong Hoa (enhance) scales ONLY `mainStat`; affix growth belongs to Tinh Luyen (refine writes `instance.affixes[i].value` directly). Change: `applyModifiers` affix loop passes `scale = 1` so affix contributes `getEffectiveAffixValue(rolled, affix)` unscaled; mainStat path unchanged. Plus one pin test.

changed-risk-map: domain `inventory-equipment`; one-hop consumers = "economy costs and persisted ownership", "player stats and combat loadout"; `deepAuditCandidate: false`; `unmappedPaths: []`.

Consumer check (`getModifiers`/`getEquipmentModifiers` callers): `useEquipmentActions`, `EquipmentOpsSystem.getEquipmentModifiers`, `GameManagerSaveRestore` (x2), `EarlyGameSession`, `TribulationOutcomeService` (x2) — all re-sync the modifier list wholesale; none assume enhance-scaled affixes. No save migration needed: modifiers are in-memory, rebuilt via `refreshModifiers` on restore.

Escalation decision: no mandatory deep trigger — no save/cloud change, no clock/offline change, no Vue/Pinia/Phaser lifecycle risk; economy impact is the owner's intended power ruling, flagged for adjudication (see Pre-existing/Intended deltas).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-EQ-1 | `applyModifiers`, EquipmentSystem | equip at enhanceLevel 5 | Affix modifier equals rolled value; mainStat scaled | Value mutation | `getModifiers()` flat values | unit (`EnhanceSlotLevel.test.ts` new pin) | High — the ruling itself |
| INV-EQ-2 | affix loop | equip/enhance/wash/refine/refreshModifiers | Same modifier path; no stale scale on affixes at any re-apply site | Reorder/repeat | all 5 call sites re-run `applyModifiers` | code inspection | Medium |
| INV-EQ-3 | `modifierSystem` | same stat on mainStat + affix | No lost contribution | value collision `${instanceId}:${stat}` | `add()` pushes, both counted; unequip removes by `sourceId` | code inspection (`ModifierSystem`) | Low (pre-existing, unchanged) |
| INV-EQ-4 | save/restore | reload with affix gear at +N | Modifiers rebuilt unscaled after restore | Interruption | restore → `refreshModifiers` → same path | covered by change locality | Medium |
| INV-EQ-5 | out-of-range/forged rolled value | malformed affix value | `getEffectiveAffixValue` normalization still applies | Value mutation | unchanged code path | existing coverage | Low |
| INV-EQ-6 | combat consumers | boss matrix sims at +5/+8 | Intended power delta only, no unrelated breakage | Cross-system chain | scoped vitest run | integration (existing) | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `tsc --noEmit -p tsconfig.json` (game/) | clean | full project |
| `vitest run src/core/equipment src/core/item/ItemRoll.test.ts src/composables/useEquipmentTooltip.test.ts src/components/panels/equipment-hall/EnhanceTab.test.ts src/core/simulation/earlygame tests/lab/economyPaceAudit.test.ts tests/lab/progressionSweep.test.ts` | 468 pass / 7 fail | all 7 = `ElementBossMatrix` victory→defeat cells (intended delta, see below) |
| Pin test red check (stash prod file, run new test) | fails at affix `expected 7.8 to be 6` | proves pin sensitivity, not vacuous |
| Same test post-fix | passes | 13/13 in `EnhanceSlotLevel.test.ts` |
| `ElementBossMatrix` on base branch (stash prod file) | 15/15 pass | confirms 7 breaks are caused by this change |
| grep `calculateEquipmentScale`/`applyScaledModifier` prod usage | only `applyModifiers` | audit fact confirmed |

## Findings

None Confirmed against the task scope.

### QA-2026-10-08-001: `EXPECTED_OUTCOME` pins now stale after ruling
- Severity: Low (process finding, not a defect of this change)
- Status: Confirmed behavior change, intended by owner ruling
- Invariant: Determinism — matrix sims at fixed seed
- Reproduction: `vitest run src/core/simulation/earlygame/ElementBossMatrix.test.ts`
- Expected (pinned): victory in 7 cells — `fire/croc`, `water/croc`, `wood/serpent`, `wood/whelp`, `metal/croc`, `earth/croc`, `earth/whelp`
- Actual: defeat — affixes no longer take enhance scale (+5 → each affix ~23% weaker contribution; +8 → ~32%)
- Evidence: failure output `expected 'defeat' to be 'victory'`; base branch same seed passes 15/15
- Test file: existing `ElementBossMatrix.test.ts` — left untouched per owner instruction (report, do not weaken)
- Owner subsystem: simulation pins / equipment balance
- Blast radius: assert-only; requires owner decision to re-pin `EXPECTED_OUTCOME` or adjust gear fixture

## New or Changed QA Tests

`game/src/core/equipment/EnhanceSlotLevel.test.ts` — new describe `Cuong Hoa chỉ scale mainStat`: equips a weapon (mainStat might 12, one maxHp prefix rolled 6) at slot enhanceLevel 5 via real `equip()`; asserts might modifier = 15.6 (scaled 1.3) AND maxHp modifier = 6 (unscaled). Red-checked against pre-change code.

## Gaps and Residual Risk

- EnhanceTab/UI enhance preview may still project scaled affix values until the sibling UI slice lands — combat/tooltip now agree; preview parity is a separate agent's scope (`src/components/**` untouched here).
- No independent blind reviewer this run — in-session review only (child session; session-slot constraints). Independence evidence missing.
- `ElementBossMatrix` red cells pending owner adjudication (above).

## Pre-existing Failures

None observed inside the run scope beyond the intended-delta breaks above (base verified green).
