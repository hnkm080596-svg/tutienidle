# REV-A-CORRECTNESS — Sealed Review Record

- run: beta-creation-impl-2026-09-23
- requestId: req-roundA-correctness (phase: CORRECTNESS, first in chain)
- target: PR #21 head 2d5349a674de39738b7e23a6dcdd5c343ef7dc68 (branch devin/1790189100-beta-creation)
- diff: `git diff 6d9af7a9..2d5349a674de39738b7e23a6dcdd5c343ef7dc68` — 126 files / ~55k insertions; the bulk is `game/docs/runs/**` generated artifacts (manifest.json ~22k lines x2, ledger) excluded as non-code coordinator output.
- **verdict: FINDINGS** — one Low-severity defect; zero Medium-or-higher.
- priorFindingsVisible: **false** — `game/docs/qa/**` was never opened. Disclosure: while scoping the diff I enumerated filenames under `game/docs/runs/beta-creation-impl-2026-09-23/**` (a review-manifest index belonging to a different requestId) — paths only, no finding or evidence bodies were read.

## Verification executed

`cd game && npm run type-check` — clean (vue-tsc --build, exit 0).
`npx vitest run` on 13 touched files — 166 tests green in two scoped invocations: GameManager.mortalBasicSkill, GameManagerSaveRestore.boundary, SaveSystem.bootRestore, SaveSystem.saveLoadRoundTrip, CharacterCreationService, SupabaseCharacterCreationService.contract, CharacterCreationScreen, App.wiring, SaveSystem.bodyPerfection, GameManager.r7qa, SaveSystem.talentPassiveRestore.qa, GameManager.dissolveUnifiedEssence, GameManager.legacySkillRestore.

## Attack-surface probes

### 1. Boot-seam ordering — SOUND
`EarlyGameBootstrap.bootstrapEarlyGamePlayer` (game/src/core/game/EarlyGameBootstrap.ts) performs, in order inside one onNewCharacter call: applyCreationProfile (name + selectedTalentIds only — attribute block fully removed) -> learnSkill x3 for MORTAL_PRECURSOR_SKILL_IDS -> `for` loop throwing `bootstrap: precursor learn failed: <id>` when `!skillManager.has(id)` -> `setMortalBasicSkill` throwing `starting-skill pick rejected` on false. Fail-closed on both stages; `SkillSystem.learn` (SkillSystem.ts:275-286) writes `manager.add`, so `has()` reads the same learned authority — the loop cannot pass a failed learn. Idempotent on re-entry (already-learned still passes has()). Partial boot state cannot persist: onNewCharacter throws -> useAppLifecycle catch -> onError('save.createFailed') + boot.fail(); the `newCharacterGrantsApplied` flag set before the call (line 340) forces `deps.hardReset()` on the next createNewCharacter (line 252-258).

### 2. pendingCreationPick lifecycle — SOUND
App.vue module slot (line 625) written only by onCharacterCreated immediately before `await bootGame(true)`; consumed by onNewCharacter as read->clear->use (line ~549-561), ordering pinned by the App.wiring.test.ts AST test (`readPos < clearPos < usePos`). Cannot go stale-as-wrong-pick: the only `bootGame(true)` caller is onCharacterCreated, which always rewrites the slot first; a second onNewCharacter without a fresh write throws (`pick === undefined`). bootInFlight serializes concurrent boots.

### 3. Restore preflight vs shape layer — SOUND
Order in the real path: version gate (`foundVersion !== 82` -> incompatible, SaveSystem.ts:478) -> `validateGameSaveShape` (structural; pick deliberately deferred per saveShapeValidation.ts:731 comment) -> `preflightSaveRegistryReferences` (zero-mutation, GameManagerSaveRestore.ts:~263-302) -> owner mutations. Preflight covers every hole shape leaves: non-precursor values, missing-on-mortal (`mortal save missing required mortalBasicSkillId`), present-on-non-mortal (`mortalBasicSkillId persisted post-mortal`), and not-learned (`mortalBasicSkillId not learned in save`). Crafted `cultivationPath: null` evades the `=== undefined` check but the shape layer already rejects mortal+hasPath first. Boundary tests cover it.each valid picks plus 'hoa_cau_thuat', 'khong_ton_tai', '', 7, post-path, and non-mortal-realm rejections — all green.

### 4. Fixture contract — SOUND
`withMortalCreationPick` / `primeMortalCreationPick` (GameSave.fixture.ts) validate precursor ids, no-op on non-mortal/path players, and write all three channels coherently: `player.mortalBasicSkillId`, a structuredClone'd SKILLS entry in skills[], and `core_<id>` grant via nodeLevels+purchasedNodeIds — mirroring learnSkill + grantSkillCore (NodeSystem.ts:465). No partial-channel write path exists.

### 5. Contract slice — VERIFIED
- Attributes auto 1/1/1/1/1: creation writes none; RPC inserts the constant jsonb; CHARACTER_CREATION_ATTRIBUTE_POINTS removed.
- Sole-write: grep shows only `player.mortalBasicSkillId = skillId` at GameManagerProgressionOps.ts:652 (plus the intended ritual `delete` at GameManagerRealmAdvanceOps.ts:315 and test-only fixture writes).
- SkillRoleStrip.vue:173 exposes a runtime re-pick UI — legitimate second caller of the sole-write op, path-gated inside setMortalBasicSkill.
- Save v82 + version gate + preflight together enforce the pick contract; older saves reject at the gate.
- RPC gains `p_mortal_basic_skill_id` (name-bound) and the v81 overload is explicitly dropped in BOTH the edited base migration and the new forward migration; revoke/grant re-scoped to the new signature.

## Findings

### REV-A-COR-1 — Low — stale error releases the creating-latch
`CharacterCreationScreen.vue` finish() (lines 65-86) never clears `error.value` (reroll() does at line 55). After a failed attempt, a successful retry emits 'complete' but `finally { if (error.value) creating.value = false }` reads the stale flag — the button re-enables under the closing curtain and the old message stays rendered (:132). Bounded: emit requires ok:true; a re-clicked second createCharacter is blocked server-side by the RPC name check and locally by bootInFlight — cosmetic impact only. Suggested pin: mock ok:false-then-ok:true; assert error==='' and the button stays latched post-emit.

## Coverage notes / out-of-scope
- Shape layer does not reject `realmId!=='mortal' && cultivationPath===undefined` — pre-existing gap, unaffected by this diff.
- `p_initial_save: {}` written with `p_schema_version: 82` — pre-existing empty-payload seam, unchanged.
- E2E helper picks 'tram' uniformly; linh_bao/huy_quyen paths covered at unit level only.
- Migrations not applied to a live Postgres — arg-name binding and overload-drop verified by inspection.
- `newCharacterGrantsApplied` is never reset after being set — unreachable post-success (empty-branch only), correct as retry defense-in-depth.

## Seal

All five listed attack surfaces verified sound under static proof + executed tests; one Low defect filed (REV-A-COR-1) with bounded impact and a suggested pin. No Critical/High/Medium findings.
    coverageNotes: Verified surfaces: (1) boot seam — 3 precursor learnSkill calls precede the setMortalBasicSkill write inside one onNewCharacter invocation; the has()-loop throws on any missing precursor and a failed pick write throws — fail-closed; second-call idempotency holds (learn false on already-learned still passes has()). (2) pendingCreationPick — written only by onCharacterCreated before bootGame(true); read->clear->use in onNewCharacter; bootInFlight serializes; newCharacterGrantsApplied dirty-transaction fence forces hardReset on any retry (flag never reset post-set, but unreachable after success — noted, not a defect). (3) restore ordering — v82 version gate first, then shape (pick deliberately deferred), then preflight covering non-precursor values, missing-on-mortal, present-on-non-mortal, and unlearned — all before owner mutations; no shape-level hole for the pick contract. (4) fixtures — withMortalCreationPick/primeMortalCreationPick write all three channels coherently (pick field, learned skills[] entry, core_<id> nodeLevels + purchasedNodeIds) mirroring learnSkill+grantSkillCore. (5) Supabase — p_mortal_basic_skill_id binds by name, hardcoded 1/1/1/1/1 attributes inserted, v81 overload dropped in both migrations, revoke/grant re-scoped. Out-of-scope/pre-existing notes: shape layer does not reject realmId!=='mortal' && cultivationPath===undefined (pre-existing, pick-irrelevant); RPC inserts p_initial_save:{} labeled schema 82 (pre-existing empty-save seam); e2e exercises only 'tram' (other picks covered by unit it.each); crafted JSON cultivationPath:null bypasses the === undefined mortal check but the shape layer already rejects mortal+path in the real load path; useAppLifecycle's reset() is trivial and bootInFlight's finally covers all early branches, leaving no uncovered throw window before onNewCharacter.
    novelAttackIds: mortal-repick-via-skillrolestrip-ui-postboot, earlygamesession-postpath-playerowner-reject, crafted-mortal-save-cultivationPath-null-vs-undefined-gate, creation-screen-stale-error-latch, mock-mode-double-emit-absorbed-by-bootinflight
    evidenceSummary: Executed: cd game && npm run type-check (vue-tsc --build, exit 0); npx vitest run on 13 touched files across two invocations — 6 files/118 tests (GameManager.mortalBasicSkill, GameManagerSaveRestore.boundary, SaveSystem.bootRestore, SaveSystem.saveLoadRoundTrip, CharacterCreationService, SupabaseCharacterCreationService.contract) and 7 files/48 tests (CharacterCreationScreen, App.wiring, SaveSystem.bodyPerfection, GameManager.r7qa, SaveSystem.talentPassiveRestore.qa, GameManager.dissolveUnifiedEssence, GameManager.legacySkillRestore) — all green. Static proofs: sole-write grep (only GameManagerProgressionOps.ts:652 assigns player.mortalBasicSkillId in production); SkillSystem.learn writes manager.add so bootstrap's has() reads the same learned authority; restore order version-gate->shape->zero-mutation preflight->mutations verified by line inspection; pendingCreationPick consume-once pinned by AST wiring test; both migrations carry the explicit v81-overload drop.
    accessLimitations: Playwright e2e suite not executed — the createCharacterThroughUi flow was verified statically and at unit level only; no browser runtime evidence., Supabase migrations (edited base migration + new forward migration) reviewed statically; not applied against a live Postgres/PostgREST instance — RPC arg-name binding and old-overload drop verified by inspection only., Boundary note: while scoping the diff I enumerated filenames under game/docs/runs/beta-creation-impl-2026-09-23/** (a review-manifest index for a different requestId) but read no finding/evidence bodies; game/docs/qa/** was never opened.
    priorFindingsVisible: False
