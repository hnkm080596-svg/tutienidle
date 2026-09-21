# P7-M2 — Mission notes (architecture-worker-workflow G0–G5 evidence)

## G0 — Task card

- **Authorized outcome:** migrate realm-entry passive ownership from equipped techniques to the committed way — `realmRewards[realmId].passiveSkillId` channel, single canonical ladder authored once in `RealmPassiveLadder.ts` (way-overridable), `syncRealmPassive` re-pointed to the way reward, `Technique.passiveSkillIdsByRealm` + `Technique.innateSkillId` removed, initiation passives moved to way `passiveSkillIds` (learned + equipped without slot). Spec `m2-realm-passive-ownership.spec.md` v3 (SPEC_PASS) + plan `m2-realm-passive-ownership.plan.md` v3 (PLAN_PASS).
- **Owner:** `PathWayDefinition.realmRewards` (way-declared, composed via `composeRealmRewards`) + `GameManagerRealmAdvanceOps.syncRealmPassive` (grant authority) + `PathWayDefinition.passiveSkillIds` (initiation kit).
- **Stop condition:** plan gates complete; `npm run verify` green; P13/P14 live evidence; P5 ≥3 passes clean; external review PASS.

## G1 — Q1–Q12 evidence

| Q | Answer (evidence) |
|---|---|
| Q1 observable behavior | Way players now actually RECEIVE realm-entry passives (the channel was dead on `tu_linh_quyet` — it was mortal-only and never equipped at ritual). Balance fingerprint regenerated + documented (30/30 cells shifted, all gates pass — `docs/balance/2026-09-21-p7-m2-realm-passive-activation.md`). Technique swap can no longer change realm passives. |
| Q2 authority | Way `realmRewards` = single source for realm-entry passives; way `passiveSkillIds` = single source for initiation passives; techniques own neither. |
| Q3 state/persistence | `grantedRealmPassiveIds` (realm ids) unchanged semantics; skill slice persists `unlocked`/`equipped` per skill; save v69 rejects v68 (dev phase, no migration — same convention as v68). |
| Q4 consumers | `syncRealmPassive` (realm transitions incl. ritual + TribulationOutcomeService), `applyPathChoice` (initiation grant + preflight), `grantCultivationPathRealmReward` (reward-record passthrough), `useTechniqueSections` (render only), `QuanKhiPanel` sealed card, e2e spec. |
| Q5 timing | Initiation passives grant at ritual commit (same transaction as path/way write, after template preflight). Realm rungs grant at realm transition via `syncRealmPassive`. |
| Q6 errors | Fail-closed: way-less/corrupt pair → `getActiveWayDefinition` undefined → no grant; missing template → preflight rejects choice atomically / `syncRealmPassive` early-return; `passiveSkillId: null` = authored suppression (falsy read). |
| Q7 naming | `RealmPassiveLadder` (data leaf, cycle-safe — no runtime dep on kit/system); `composeRealmRewards` (override merge + null suppression); `passiveSkillIds` (way kit channel). `syncRealmStatPassive` kept distinct (stat buff by grade, not the way-reward skill). |
| Q8 security | None — identifiers + deterministic grants only. |
| Q9 compat | No old-channel support: `passiveSkillIdsByRealm`/`innateSkillId` fields deleted from type + data; old saves rejected by v69. |
| Q10 duplicate/stale/interrupt | `syncRealmPassive` idempotent via `skillManager.has(skillId)`; initiation grant guarded by `!skillManager.has`; ritual commit atomic after full preflight. |
| Q11 old/alternate path | Technique channel fully removed (`equipTechnique` = pure delegate). `thai_hu_kiem_quyet` innate dropped without migrating to hidden sword — orphan stays orphan (spec). |
| Q12 scope/finish | File↔invariant map = plan tasks; stop = verify green + live chain evidence + zero unclassified residue. |

## Triggered domain modules

- **C1–C7** combat/stat pipeline — passive skills now actually delivered (balance oracle regenerated; `passive_linh_khi_cam_ung` active on all Way players at qi_refining).
- **S1–S6** save/persistence — v69 bump (technique snapshot fields dropped; boundary tolerates extra fields but version rejects old saves by convention).
- **L1–L4** lifecycle — ritual atomic commit + realm-transition grants; initiation passive grant ordering (preflight → commit → learn → equipWithoutSlot).
- **U1–U6** UI — technique panels render no passive rows; sealed hidden card kit line reads `passiveSkillIds` (raw-id fallback for unlearned kit, pre-existing).

## Execution log

- Implementation: TDD tests first (`RealmPassiveLadder.test.ts`, `GameManager.realmPassiveSkill.test.ts`, contract-test block), then ladder module, way decls (`composeRealmRewards` on all 6 ways; `passiveSkillIds` on sword/body/hidden_spell), runtime (`syncRealmPassive` re-point, `equipTechnique` slimmed, path-choice preflight+grant), technique/data field removal, UI render cleanup, save v69.
- P3 full verify: `npm run verify` — 707 files / 6154 tests green (4 expected-fail), type-check + build clean.
- Balance oracle: fingerprint regenerated deliberately (channel activation is the intended behavior change); delta documented; gates pass.
- P18 OCR (Delegation Mode): 23/23 reviewable files, 0 Medium+. Nit recorded: `composeRealmRewards` non-ladder passthrough emits `{passiveSkillId: undefined}` (semantically absent). Pre-existing note: P15 scanner cannot resume after `${}` templates (masks later comments in same file — flagged for infra follow-up).
- P13/P14 (worktree dev server :5917): real ritual → hidden_spell commit → sealed card kit line shows `ngo_dao_hon_don` → persisted v69 `spell`/`hidden_spell_pathway` → passives `ngo_dao_hon_don` + `passive_linh_khi_cam_ung` equipped without slot → staged qi_refining:12 → real Trúc Cơ tribulation → `foundation_establishment:1` + `passive_truc_co_y_chi` granted via way realmRewards → technique panel renders no passive rows → 0 console errors.
- P13/P14 two-path matrix (external-review-required legs, same server): (a) fresh char → real ritual → `sword`/`sword_pathway` → persisted `passive_kiem_tam_lanh_liet` (initiation) + `passive_linh_khi_cam_ung` (realm rung), both equipped without slot; (b) fresh char → real ritual → `spell`/`spell_pathway` → staged qi_refining:12 → real Trúc Cơ tribulation → `foundation_establishment:1` with the full way reward record delivered: `passive_truc_co_y_chi` equipped-no-slot + `dai_ngu_hanh_quyet_truc_co` technique learned/equipped + `ngu_hanh_chau` artifact initialized (realm foundation_establishment, grade pham) — the composeRealmRewards technique/artifact merge proven live. 0 console errors across all sessions.
- P4 adversarial QA (quick): PASS WITH EVIDENCE — `docs/qa/2026-09-21-p7-m2-realm-passive-ownership.md`. Findings: F1 Medium fixed (e2e oracle asserted localized name; card renders raw id for unlearned kit → corrected to `ngo_dao_hon_don`); F2 Low hardened (contract test now asserts `type:'passive'` on all declared passives — guards against free-slot bypass via active ids).
- P5 sequential passes: 3 passes, 0 unresolved Medium+ (see below).
- Save cutover test: `saveVersion.test.ts` gains a literal v68 rejection case (PRE_M2_VERSION = 68 → `incompatible`) alongside current-version acceptance — spec §6 / plan Task 1 pinned boundary.
- External review: (pending re-review after v68 test + two-path matrix)

## P5 — Sequential Multi-Pass Review

### Sequential Review Pass 1 — Local Correctness / Regression
- Reviewed state: post-QA implementation (incl. e2e fix + contract-test guard).
- Findings: none Medium+. Verified: way-less early-return, `null` suppression falsy path, `skillManager.has` idempotency, atomic preflight before commit, `thai_hu_kiem_quyet` orphan handling, `grantCultivationPathRealmReward` passthrough semantics, e2e assertion matches live DOM exactly.
- Fixes: none required.
- Verification: contract suite 30/30, e2e spec type-clean, full `npm run verify` green.

### Sequential Review Pass 2 — Architecture / Authority / Ownership
- Reviewed state after Pass 1 fixes: YES (no fixes — same state).
- Findings: none Medium+. Verified: single authority per channel (way realmRewards vs way passiveSkillIds vs technique-owns-neither); `RealmPassiveLadder` is a cycle-safe data leaf; `syncRealmPassive`/`syncRealmStatPassive` naming split documented (skill grant vs stat buff); contract test binds catalog invariants incl. new passive-type guard; UI layer reads way declarations only.
- Fixes: none required.
- Verification: architecture tests green (incl. P15 ASCII ratchet).

### Sequential Review Pass 3 — Adversarial Integration
- Reviewed state after Pass 2 fixes: YES (no fixes — same state).
- Findings: none Medium+. Probed: `!= null` guard handles `null` suppression and `undefined` passthrough without false flags; type guard can't false-positive on turn-skill defs (all game passives are `Skill` defs in `SKILLS`); hidden ways without `passiveSkillIds` inherit nothing (per-way declarations); realm-id tracking vs skill-id idempotency both hold; live foundation transition exercised the real `TribulationOutcomeService` → `syncRealmPassive` path. Low residual accepted: raw-id kit-line rendering (pre-existing UX, recorded in QA report).
- Fixes: none required.
- Verification: full suite green; live runtime evidence end-to-end.
