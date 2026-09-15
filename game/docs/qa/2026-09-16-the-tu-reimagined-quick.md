# Adversarial QA — Thể Tu Reimagined (the_tu + the_tu_an)

- Date: 2026-09-16
- Mode: quick (P4)
- Scope: `the_tu` / `the_tu_an` cultivation paths — stat channels, kits, reactive mechanics (Hộ/Phản/Trợ), Thế economy, externalWard, durationPolicy, node baking, UI wiring.
- Diff base: aggregate worktree diff (~156 files, +2475/−513).

## Invariant ledger (checked)

| # | Invariant | Result |
|---|-----------|--------|
| 1 | `declared.affected` is the single consumed target list; intercept rewrite cannot diverge from presentation/events (`TurnDeclaredAction` has no parallel `targets` field). | PASS |
| 2 | externalWard reconciles only via a marker whose `sourceId` matches `ward.sourceId`; recast = replace; pool not spendable via `spendWard`. | **FAIL → fixed** (see D1) |
| 3 | `fixed_holder_turns` buffs ignore holder resist/duration stats; `khiem_khich` stays `ailment_scaled`. | PASS — `BuffSystem.durationPolicy.test.ts` |
| 4 | Reactive bypass skips natural-turn lifecycle (ticks, CD, regen, charge) but still produces a `TurnDeclaredAction` through `applyActionImpact`. | PASS — `reactiveBypass.test.ts` (9) |
| 5 | Thế income credited before the reactive window for that outcome; cap = `entity.maxThe ?? MAX_THE`; single-channel basic income (marker field only). | PASS — `theEconomy.test.ts`, e2e |
| 6 | Intercept: enemy actor + exactly-one affected + living player target; nearest-by-Chebyshev single roll, no fallback. | PASS — `hoIntercept.test.ts` (8) |
| 7 | `onImpactLanded` fires only on `hpDamage > 0` (absorbed/evaded hits don't count as taken); `onEvade` on dodge only. | PASS — riders + bypass suites |
| 8 | Participant-local clones: registry defs never mutated; node bonuses baked at `buildTheTuKit`/`buildTheTuAnKit`. | PASS — structural + e2e |
| 9 | Chance stats (`protectChance`/`counterChance`/`followUpChance`) are domain-gated; never authored in `statModifiers`; consumption cap 0.60 at `clampStatValue`. | PASS — arch whitelist + StatDomain tests |
| 10 | Taunt: victim-pool read, `uniquePerTarget` newest-wins, scripted specials exempt. | PASS — `taunt.test.ts` (9) |
| 11 | Root mutex `cuong_chien`/`tran_the` via `excludesNode`; Ẩn roots non-mutex. | PASS — node coverage arch test + kit tests |
| 12 | `huy_quyen` Lv3 gate is reachable: the mortal combat basic follows the slot-0 loadout occupant within the cast-leveled family. | **FAIL → fixed** (see D2) |

## Confirmed defects

### D1 — Intercept external-ward sourceId mismatch (CONFIRMED → REPAIRED)

- **Where:** `TurnBattleSystem.resolveInterceptWindow` ward rider.
- **Defect:** the `ho_ve` marker was applied with `source = original.entity` (rescued ally) while `externalWard.sourceId = nearest.entity.id` (protector). `reconcileExternalWard` requires `buff.sourceId === ward.sourceId`, so the pool was cleared at the next `refreshParticipantStats`.
- **Evidence (failing repro):** `TurnBattleSystem.theTuAnRiders.test.ts` → "the intercept-granted ward survives reconcile" — expected `{sourceId:'protector', amount:7500}`, got `undefined` after one stat refresh.
- **Repair (post-QA, dev workflow):** apply the marker with `source = nearest.entity`, `target = original.entity` so marker sourceId matches the ward's. Repro flipped green; file 5/5 pass.
- **Regression cover:** the repro test is retained as the permanent guard.

### D2 — `huy_quyen` could never be cast; `the_tu_an` unreachable in real gameplay (CONFIRMED by code-review subagent → REPAIRED)

- **Where:** `GameManager.authoredBasicSkillId` returned `'tram'` unconditionally for mortals — the loadout was never consulted, so equipping `huy_quyen` at slot 0 (possible via `RadialSkillSelector`/`setSkillLoadoutSlot`) was dead UI. `recordPrimaryPlayerCast` only ever saw `'tram'` → `skillCastCounts['huy_quyen']` stayed 0 → the `huy_quyen` Lv3 offer gate could never open. Classic P13 wiring hole: green suite, zero runtime progression.
- **Evidence (failing repro):** `GameManager.theTuAnE2E.test.ts` → "huy_quyen equipped at slot 0 becomes the battle basic and accrues huy_quyen casts" — `basic.id` was `'tram'`.
- **Repair (dev workflow):** for mortals, `authoredBasicSkillId` resolves the slot-0 equipped skill when its id is in `CAST_LEVELING_THRESHOLDS` (the mortal-basic family authority); any other occupant falls back to `'tram'`.
- **Regression cover:** three tests — huy_quyen accrues real casts through a live battle; tram-at-slot-0 parity (kiem route); non-basic occupant (`bat_kiem_thuat`) falls back to tram.

## Design observations (not defects)

- Intercept window opens for **any** single-target enemy action on a player, including non-damaging ones — the protector body-blocks the debuff onto themselves. Consistent with the "đón thay đòn" fantasy; flag only if spec intends damage-only.
- `son_nhac`/`ho_ve` wards recast-replace (newest-wins pool overwrite, not additive) — locked contract.
- `selectAction` may auto-fire `bat_tu_ba_the` at full HP (spec T11, accepted upstream).

## Coverage gaps / deferred

- **P14 browser check deferred** — isolated-worktree exception: Vue-panel/HUD changes (`PlayerHudLayer` external-ward layer, `kiemBarBridge`, `QuanKhiPanel`, `SkillPathPanel`) verified by unit tests + type-check only; live-browser check owed at branch finishing from an authorized checkout.
- Persistence: participant-local clones are rebuilt at battle build; no new saved state beyond `CURRENT_SAVE_VERSION` bump — no save/restore test added for clones (covered by existing adapter parity).

## Verdict

**PASS WITH EVIDENCE** — two confirmed defects found and repaired inside the run (D1 QA sweep, D2 code-review escalation); all ledger invariants hold under test evidence. Residual risk concentrated in deferred P14 browser verification.
