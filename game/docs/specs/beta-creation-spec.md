# BETA-CREATION — Creation rework: drop 5-point allocation, add starting-skill pick — Spec

Status: v1 — draft, parked for coordinator spec/plan review (mission gate:
docs only, no production code until release).
Base: `origin/beta/rc` @ `6d9af7a9` (post-P7 master, `CURRENT_SAVE_VERSION = 81`,
`services/save/saveVersion.ts:163`). Branch `devin/1790189100-beta-creation`.
Depends on: P7-M4 combat-role contract (`docs/p7/missions/m4-combat-role-contract.spec.md`
— `mortalBasicSkillId`, `setMortalBasicSkill`, `MORTAL_PRECURSOR_SKILL_IDS`,
the precursor cast-leveling gates); QI-S save policy (version rejection, no
translators).

## 0. Pinned product ruling (verbatim — already decided, do not re-litigate)

1. REMOVE the 5-point stat allocation entirely — no allocation step, no
   allocation UI, no service path that distributes points at creation.
2. New characters are created with auto base stats 1/1/1/1/1.
3. ADD a starting-skill choice: exactly three options — `Linh Bạo`,
   `Huy Quyền`, `Huy Kiếm`.
4. ONE unified creation flow: `name + talent + skill` — a single flow, not
   sequential separate screens.
5. Bootstrap must no longer silently decide `tram` for the player.

Save version: CURRENT+1 on the merged base ⇒ **82** (bump + migration only if
the persisted shape actually changes; removal of creation-allocation data and
the new creation-pick contract = a contract change — spec below). Rejection of
old saves is the intended mechanism.

## 1. Audit verdict — creation-surface census

Verified file-by-file against `origin/beta/rc` @ `6d9af7a9` (save v81). Every
line number below is `src/`-relative under `game/` unless stated.

### 1a. Creation contract layer (service + draft)

| Surface | Evidence | Verdict |
|---|---|---|
| Attribute budget constant | `services/character/CharacterCreationService.ts:3` — `CHARACTER_CREATION_ATTRIBUTE_POINTS = 5` | DELETE — creation use is the only STAT write, but the constant also feeds the mortal-perfection budget model (§1c2) which must re-derive `creationPoints = 0` |
| Draft shape | `CharacterCreationService.ts:11-18` — `CharacterAttribute` union, `CharacterAttributes`, `CharacterCreationDraft {name, talentIds, attributes}` | RESHAPE — `attributes` out; `mortalBasicSkillId` in (§3 D1) |
| Draft validation | `CharacterCreationService.ts:52-55` — integer/nonneg/sum==5 check + `'invalid_attributes'` code (:20) | REPLACE with pick-membership validation (§3 D1) |
| Service impls | `MockCharacterCreationService.ts` (all draft-shaped, no own attribute logic); `SupabaseCharacterCreationService.ts:65` — sends `p_attributes` in `create_character` RPC | RESHAPE — RPC body loses `p_attributes`, gains the pick param (§3 D6, open question Q-D) |
| Server function | `supabase/migrations/202608240001_online_auth_character.sql:139-167` — `create_character` signature `(uuid,uuid,text,text[],jsonb,jsonb,integer)`: `p_attributes` validated (:156-159 sum=5), inserted to `base_attributes` NOT NULL (:44,:162), grants signature-scoped (:191,:196) | RESHAPE IN-REPO (INT-A-2) — the function is owned by this repo: add `mortal_basic_skill_id` column + `p_mortal_basic_skill_id` param, drop the v81 overload explicitly (`create or replace` alone leaves it callable), `base_attributes` gets the fixed 1/1/1/1/1 literal. Deploy order: same window as the client |
| Service consumers | `CharacterCreationServiceFactory.ts` (singleton select), `CharacterCreationScreen.vue` (sole UI caller) | unchanged surface |

### 1b. Creation UI layer

| Surface | Evidence | Verdict |
|---|---|---|
| Screen | `components/onboarding/CharacterCreationScreen.vue` — 3-step stepper: `step` ref :18; name step :93-101; talent step :103-115; attribute step :117-127 (`changeAttribute` :59-63, `pointsSpent`/`pointsLeft` :36-37, `attributeLabels` :29-35, `attributes` ref :25); emit payload `CharacterCreationPayload {name, talentIds, attributes}` :11-15 | REWORK — single unified surface (§3 D5); attribute section + stepper removed; skill chooser added; payload reshaped |
| Styles | `CharacterCreationScreen.vue:135-141` — `.stepper`, `.attribute-*`, `.points`, `.counter`, `.creation-summary` | PRUNE with the rework |
| i18n keys | `locales/vi.json:894` `"step"` + `:896-912` nameStep/talentStep + `:913-922` attributeStep + `:923-936` attributes block; `locales/en.json` mirrors at :894-936 | RESHAPE — attributeStep/attributes out, `skillStep` in; `step`/`stepperAria` die with the stepper (§3 D5); parity pinned by `tests/architecture/i18nKeyParity.test.ts` |
| Payload consumers | `App.vue:621-635` `onCharacterCreated` (name + talentIds + `baseStats += attributes` :626-630) | RESHAPE — stats loop deleted; pick routed per §3 D2 |

### 1c. Boot / profile layer — the duplicated write path (pre-existing drift)

| Surface | Evidence | Verdict |
|---|---|---|
| Shared creation seams | `core/game/EarlyGameBootstrap.ts` — `EarlyGameCreationProfile {name, talentIds, attributes}` :19-28; `applyCreationProfile` :30-42 (`baseStats +=` :37-41); `bootstrapEarlyGamePlayer` :44-59 (learns tram/linh_bao/huy_quyen :53-58) | RESHAPE — profile loses `attributes`, gains the pick; bootstrap gains pick application (§3 D2) |
| App write path | `App.vue:548-591` `onNewCharacter` — INLINE `learnSkill('tram'/'linh_bao'/'huy_quyen')` :552-560 + app-only wiring (buildings :561-572, materials :574-583, production autostart :585-588, `setActivePlayer` :591); `onCharacterCreated` :621-635 — INLINE name/talentIds/baseStats writes | DRIFT — `EarlyGameBootstrap.ts:1-15` claims "both consumers (App.vue handlers, EarlyGameSession) run ONE path" but App.vue never calls the seams; it re-implements them. FIX in scope: delegate the core subset to the shared seams (§3 D2/D3 — A9, A12) |
| Legacy restore seam | `App.vue:533-546` `onRestoreOk` — idempotent learn of `tram` + `linh_bao`/`huy_quyen` on old saves | KEEP — dead once v82 rejects v81 saves, but harmless for in-flight/corrupt states; no change needed this mission |
| Sim consumer | `core/simulation/earlygame/EarlyGameSession.ts:71` (`profile: EarlyGameCreationProfile`) + `:244-245` (`applyCreationProfile` then `bootstrapEarlyGamePlayer`) | RESHAPE — profile gains pick; session passes it through to bootstrap (§3 D2) |
| Boot ordering | `useAppLifecycle.ts` `bootGame({createNewCharacter, onNewCharacter})` — `onCharacterCreated` (App.vue) runs BEFORE boot; `onNewCharacter` callback runs inside the boot transaction before first save | ORDER FACT — the pick cannot be written via `setMortalBasicSkill` inside `onCharacterCreated` (skills not learned yet, `skillManager.has` fails); it must land inside the post-learn seam (§3 D2) |

### 1c2. Sim economy model — allocation is a budget term, not just UI (sealed-review REV-A-01/F1 catch)

| Surface | Evidence | Verdict |
|---|---|---|
| Mortal-perfection budget | `core/simulation/earlygame/PerfectionEconomy.ts:25` imports the constant; `mortalStatBudget()` :91-115 uses it as `creationPoints` inside `available` (:103) and the `shortfall` identity (`PerfectionEconomy.test.ts:132` asserts measuredDeficit === shortfall) | RESHAPE — `creationPoints = 0` post-ruling (creation no longer grants stats); the deficit identity re-baselines with breakthrough as the only enumerated source |
| Measurement profiles (production .ts, NOT test files) | `PerfectionEconomy.ts:32-35` + `EssenceSubstitutionEconomy.ts:48-51` — `MEASUREMENT_PROFILE: EarlyGameCreationProfile` literals carrying `attributes: {strength:2, vitality:3}` | RESHAPE — swap `attributes` → `mortalBasicSkillId: 'tram'` (compile breaks otherwise under the reshaped profile) |
| Boundary test absent-default pin | `core/game/GameManagerSaveRestore.boundary.test.ts:1019-1045` — v71 describe pins 'restores a mortal save carrying no pick (absent = tram default)' | REWRITE → v82 describe: absent rejected, non-precursor rejected, unlearned rejected, learned pick accepted ×3 |
| Stale test title | `core/game/GameManager.theTuAnE2E.test.ts:330` — 'creation-granted tram' | RETITLE — wording only |
| Sim profile stat values (INT-A-4) | every sim `MEASUREMENT_PROFILE`/journey profile carried `attributes:{strength:2,vitality:3}` → chars at 3/4 STR/VIT pre-ruling, 1/1/1/1/1 post | RE-PIN RULE — conversion is NOT value-neutral: pinned margins (MortalChapterJourney:48,54,:66,:91-96; TrucCoJourney; economy verdicts) may drift on weaker characters; re-pin to new measured values only after confirming the flip is expected weaker-start drift |
| Restore-fixture sweep (INT-A-1) | ~24 test files reach `restoreFromSave`/`restoreGameSession` with pickless mortal fixtures (`baseSave()` skills:[] :50-69, `createIncomingSave()` bootRestore:24-26, `validSave()` shape, `createDefaultPlayer()` call sites in saveLoadRoundTrip/conformance/r81qa + GameManager r7qa/r9qa/theTuE2E/bodyPhysique/questLifecycle/workerCapacity/refine/wash/overflow/legacySkill/autoFarm/dissolveUnifiedEssence + sim journeys MortalChapterJourney:222/TrucCoJourney:751/EarlyGameSession:587) | SWEEP — v82 mortal-required makes every pickless fixture red; each factory gains pick + learned skill entry |
| Sim profile stat values (INT-A-4) | every sim `MEASUREMENT_PROFILE`/journey profile carried `attributes:{strength:2,vitality:3}` → chars at 3/4 STR/VIT pre-ruling, 1/1/1/1/1 post | RE-PIN RULE — conversion is NOT value-neutral: pinned margins (MortalChapterJourney:48,54,:66,:91-96; TrucCoJourney; economy verdicts) may drift on weaker characters; re-pin to new measured values only after confirming the flip is expected weaker-start drift |

### 1d. The pick authority (P7-M4 contract — already landed)

| Surface | Evidence | Verdict |
|---|---|---|
| Precursor set | `core/skill/MortalPrecursors.ts:7` — `['tram','linh_bao','huy_quyen']`; `MORTAL_DEFAULT_BASIC_ID='tram'` :9; `isMortalPrecursorSkillId` :11-12 | REUSE AS-IS — the ruling's three options map exactly (§2) |
| Persisted field | `core/player/Player.ts:124-132` — `mortalBasicSkillId?: string` (mortal-only pick; cleared by ritual commit); default `undefined` :418 (Pinia toRefs convention) | REUSE — no new field needed |
| Sole role write | `GameManagerProgressionOps.ts:639-655` `setMortalBasicSkill` — guards: `cultivationPath===undefined`, `isMortalPrecursorSkillId`, `skillManager.has(skillId)` | REUSE — creation must route through it (§3 D2) |
| Runtime read | `core/player/CultivationPathRegistry.ts:325-346` `createMortalRuntime().resolveBasic` — pick ∩ precursor ∩ learned → else `MORTAL_DEFAULT_BASIC_ID` | KEEP — `absent→tram` becomes defensive-only (unreachable on valid v82 saves, §3 D4) |
| In-game repick UI | `components/panels/skill-path/SkillRoleStrip.vue` — `isPickedPrecursor` :121-124 uses `?? MORTAL_DEFAULT_BASIC_ID` display fallback; chooser writes via `setMortalBasicSkill` :173 | KEEP — unchanged; display fallback is defensive display, not a decision |
| Ritual clear | `GameManagerRealmAdvanceOps.ts:315` — `delete player.mortalBasicSkillId` inside the initiation commit | UNCHANGED — post-path presence stays corrupt |
| Save preflight | `GameManagerSaveRestore.ts:265-283` — v71 contract: pick must be precursor-valid and mortal-only | EXTEND for v82 — mortal ⇒ pick REQUIRED (§3 D4) |
| Role composition | `resolveCombatSkillRoles` (`core/player/CultivationPathRoles.ts:29`) ← `progressionOps.getResolvedSkillRoles` (:668) for UI, `CombatBuild.ts:225` for battle | UNCHANGED consumers |

### 1e. Skill data — do the three named skills exist?

| Ruling option | Skill id | Evidence | Verdict |
|---|---|---|---|
| `Linh Bạo` | `linh_bao` | `data/skill/CoreSkills.ts:67-69` (name 'Linh Bạo'); primordial basic; Lv3 (10000 casts) gates `hidden_spell_pathway` (`core/skill/CastLeveling.ts:17`) | EXISTS |
| `Huy Quyền` | `huy_quyen` | `CoreSkills.ts:118-120` (name 'Huy Quyền'); Lv3 gates `hidden_body_pathway` (`CastLeveling.ts:18`, `core/skill/TheTuPath.ts:51,265`) | EXISTS |
| `Huy Kiếm` | `tram` | `CoreSkills.ts:15-17` — id `tram`, name **'Huy Kiếm'**; Lv3 gates `hidden_sword_pathway` (`core/skill/KiemTuPath.ts:23,234`); `SWORD_BASIC` id 'tram' (`data/skill/TurnBasicAttacks.ts:16-21`) | EXISTS — `huy_kiem` needs NO new enum value; `tram` IS Huy Kiếm |
| Display meta | — | `data/skill/TurnSkillDisplayMeta.ts:48` tram→'Huy Kiếm'; :52 huy_quyen→'Hủy Quyền' (diacritic drift vs CoreSkills 'Huy Quyền' — m4 spec also writes 'Hủy Quyền') | RESOLVED in impl — meta aligned to 'Huy Quyền' (Q-E closed in-pass) |

Conclusion (census item a): all three named skills exist; the ruling's option
set === `MORTAL_PRECURSOR_SKILL_IDS`. No new skill data or enum value.

### 1f. Base stats — what "1/1/1/1/1" means here

`createBaseStats()` (`core/stats/StatBlock.ts:32`) already initializes
`strength/dexterity/intelligence/attunement/vitality = 1` (:62-66 — deliberate
baseline, Phàm Nhân cap headroom per StatCap.ts). The creation `+=` allocation
is the ONLY thing adding on top. Removing it yields exactly the ruled outcome —
no default-value change needed.

The `attributePoints` pool (`Player.ts:197-200`, `CultivationSystem.ts:89-90`
awards on breakthrough, `GameManagerProgressionOps.allocateAttributePoint`
:617-628, `CharacterPanel.vue:294,332` spend UI) is the **progression-time**
mechanic, not creation allocation — UNTOUCHED per ruling scope.

### 1g. Save shape / version sites

| Surface | Evidence | Verdict |
|---|---|---|
| Version | `saveVersion.ts:163` `CURRENT_SAVE_VERSION = 81` + per-version changelog comments :80-162 | BUMP → 82 with v82 changelog entry |
| Rejection | `saveShapeValidation.ts:1653-1656` — `parsed.version !== CURRENT_SAVE_VERSION` rejects | mechanism already in place |
| Shape validation | `saveShapeValidation.ts` — player slice structural checks; `mortalBasicSkillId` shape contract intentionally lives at preflight (:731 comment) | no shape-field change needed (field already exists since v71) |
| Restore preflight | `GameManagerSaveRestore.ts:265-283` | EXTEND: mortal ⇒ pick required + precursor + learned-member (§3 D4) |
| Learned-membership source | `saveTypes.ts:166` `skills: Skill[]` (learned entries persist as `Skill` objects with `id`) | available for the learned check |

Shape-change analysis for the ruling's v82 trigger: the persisted field set
does not change (`mortalBasicSkillId` exists since v71; `baseStats` shape
unchanged — values differ, not shape). The version bump is still REQUIRED: the
contract changes — a v82 mortal save MUST carry the pick, and old saves must be
rejected regardless (ruling: "rejection of old saves is the intended
mechanism"). No migration (QI-S policy).

### 1h. Tests pinning the old flow

| Test | Surface pinned | Required change |
|---|---|---|
| `services/character/CharacterCreationService.test.ts` | `validDraft.attributes` (:4-8), attribute rejection cases (:19-23) | rewrite draft cases → pick validation |
| `components/onboarding/CharacterCreationScreen.test.ts` | 3-step walk + `CHARACTER_CREATION_ATTRIBUTE_POINTS` budget assert | rewrite → unified-screen + skill choice |
| `tests/e2e/helpers.ts:36-65` `createCharacterThroughUi` | step 3 = click each `creation-attribute-plus-*`; stepper nav testids `creation-continue-name`/`creation-confirm-talent` (:41,:48) | REWRITE (INT-A-6) — nav testids die with the stepper; helper drops both continue/confirm clicks + the attribute loop, picks a `creation-skill-*` card, clicks `creation-finish` |
| `tests/e2e/accessibility.spec.ts:55-79` | keyboard flow incl. attribute plus buttons + finish-disabled-until-0-points | rewrite final section for skill choice |
| `tests/e2e/boot-fresh.spec.ts:29` | creation screen visible + asserts `Bước 1 / 3` stepper text | REWRITE (INT-A-5) — stepper counter dies with D5 |
| 17 e2e specs via `createCharacterThroughUi` (create-to-combat, cultivation-path-ritual ×7 calls, turn-combat-hud, save-reload, ink-wash-ui, etc.) | inherit helper change | no per-spec edits unless a spec asserts attributes |
| Sim fixtures `PINNED`/`PINNED_PROFILE` | `EarlyGameSession.test.ts:16`, `MortalChapterJourney.test.ts:19`, `QrProbe.test.ts:6`, `RngLeakProbe.test.ts:6`, `TrucCoJourney.test.ts:118` — all carry `attributes` | add `mortalBasicSkillId`, drop `attributes` |
| `services/save/saveShapeValidation.test.ts:2260-2312` | v71 pick contract ("absent = tram default" :2308); file's own :2260 comment states the shape layer stays pick-agnostic by design | KEEP absent-case as the shape-layer pin (INT-A-9) — the absent→reject flip belongs to restore preflight (boundary.test row in §1c2), not shape validation |
| `services/save/SaveSystem.bootRestore.test.ts:84-86` | invalid pick rejection | keep + add mortal-missing-pick rejection |
| `core/game/GameManagerSaveRestore.boundary.test.ts:1019-1045` | v71 absent=tram default pin | rewrite → v82 describe (4 rejection/accept cases) |
| `core/game/GameManager.theTuAnE2E.test.ts:330` | 'creation-granted tram' title | retitle (wording only) |
| `core/simulation/earlygame/PerfectionEconomy.ts:25,32-35,91-115` + `EssenceSubstitutionEconomy.ts:48-51` | constant import + `attributes` profiles + budget term | reshape per §1c2 |
| `core/game/GameManager.mortalBasicSkill.test.ts` | pick write/read/ritual-clear contract | add creation-path coverage (boot writes the pick) |
| `useAppLifecycle.test.ts:607+` | B2 creation save transaction ordering | unchanged (shape-agnostic stubs) |
| `core/skill/MortalPrecursors.test.ts:16` | precursor set === CAST_LEVELING_THRESHOLDS keys | unchanged — set unchanged |
| `App.wiring.test.ts`, `sessionHandoff.test.ts` | tram seam references | inspect during impl; likely unchanged |

### 1i. Docs referencing the old contract

- `docs/online-login-cloud-save-plan.md:44` ("Phân bổ 5 điểm"), :207, :213 —
- `docs/ui-components.md` — creation screen described as 3-step stepper (INT-A-8)
- `docs/specs/m-f-journey-spec.md:100` — quotes the PINNED `MEASUREMENT_PROFILE`
  verbatim incl. `attributes:{strength:2,vitality:3}` (INT-A-8)
- `docs/superpowers/plans/2026-09-23-early-progression-loop-closure.md:63,210` —
  creation-attributes fixture rules (INT-A-8)
- `docs/p7/ui-inventory.md` — creation UI surface inventory (INT-A-8)
  stale once this lands; update the creation-flow bullets.
- `docs/ui-components.md:839` ("Wizard 3 bước tạo nhân vật"), :841 (stepper
  spec), :871 (stepper mention) — stale once this lands; update to the unified
  screen (sealed-review REV-A-F2 catch).
- `docs/roadmap.md` — no creation-contract section found (only the generic
  "boot → tạo nhân vật → combat E2E" completion note :2640); no roadmap edit
  required, note in the mission report.

## 2. Ruling → contract mapping

| Ruling | Contract |
|---|---|
| Remove 5-point allocation | `CHARACTER_CREATION_ATTRIBUTE_POINTS`, `CharacterAttribute(s)`, `CharacterCreationDraft.attributes`, `validateCharacterCreationDraft` attributes block + `'invalid_attributes'`, the screen's step-3 section, `p_attributes` RPC arg, `baseStats +=` writes — all deleted |
| Auto base stats 1/1/1/1/1 | `createBaseStats()` defaults already are 1/1/1/1/1 — the deletion alone produces the ruled state; nothing new written |
| Starting-skill choice {Linh Bạo, Huy Quyền, Huy Kiếm} | Draft gains `mortalBasicSkillId: 'linh_bao' \| 'huy_quyen' \| 'tram'` — `tram` IS Huy Kiếm; the option set IS `MORTAL_PRECURSOR_SKILL_IDS` |
| One unified flow | `CharacterCreationScreen` becomes a single surface: name input + talent roll/pick + skill cards + finish. No `step` state, no stepper |
| No silent tram | Creation writes the pick through `setMortalBasicSkill` after precursors are learned (§3 D2); v82 preflight rejects mortal saves lacking the pick (§3 D4); `absent→tram` survives only as the corrupt-state defensive resolution |

## 3. Design decisions

**D1 — Draft contract.** `CharacterCreationDraft = {name, talentIds, mortalBasicSkillId}`.
`validateCharacterCreationDraft` gains a pick clause: `mortalBasicSkillId` must
be a member of `MORTAL_PRECURSOR_SKILL_IDS` (draft-level validation is
membership-only — the learned check is impossible pre-boot and meaningless
there; it is enforced by the write op at boot). New error code
`'invalid_skill'` replaces `'invalid_attributes'`. Type stays `string` (not a
narrowed literal) matching the persisted field's type.

**D2 — Pick write ordering (the one real constraint).** The write op
`setMortalBasicSkill` requires `skillManager.has(skillId)` — precursors are
learned inside the boot seam, AFTER `onCharacterCreated`. So:

- `bootstrapEarlyGamePlayer(gameManager, player, basicSkillId)` gains the pick
  parameter: learn `tram`/`linh_bao`/`huy_quyen` (all three — see D9), then
  `progressionOps.setMortalBasicSkill(player, basicSkillId)` and assert
  `true` (post-learn a valid pick cannot fail — false ⇒ data drift, fail fast).
- `App.vue` threads the pick from `onCharacterCreated`'s payload into the
  `onNewCharacter` closure (setup-scope `let pendingCreationPick`),
  then delegates the learn+pick core subset to `bootstrapEarlyGamePlayer` —
  this ALSO fixes the standing P6-M1 drift (the file claims App.vue runs the
  shared seam; it inlines it instead). App-only wiring (buildings, materials,
  production autostart, `setActivePlayer`) stays inline per the seam's
  documented boundary.
- `EarlyGameSession` passes `options.profile.mortalBasicSkillId` through.

`setMortalBasicSkill` remains the ONLY write to `mortalBasicSkillId`
(A3 single-writer preserved: creation pick + in-game repick both route through
it; `applyCreationProfile` never touches the field).

**D3 — `applyCreationProfile` shrinks** to name + talentIds only; the
`attributes` loop and `EarlyGameCreationProfile.attributes` die. `App.vue::
onCharacterCreated` delegates to it (name + talentIds), closing the second
half of the duplication.

**D4 — Save v82.** `CURRENT_SAVE_VERSION` → 82 + changelog entry in the
established style. `preflightSaveRegistryReferences` extends the existing v71
block: `realmId === 'mortal'` ⇒ `mortalBasicSkillId` present AND precursor-valid
AND `save.skills.some(s => s.id === pick)` (learned member — mirrors the write
op's contract; a mortal save without a learned pick is corrupt, fail closed).
Post-path presence stays rejected. v81 saves reject wholesale at the version
check (dev phase, no migration).

**D5 — Unified creation UI.** `CharacterCreationScreen.vue` becomes a single
scroll surface (no `step`, no stepper): name section (existing input +
validation hint), talent section (existing roll + card grid + pick-1),
NEW skill section (three cards, `MORTAL_PRECURSOR_SKILL_IDS` ordered
`tram/linh_bao/huy_quyen` mapped to display name+description from the `SKILLS`
template catalog — the same name authority `GameManager` falls back to;
learned instances can't exist pre-boot so `skillManager` is not consulted),
footer: inline summary + finish. Finish enabled iff name valid ∧ 1 talent ∧
1 skill picked; `finish()` runs the unchanged `validateDraft → createCharacter
→ emit('complete')` chain. i18n: `attributeStep`/`attributes`/`step`/
`stepperAria` keys removed; `skillStep` block added (`kicker`, `title`,
`selected`, `description` — per-skill name/description come from skill data,
NOT i18n keys, matching the talent-card convention which renders
`talent.name`/`description` from data). Footer copy gets named homes at
`onboarding.creation.finish`/`creating`/`errors.rollFailed`/`back` —
`attributeStep.*` (incl. its finish/creating/summary*/rechoose* strings) is
wholesale deleted (INT-A-7). Back button returns to auth from the single screen.

**D6 — Supabase RPC.** `create_character` body: drop `p_attributes`, send
`p_mortal_basic_skill_id`. The RPC lives server-side — deployment ordering is a
real dependency (REV-A-02): the migration drops the OLD overload, so an
un-migrated server rejects the new body AND a migrated server rejects old
clients — client and migration must ship in the same deploy window. Open
Q-D RESOLVED — the function lives in-repo
(`supabase/migrations/202608240001_online_auth_character.sql`); same-window
deploy order required (INT-A-2).

**D7 — Out of scope (explicit).** `attributePoints`/`allocateAttributePoint`/
`CharacterPanel` spend UI (progression-time); `SkillRoleStrip` repick
(remains legal while mortal — the creation pick is the STARTING basic, the
strip stays the mortal repick surface); hidden-gate cast thresholds;
skill data edits; `tram` id (display already correct); talent roll mechanics.

**D8 — Runtime fallback.** `absent → tram` in `createMortalRuntime.resolveBasic`
and the `?? MORTAL_DEFAULT_BASIC_ID` display fallback in `SkillRoleStrip` stay:
they are corrupt-state defensive reads, unreachable on valid v82 saves. Their
comments get a one-line update naming the new contract (mortal saves always
carry the pick since creation writes it).

**D9 — Learn all three (recommended interpretation of ruling 3).** Boot still
learns all three precursors; the choice picks the STARTING basic, not the only
skill. Rationale: the hidden-way offer gates (`linh_bao` Lv3 →
`hidden_spell_pathway`, `huy_quyen` Lv3 → `hidden_body_pathway`, `tram` Lv3 →
`hidden_sword_pathway`) are all mortal-phase grind mechanics — learning only
the picked skill would make two of three hidden ways permanently unreachable,
a product-design change far exceeding the ruling text. Flagged as open
question Q-A for the coordinator to confirm.

## 4. Open questions for coordinator ruling

- **Q-A.** Does "starting-skill choice" mean pick-the-starting-basic while all
  three stay learned (D9 — recommended), or grant ONLY the picked skill
  (pick-dependent hidden gates — a much deeper product change)? If the latter,
  spec amendment needed: gate census, learnSkill gating while mortal, and
  whether the unlearned precursors can ever be acquired later.
- **Q-B.** "A single flow, not sequential separate screens" — spec reads it as
  ONE screen (no stepper). If the intent was "one flow" with steps retained,
  the rework shrinks to: step 3's attribute panel replaced by the skill
  chooser. Recommend the single-screen reading.
- **Q-C.** v82 mortal-required pick: spec makes `mortalBasicSkillId`
  REQUIRED on mortal saves (fail-closed; the ruling's "no silent tram" read as
  contract). Alternative: keep it optional and rely on the runtime default —
  weaker, leaves a silent-tram hole for hand-edited/edge saves.
- **Q-D (RESOLVED — in-repo migration file, INT-A-2).** `create_character` RPC param change (`p_attributes` → pick param):
  who owns the Supabase function, and does it need a deploy-order dance? The
  client diff is written either way; this only gates the cloud path.
- **Q-E.** `huy_quyen` display name drift: `CoreSkills` 'Huy Quyền' (ruling's
  spelling, what learned-skill UI shows) vs `TurnSkillDisplayMeta` 'Hủy Quyền'
  (turn-skill display meta) — fix the meta to 'Huy Quyền' in this pass (tiny),
  or file as Notes/Suggestions?

## 5. G1 evidence summary (Q1-Q12 + triggered modules — recorded at spec phase)

- Q1: observable behavior — new character: base stats exactly 1/1/1/1/1 (STR
  etc.), `mortalBasicSkillId` = the picked precursor, learned set = all three
  precursors, first save carries the pick; invalid pick ⇒ `invalid_skill`
  pre-create; a mortal v82 save missing the pick ⇒ restore rejection.
- Q2: pick write owner = `progressionOps.setMortalBasicSkill` (only writer);
  stats owner = `createBaseStats` defaults; draft validation owner =
  `characterCreationService.validateDraft`.
- Q3: `mortalBasicSkillId` — written at creation (via op, post-learn) and by
  the strip repick (same op); cleared by ritual commit; persisted on
  PlayerData; preflight-guarded.
- Q4: production chain — `CharacterCreationScreen → complete payload →
  App.vue::onCharacterCreated → bootGame(true) → onNewCharacter →
  bootstrapEarlyGamePlayer → learnSkill×3 + setMortalBasicSkill → first save`.
- Q5: existing primitives reused — `MORTAL_PRECURSOR_SKILL_IDS`,
  `isMortalPrecursorSkillId`, `setMortalBasicSkill`, `SKILLS` catalog,
  `createBaseStats`, `EarlyGameBootstrap` seams. No new abstraction.
- Q6: deps — service layer → core/skill leaf module (MortalPrecursors imports
  nothing); screen → service + data catalog; bootstrap → GameManager ops.
  No upward imports added (core never imports services — existing seam rule).
- Q7: N/A — no timing/presentation-authority change (creation commits before
  the tick loop starts; unchanged).
- Q8: consumers preserve semantics — pick resolution chain unchanged; display
  meta from the same catalog elsewhere reads.
- Q9: `validateDraft`/`checkNameAvailable`/`rollTalents` stay observational;
  the pick write happens once inside the boot transaction.
- Q10: duplicate/stale — `newCharacterGrantsApplied` boot guard unchanged: a
  second `bootGame(true)` does NOT re-run `onNewCharacter` (the guard
  hard-resets and returns 'skipped'), so the pick write cannot double-run;
  the module-slot pick is still consumed once as a defensive invariant
  (sealed-review REV-A-F3 correction).
- Q11: old paths retired — allocation UI/service/validation/RPC arg deleted;
  `absent→tram` classified defensive-only (retained, documented reason);
  `onRestoreOk` learn seam retained (in-flight/corrupt guard, zero cost).
- Q12: scope bound by the ruling; census surfaces above enumerate every edit.

Triggered modules: **S** (save-shape contract change → S2/S3/S6 apply to the
preflight + version bump; recorded PLANNED), **U** (screen rework → U1/U5;
P14 triggered — creation screen is boot-critical UI), **L** (L3 — creation
writes land inside the real boot transaction; P13 e2e evidence via
`boot-fresh`/`create-to-combat`), **C** lightly (pick feeds mortal
`resolveBasic` — no combat-rule change; the path-runtime contract is already
covered by P7-M4 tests). E module N/A (no economy/balance surface).

## 6. Verification plan (planned gates — executed post-release)

- P3 quick: `npm run type-check` + `npx vitest run` scoped to
  `services/character`, `components/onboarding`, `core/game/GameManager.mortalBasicSkill`,
  `services/save`, `core/simulation/earlygame`, `composables/useAppLifecycle`,
  `tests/architecture/i18nKeyParity`.
- P13/P14 (triggered — boot wiring + creation UI): Playwright e2e
  `boot-fresh`, `create-to-combat`, `accessibility` (rewritten), plus one
  visual pass over the unified screen in the worktree.
- P18 OCR on the task diff; P4 adversarial (quick); P5 ≥3 sequential passes.
- Save bump ⇒ version-rejection e2e sanity via existing save-version tests.
