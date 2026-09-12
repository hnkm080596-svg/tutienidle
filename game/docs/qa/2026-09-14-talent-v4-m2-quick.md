# QA — Talent v4 M2 (B4-M2, quick)

Date: 2026-09-14. Scope: 5 cultivation talents + Pha Giap cross-battle
carry + save v61. Plan: `docs/superpowers/plans/2026-09-14-talent-v4-m2-cultivation.md`.
Spec: `docs/specs/2026-09-03-talent-catalog-v4-design.md`.

## Verdict: PASS WITH EVIDENCE

## Invariant ledger

| Invariant | Owner | Evidence |
|---|---|---|
| Cultivation never exceeds `required`; overflow banks only with Hai Nap | `addCultivation` | `CultivationSystem.haiNa.test.ts` (no-talent cap, bank, pour) |
| One breakthrough never skips a second tier | `pourCultivationOvercharge` cap-at-required | haiNa tests (remainder stays banked) |
| Offline grant obeys the same cap/bank/insight rules | `restoreFromSave` routes through `addCultivation` | `player.talentM2.test.ts` idempotent + insight cases |
| Loi Kiep x2 lightning applies inside the lightning owner only | `TribulationDirector.lightningTalentMultiplier` snapshot at `start()` | `TribulationDirector.loiKiep.test.ts` |
| Tribulation victory stack granted exactly once per resolution | `checkTribulationOutcomeAction` clears active post-resolve; second call sees null | code path + `TribulationOutcomeService.loiKiep.test.ts` |
| Van Dao refunds only actually-paid insight | `nodeFreePurchaseRecord` recorded at waive time; reset subtracts | `NodeSystem.vanDao.test.ts` |
| Pha Giap carry banks once per battle end, seeds once per battle start | `turnBattleEndEmitted` guard + overwrite write; seed after `resetStacks` in `startBattleWithPlayer` | `GameManager.phaGiapCarry.test.ts`, `PassiveSystem.phaGiapCarry.test.ts` |
| Carry decays on realm change | `phaGiapCarryRealmId` compare at seed | both carry test files |
| Save v61 fields required + typed | `saveShapeValidation` | v61 describe block (missing/NaN/wrong-type rejection) |

## Hypotheses checked

- **H1 — overcharge leaks across a major-realm transition**: `resolveVictory`
  resets `cultivation = 0`, writes the new realm, then
  `pourCultivationOvercharge` pours capped at the NEW level's `required`.
  Overflow follows into level 1 of the new realm by design (documented in
  `TribulationOutcomeService`), never skips a tier. RESOLVED.
- **H2 — duplicate victory resolution double-grants Loi Kiep stacks**:
  the only caller (`checkTribulationOutcomeAction`) resolves once then
  `clearActiveTribulation()`; a second invocation returns early on null
  active. RESOLVED.
- **H3 — Pha Giap bank fires on defeat/retreat too** (plan: "battle end
  regardless of outcome"): implemented in the victory/defeat terminal
  block AND `abandonBattle`; overwrite semantics make any overlap
  idempotent. RESOLVED (implemented + tested).
- **H4 — companion/enemy passives pollute the player bank**:
  `bankBattleCarryStacks` reads `skillManager` (player-scoped) via the
  talent's declared `passiveSkillId`; battle-participant buff pools are
  not consulted. RESOLVED.
- **H5 — restore double-grants offline insight on re-restore**: pinned by
  `player.talentM2.test.ts` idempotency case (same payload re-applied →
  no second grant; identity guard + measured gained-delta).
- **H6 — `nodeFreePurchaseRecord` refund exploit**: record stores waived
  amounts per node; `devResetBranch` subtracts them from the refund and
  deletes the record alongside the node (both main and orphan-cascade
  loops). Old saves lacking the field are rejected at v61 shape gate.
  RESOLVED.

## Verification

- `npm run type-check` — clean.
- `npm run build` — clean (pre-existing chunk-size warnings).
- `npx vitest run` — 536 files / 3678 tests, all pass.

## Notes (non-blocking)

- `SKILL_INSIGHT_PER_TECHNIQUE_INSIGHT` 1 -> 0.6 is the declared Van Dao
  global cost (spec row 18); `BattleLootSystem.realmReward.test.ts`
  expectations updated to the new ratio.
- The `turnBattleEndEmitted` terminal block now banks before the
  victory-only emit, so defeat also banks per plan Slice 6.
