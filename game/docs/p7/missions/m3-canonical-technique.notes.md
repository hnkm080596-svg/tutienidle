# P7-M3 — Mission notes (architecture-worker-workflow G0–G5 evidence)

## G0 — Task card

- **Authorized outcome:** replace the learned-list/insight Technique system with the canonical single-holder model — way-owned grant at initiation after the mortal→qi_refining promotion, `grade`/`rank`/`mastery`/`quality` progression, `techniqueMastery` battle channel with victory-only settle (per-cycle for auto-farm), the Nâng Cảnh material transaction, 6 semantic-English defs (spell Trúc Cơ variant folded into `five_elements_art.gradeEffects[2]`), retirement of `tu_linh_quyet`, learn-by-drop, list/equip semantics and `TechniqueTier`, save v70 hard preflight. Spec `m3-canonical-technique.spec.md` v8 (SPEC_PASS) + plan `m3-canonical-technique.plan.md` (PLAN_PASS).
- **Owner:** `PathWayDefinition.techniqueId` (identity authority) + `TechniqueSystem` (single progression writer) + `TechniqueManager` (0-or-1 store) + `BattleLootSystem.pendingTechniqueMastery` (pending buffer) + `GameManagerSaveRestore` preflight (holder contract).
- **Stop condition:** plan gates complete; `npm run verify` green; P13/P14 live evidence; P5 ≥3 passes clean; external review PASS.

## G1 — Q1–Q12 evidence

| Q | Answer (evidence) |
|---|---|
| Q1 observable behavior | Way initiation grants the canonical technique AFTER promotion (live: `qi_refining:1` + `sword_control_art`); kills accumulate pending mastery paid only at victory (live: `+68` → persisted `mastery:68`); auto-farm pays per cycle; quest rewards pay `skillInsight` directly; Tâm Pháp panel renders the holder + Nâng Cảnh affordance. |
| Q2 authority | `way.techniqueId` = sole identity; `TechniqueSystem` = sole writer; `TechniqueProgression` = leaf helpers (cycle-safe); save preflight = contract authority resolving the way via `getActiveWayDefinition`. |
| Q3 state/persistence | Holder 0-or-1 in `techniques[]` save slice; v70 snapshot = `grade`/`rank`/`mastery`/`quality` (+re-derived authored fields on restore); preflight rejects wrong count/id, unknown template, out-of-range or inconsistent progression state, way-less non-empty; v69 rejected (dev phase). |
| Q4 consumers | `chooseCultivationPath` grant, `BattleLootSystem` pending/settle, `GameManagerAutoFarmOps` per-cycle settle, `GameManagerBattleRewardOps` victory terminal, `PersistentEffectOps` (combatModifiers + band effects), `buildPlayerRewardReceiver` skill-insight channel, `ArtifactProgression` (0.25×mastery EXP), `TechniquePanel`/`TechniqueSlotCard`/`TechniqueCodex` (getActive). |
| Q5 timing | Grant after `realmId='qi_refining'` write inside the ritual transaction; pending flush inside the once-per-cycle `battleEndEmitted` victory block; grade advance outside combat only. |
| Q6 errors | Fail-closed everywhere: ritual rejects non-empty holder/missing template/grade-over-ceiling before commit; `grant()` re-checks defensively; `tryAdvanceTechniqueGrade` rejects no-holder/cap-not-met/ceiling/combat/insufficient-material before spend; preflight throws before owner mutation and before identity-hash skip. |
| Q7 naming | `techniqueMastery` (EnemyReward + stage currency + summary), `skillInsight` (Reward channel — honest naming), `getTechniqueGradeCeiling`/`canAdvanceTechniqueGrade`/`getTechniqueGradeUpgradeCost` (leaf helpers), `getActive`/`setActive` (manager), `grantCanonicalTechnique`/`tryAdvanceTechniqueGrade` (ops). |
| Q8 security | None — identifiers + deterministic transactions only. |
| Q9 compat | No old-channel support: `insight`/`insightMultiplier`/`tierEffects`/`requiredRealm*`/`unlocked`/`equipped`/`DropKind 'technique'`/`BattleRewardItemKind 'technique'`/`addTechniqueInsight` all deleted; v69 saves rejected. |
| Q10 duplicate/stale/interrupt | `battleEndEmitted` once-flag per cycle + consume-and-zero settle (repeat-cycle re-pay impossible); `beginBattle` resets pending (defeat-session discard); stage-lease exclusivity prevents farm/manual-battle session clobber; restore detaches via `structuredClone` + re-derives authored fields. |
| Q11 old/alternate path | `TechniqueTier.ts`+test deleted (not shimmed); `useLoadoutActions` carries zero technique references; `equipped`/`unlocked`/`getEquipped`/`learnTechnique`/`equipTechnique`/`unequipTechnique`/`gainEquippedTechniqueInsight` all gone — residue census shows only doc comments. |
| Q12 scope/finish | File↔invariant map = plan tasks 1–13 + gates task 14; stop = verify green + live chain evidence + zero unclassified residue. |

## Triggered domain modules

- **C1–C7** combat/stat pipeline — pending-mastery channel through kill→settle→gainMastery; band effects resolve via `getTechniqueEffects` in PersistentEffectOps.
- **S1–S6** save/persistence — v70 bump; hard holder preflight; template re-derivation on restore; literal v69 rejection test.
- **E1–E5** economy/progression — Nâng Cảnh material transaction (atomic guard→spend→advance); quest `skillInsight` channel; mastery economy renamed end-to-end.
- **T1–T3** time/offline — `settleAutoFarmOffline` shares `rollAutoFarmCycleReward` → per-cycle mastery settle offline.
- **L1–L4** lifecycle — ritual atomic commit ordering (preflight → path/way → skills → promotion → grant); `battleEndEmitted`/`rewardOnceGuards` reset discipline; `preserveLootSession` consume-and-zero.
- **U1–U6** UI — panel repointed to `getActive()` + Nâng Cảnh affordance (cost/owned/disabled); codex owned-state via active id; slot card migrated.

## Execution log

- Implementation: TDD tests first (`TechniqueProgression.test.ts`, `TechniqueSystem.test.ts`, `BattleLootSystem.techniqueMastery.test.ts`), then model/progression/system, 6 canonical defs (folded Trúc Cơ table verbatim at `five_elements_art.gradeEffects[2]`), runtime integration (grant-after-promotion, pending/settle, grade op), reward-channel rename (enemy/drop/quest/summary/receiver), save v70 preflight + template re-derivation, UI repoints + affordance, boot grants removed; ~110 test files migrated to new ids/channels.
- Test-migration fallout fixed: legacy Vietnamese technique ids → semantic ids; `getEquipped` mocks → `getActive`; auto-farm fixture `settleTechniqueMastery` mock; DotPha retry resets `setActive(null)`; BattleLoot assertions split immediate currency vs pending vs settle vs derived insight; EarlyGameSession re-characterized (no-starter wall moved mortal_dong_8→dong_5, expected-fail documented, balance tuning deferred to M4); ~100 ASCII comment violations swept.
- P3 full verify: `npm run verify` — 709 files / 6204 tests green (4 expected-fail), type-check + build clean. Balance fingerprint did NOT drift (effect values ported verbatim at entry state; sim recipes never lose battles).
- P18 OCR (Delegation Mode): 166/166 reviewable files, 0 Medium+. Nit: `RewardList` keeps the `techniqueInsight` i18n key intentionally (zero locale diff).
- P13/P14 (worktree dev server :5910): v70 save boots; mortal `techniques:[]` (empty-holder contract); staged mortal:18 → real Quán Khí ritual → `sword:sword_pathway` → `qi_refining:1` + `sword_control_art` holder (`grade:1,rank:0,mastery:0,quality:'hoang'` — grant AFTER promotion); Tâm Pháp renders `Sơ Nhập · Cảnh 1`, `Cấp 0 · 0/300`, `Hoàng Chất`, `ĐANG TU LUYỆN`, `Nâng Cảnh — 200 Hạ phẩm Linh Thạch (0)` disabled; real dong_1 victory (10/10 kills) → `Cảm Ngộ Tâm Pháp +68` → persisted `mastery:68`, `Cảm Ngộ Kỹ Năng +41` (0.6 derivation intact); 0 console errors.
- P4 adversarial QA (quick): PASS WITH EVIDENCE — `docs/qa/2026-09-21-p7-m3-canonical-technique.md`. 13-hypothesis ledger all resolved conclusively; QA-added literal v69 rejection test (M2 convention). Escalation-to-deep documented and waived (every mandatory-escalation surface got a decisive oracle incl. live round-trip).
- P5 sequential passes: 3 passes, 0 unresolved Medium+ (see below).
- Save cutover test: `saveVersion.test.ts` gains literal v69 rejection case (`PRE_M3_VERSION = 69`) alongside v68/v61 pins and current-version acceptance.
- External review: IMPL_PASS — 0 findings (production-diff focus; transient bridge timeouts required resend).

## P5 — Sequential Multi-Pass Review

### Sequential Review Pass 1 — Local Correctness / Regression
- Reviewed state: post-OCR/QA implementation (incl. QA-added v69 test).
- Findings: none Medium+. Verified: reward-channel renames coherent end-to-end (`EnemyReward.techniqueMastery` → pending → settle → `gainMastery` → summary; `Reward.skillInsight` → `addSkillInsight` → `player.skillInsight`+`totalSkillInsightGained`); guard→spend→advance ordering; formulas preserved (300×grade rank cost, 100×targetGrade stones, 0.6 insight, 0.25 artifact EXP); `createPlayerRewardReceiver` positional mapping honest.
- Low recorded (not a defect): `totalSkillInsightGained` now counts quest/victory-channel insight too — honest lifetime semantics, no consumer assumes battle-only.
- Fixes: none required.
- Verification: focused suites green; saveVersion 4/4; type-check clean.

### Sequential Review Pass 2 — Architecture / Authority / Ownership
- Reviewed state after Pass 1 fixes: YES (no fixes — same state).
- Findings: none Medium+. Verified: `TechniqueSystem` single writer, `TechniqueManager` dumb 0-or-1 store; `way.techniqueId` sole identity (1:1 all six ways ↔ six defs, no orphans); `TechniqueProgression` leaf module (cycle-safe); `TechniqueTier` deleted not shimmed; dep injection coherent (`rewardOps` drops techniqueManager, `battleLoot` swaps to techniqueSystem); pending mastery single-owner; `getAll()` snapshot copies for save boundary.
- Fixes: none required.
- Verification: architecture/contract tests green.

### Sequential Review Pass 3 — Adversarial Integration
- Reviewed state after Pass 2 fixes: YES (no fixes — same state).
- Findings: none Medium+. Probed: repeat-cycle settle (consume-and-zero + `rewardOnceGuards` reset per cycle); farm/manual mutual exclusion via stage lease makes the `beginBattle` pending-wipe unreachable; preflight precedes identity-hash skip so corrupt payloads always re-reject; ritual re-entry blocked twice (`cultivationPath` guard + empty-holder pre-commit); mastery `< cost` invariant enforced at restore so `gainMastery` can't go negative; `getAll()` shallow copy can't corrupt the template (no writer mutates `gradeEffects`); UI reactivity via `stateVersion`/`bumpState` live-verified.
- Fixes: none required.
- Verification: full suite green; live runtime evidence end-to-end (ritual→grant→victory→settle→persist→panel).
