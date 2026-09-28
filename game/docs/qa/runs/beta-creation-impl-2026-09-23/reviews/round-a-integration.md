# REV-A-INTEGRATION — Sealed Review Record

**Run:** beta-creation-impl-2026-09-23 · **Request:** req-roundA-integration · **Phase:** INTEGRATION · **Previous phase:** REV-A-AUTHORITY
**Target:** `2d5349a674de39738b7e23a6dcdd5c343ef7dc68` (PR #21) against base `6d9af7a9` (origin/beta/rc)
**Verdict:** FINDINGS · **priorFindingsVisible:** false

## Scope reviewed

Aggregate diff `6d9af7a9..2d5349a` (all production, test, SQL-migration, spec-doc, and non-`qa/` surfaces). Every contract-slice claim was traced to code:

- **Sole-write** — `mortalBasicSkillId` is written only by `GameManagerProgressionOps.setMortalBasicSkill` (GameManagerProgressionOps.ts:652), called from `EarlyGameBootstrap.bootstrapEarlyGamePlayer` (the boot seam) and `SkillRoleStrip.vue` (mortal-only in-game switcher). `GameSave.fixture.ts` writes the field directly but is test-only scaffolding.
- **Boot-seam ordering** — pick is read→cleared→consumed inside `onNewCharacter` (App.vue:549-593), pinned consume-once by App.wiring.test.ts AST-order assertions. The pick write precedes the first save, which is inside the boot transaction (useAppLifecycle.ts:340-408); autosave starts only after `boot.enterGame()` (App.vue:610) and `persistProgress` is gated on `entryStage === 'game'` (:211). No save can interleave between pick-write and first save; the first save is always pick-inclusive.
- **Version gate** — `CURRENT_SAVE_VERSION = 82` (saveVersion.ts); `inspectLocalSave` returns `incompatible` for v81 (SaveSystem.ts:478) → `saveIssue.report` → `SaveIncompatibleScreen` (export/import/delete recovery). Version lives *inside* `validateGameSaveShape` (saveShapeValidation.ts:1653), so a v81 remote payload is never pulled (`syncRemoteSaveOnLogin`, SupabaseRemoteSave.ts:59-60); a present local save is pushed over the remote row (self-healing).
- **v82 preflight** — `preflightSaveRegistryReferences` (GameManagerSaveRestore.ts ~263-300): mortal (`realmId==='mortal' && cultivationPath===undefined`) requires pick present AND `save.skills.some(e => e.id === pick)`; non-mortal + pick → throw; non-precursor pick → throw. Runs before any owner mutation in `restoreGameSession` (SaveSystem.ts:272). All three reject classes are covered by boundary.test.ts.
- **Ritual commit clears pick** — single commit seam `applyPathChoice` → `delete player.mortalBasicSkillId` (GameManagerRealmAdvanceOps.ts:307-315) covers every way including hidden ways; `applyPathChoice` is the sole `cultivationPath` writer (Player.ts:120). Post-path saves are legal v82.
- **Hidden-way Lv3 gates** — all three precursors learned at bootstrap; the in-game pick switcher (SkillRoleStrip.vue:173) keeps any learned precursor selectable, and the cast-count sink (GameManager.ts:521-525) credits the cast skill id, so each precursor's cast-level gate stays reachable. Reveal/offer gates unchanged.
- **TurnSkillDisplayMeta rename** — `'Hủy Quyền'`→`'Huy Quyền'` aligns with the CoreSkills.ts template name; only consumer is display (BattleLogPanel). No authority impact.
- **e2e helper honesty** — `createCharacterThroughUi` (tests/e2e/helpers.ts) drives the real screen via testids (name → talent card → `creation-skill-tram` → finish). No bypass.
- **RPC** — client sends `p_mortal_basic_skill_id` + `p_schema_version` + `p_initial_save:{}` (contract test pins exact keys); edited migration 202608240001 + forward migration 202609240001 drop the v81 overload, add `mortal_basic_skill_id NOT NULL` with `'tram'` backfill, revoke/grant on the new signature.

## Findings

### F-INT-01 — Medium — v82 preflight rejections dead-end on a no-recovery boot screen (repro included)

**Evidence.** A save that is `version: 82` + shape-valid but violates the pick contract is **accepted by every boundary below restore** and then rejected at `restoreGameSession`:

- `validateGameSaveShape` stays structural for the player slice by design (saveShapeValidation.ts:731-734).
- `importSaveRaw` writes any version-82 shape-valid payload (SaveSystem.ts:712-719).
- `inspectLocalSave` returns `ok` (SaveSystem.ts:490-503).
- `restoreGameSession` → `preflightSaveRegistryReferences` throws → `{status:'rejected'}` (SaveSystem.ts:272-278).
- `bootGame` maps `rejected` → `onError` + `boot.fail()` (useAppLifecycle.ts:315-318) → the generic boot-error screen shows only "Trở về đăng nhập" (App.vue:711-717). `saveIssue` is set only for `incompatible`/`corrupted` (useAppLifecycle.ts:295-300), so the save is never deletable in-app: every subsequent boot re-reads it → same reject → **permanent boot loop**, escape requires manual localStorage clearing.

**Repro (executed):** `game/src/services/save/SaveSystem.v82RejectRecovery.qa.test.ts` — `npx vitest run src/services/save/SaveSystem.v82RejectRecovery.qa.test.ts` → 2/2 pass: (1) a mortal v82 save with `mortalBasicSkillId` deleted shape-validates AND is accepted by `importSaveRaw`/`inspectLocalSave`; (2) the same save is `rejected` at `restoreGameSession` with a `mortalBasicSkillId` message.

**Why this diff widens it:** the reject-trap shape is pre-existing (technique-holder preflight), but v82 adds the single most plausible producer — a mortal save missing the pick. The natural user response to "save incompatible" is to hand-edit `"version": 81 → 82` in an exported save and re-import via the app's own import feature; under v81 that produced a working save, under v82 it produces an unrecoverable wedge.

**Expected:** a save the boot path cannot consume should reach a recovery surface (export/delete) — at minimum parity with `incompatible`/`corrupted`. **Actual:** `rejected` lands on a screen with no delete/export path. **Root cause:** the restore-preflight failure class (`restoreGameSession` 'rejected') is routed to `onError`/`boot.fail` instead of `saveIssue.report`. **Suggested pin:** map 'rejected' through `saveIssue.report('corrupted', …)` (or a dedicated rejected-save screen with the same delete/export affordance) in useAppLifecycle.ts:315-318.

### F-INT-02 — Low — SQL migrations hardcode the precursor id list (duplicated authority)

`202608240001` and `202609240001` each validate `p_mortal_basic_skill_id not in ('tram','linh_bao','huy_quyen')`, duplicating `MORTAL_PRECURSOR_SKILL_IDS` (MortalPrecursors.ts). Consistent today; a future fourth precursor added client-side would be rejected server-side with no shared source. Suggested pin: comment or a thin spec noting the SQL list must mirror the TS constant (or a generated check).

### F-INT-03 — Low — "Back" remains live during `creating`; abort intent ignored

CharacterCreationScreen.vue:95 renders the back button unconditionally. `finish()` sets `creating=true` then `await createCharacter` (…:66-84): clicking back during the RPC window emits `back` (→ auth screen), but the resolved promise still emits `complete` → `onCharacterCreated` → `bootGame(true)` — the character is created and booted despite the user's abort. Reachable only under real RPC latency (mock resolves near-instantly). Suggested pin: `:disabled="creating"` on the back button.

## Coverage notes

- **Balance:** removing the 5-point allocation nets −5 creation stats vs. the unchanged all-1 base (pre-diff `applyCreationProfile` did `baseStats[stat] += amount`). Matches the contract's "auto 1/1/1/1/1"; `MortalChapterJourney` was re-pinned to spend earned points instead and still completes. Intended change, noted for completeness.
- **e2e pick coverage:** the helper always selects `creation-skill-tram`; `linh_bao`/`huy_quyen` have unit/contract coverage but no e2e pass.
- **`onRestoreOk` precursor backfill** (App.vue:534-548) is dead code for legit v82 saves but is load-bearing repair for hand-edited saves where only the pick is learned — keep.
- **Boot-flow half of F-INT-01** is proven at the unit/inspection level; no e2e drives a crafted save through the real boot UI.
- **Fixture note:** `GameSave.fixture.ts` (src/services/save/) writes `player.mortalBasicSkillId` directly — a second write path in `src/`, test-only; dead-code-eliminated from the prod bundle.

## Access limitations

- `game/docs/qa/**` intentionally unread per the information boundary (the QA skill's learned-defects corpus was skipped deliberately).
- No live Supabase backend: the two migrations and the RPC contract were verified statically (SQL text + client body + contract test); not executed against a database.
- No browser run of the full create→save→combat loop per pick; evidence is unit/integration level plus the executed repro above.

## Verification evidence

- `npm run type-check` (game/) — exit 0.
- `npx vitest run` over 20 focused suites (save/restore, boundary, creation screen, App wiring, lifecycle, skill-role strip, bootstrap, version, remote sync, journey sim) — 612/612 pass.
- Repro test authored and executed: `SaveSystem.v82RejectRecovery.qa.test.ts` — 2/2 pass, demonstrating the F-INT-01 accept/reject split.
