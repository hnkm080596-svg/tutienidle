# Coordinator source sweep — CONTINUATION on final head 2d5349a6

Producer: coordinator (devin-4df500e190cc4b9d837f408a5ed53852), NON_INDEPENDENT — independence supplied by sealed reviewers.

## I-IMPL-NO-ALLOC — no creation-time attribute distribution channel
- `rg 'pointsLeft|allocat|distribut|p_attributes|attributePoints' src/ tests/ supabase/`: hits only (a) comments documenting removal (migration + screen), (b) ProductionPanel worker allocation + CharacterPanel in-game attribute points — DIFFERENT post-creation systems, untouched.
- `CharacterCreationDraft` = {name, talentIds, mortalBasicSkillId} — no attribute field (CharacterCreationService.ts:11-14).
- RPC body sends `p_session_id, p_roll_id, p_name, p_talent_ids, p_mortal_basic_skill_id, p_initial_save, p_schema_version` — no `p_attributes` (SupabaseCharacterCreationService.ts:58-70). `p_initial_save: {}` is unchanged from base (v81 sent the same empty payload; boot-time save sync upserts character_saves directly per migration comment).
- Server migration enforces fixed `'{"strength":1,"dexterity":1,"intelligence":1,"attunement":1,"vitality":1}'` insert + drops v81 overload.

## I-IMPL-NO-SILENT-TRAM — no silent resolve without persisted pick
- Sole player-write: `GameManagerProgressionOps.setMortalBasicSkill` (:652). Other occurrences: Player.ts:421 init-undefined; RealmAdvanceOps.ts:315 `delete` on realm commit (post-path clear is REQUIRED by v82 preflight); GameSave.fixture.ts test channel; EssenceSubstitutionEconomy/PerfectionEconomy sim profile fields feeding bootstrapEarlyGamePlayer (not player writes).
- `resolveBasic` (CultivationPathRegistry.ts:334-350): absent/illegal/unlearned pick → MORTAL_DEFAULT_BASIC_ID='tram' read-time default only — never writes. v82 preflight rejects missing picks on mortal saves at restore.

## I-IMPL-PICK-REQUIRED + I-IMPL-SAVE-PREFLIGHT — v82 preflight fail-closed
- GameManagerSaveRestore.ts:277-303: invalid-id throw, post-mortal-presence throw (realmId-keyed predicate `isMortalSave` after COR-B2 repair), missing-pick throw, not-learned throw. Preflight runs before owner mutation; saveOps.restoreFromSave re-runs idempotently.
- Detector pins: SaveSystem.bootRestore.test.ts + GameManagerSaveRestore.boundary.test.ts cover all 4 cases incl. zero-mutation asserts.

## I-IMPL-SKILL-MAP — pick set == {tram,linh_bao,huy_quyen}
- MortalPrecursors.ts: `MORTAL_PRECURSOR_SKILL_IDS=['tram','linh_bao','huy_quyen']`, default 'tram'. isMortalPrecursorSkillId used by validateDraft, bootstrap pick check, migration CHECK, save preflight.

## I-IMPL-RPC — client body == migration signature
- Contract test pins exact 7-param keyset against migration 202608240001 + forward migration 202609240001 provides same signature for already-migrated DBs (adds column if missing, backfills 'tram', drops v81 overload, re-grants).

## I-IMPL-CONSUME-ONCE — pendingCreationPick lifecycle
- App.vue:557-559: `const pick = pendingCreationPick; pendingCreationPick = undefined; if (pick===undefined) throw` inside onNewCharacter — inside bootGame transaction; newCharacterGrantsApplied→hardReset on re-entry (useAppLifecycle.ts:252-256,340). Sole writer: onCharacterCreated (:629). AST order pinned by App.wiring.test.ts.

## I-IMPL-UI-FLOW — single screen
- CharacterCreationScreen.vue: one screen (name + talent-grid + skill-grid); no stepper/step ref; emit('complete', payload) carries mortalBasicSkillId; emit('back') only escape.

## I-IMPL-DISPLAY-NAMES + I-IMPL-I18N
- Precursor names: tram='Huy Kiếm', linh_bao='Linh Bạo' (CoreSkills.ts:69), huy_quyen='Huy Quyền' (TurnSkillDisplayMeta.ts:48,52).
- i18n parity: all 19 keys used by the screen resolve; 40 creation-namespace keys parity both directions (scripted check, exit 0).

## I-IMPL-SPEC-TRACE + I-IMPL-PLAN-EXEC
- Spec §48 census-as-was table documents old stepper deliberately; §1c2 allocation-economy budget kept untouched per ruling (docs/specs/beta-creation-spec.md — intentional). docs/online-login-cloud-save-plan.md: no allocation residue (repaired). Plan steps executed in declared order (service → boot seam → screen → save layer).

## I-IMPL-QA-JOURNAL — run dir journaled on branch devin/qa-creation-impl (this run dir).
