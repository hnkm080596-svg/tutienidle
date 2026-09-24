# BETA-CREATION — Creation rework: drop 5-point allocation, add starting-skill pick — Plan

Spec: `game/docs/specs/beta-creation-spec.md` (v1 — pending coordinator
spec/plan review; this file is the implementation contract once released).
Base: `origin/beta/rc` @ `6d9af7a9` (save v81). Target save version: **82**.
Branch: `devin/1790189100-beta-creation` (docs committed pre-release).

Scope limits per spec D7: progression-time `attributePoints` mechanic,
`SkillRoleStrip` repick, cast-leveling gates, skill data, `tram` id, and talent
roll mechanics are all UNTOUCHED.

## Step 0 — seam census (done during spec)

Full evidence tables in spec §1. Condensed edit map:

- `services/character/CharacterCreationService.ts` — contract reshape.
- `services/character/MockCharacterCreationService.ts` — type follows.
- `services/character/SupabaseCharacterCreationService.ts` — RPC body params.
- `components/onboarding/CharacterCreationScreen.vue` — single-screen rework.
- `src/locales/vi.json` + `en.json` — `onboarding.creation` key reshape.
- `core/game/EarlyGameBootstrap.ts` — profile + bootstrap signatures.
- `App.vue` — delegate to the shared seams; thread the pick.
- `core/simulation/earlygame/EarlyGameSession.ts` — profile shape follows.
- `core/player/Player.ts` — comment update on `mortalBasicSkillId` only.
- `services/save/saveVersion.ts` — 81 → 82 + changelog.
- `core/game/GameManagerSaveRestore.ts` — v82 preflight extension.
- `core/player/CultivationPathRegistry.ts` + `SkillRoleStrip.vue` —
  defensive-fallback comments only (optional micro-touch).
- `core/simulation/earlygame/PerfectionEconomy.ts` — constant import +
  `MEASUREMENT_PROFILE` + `mortalStatBudget()` `creationPoints` term (spec §1c2).
- `core/simulation/earlygame/EssenceSubstitutionEconomy.ts` —
  `MEASUREMENT_PROFILE` literal.
- Tests: listed in spec §1h (incl. the boundary-test v82 describe + the
  `theTuAnE2E` title retitle added by spec/plan review).
- Docs: `docs/online-login-cloud-save-plan.md` + `docs/ui-components.md`
  creation-flow bullets (REV-A-F2 catch).

## Step 1 — service contract reshape

`CharacterCreationService.ts`:

```ts
export type MortalBasicSkillChoice = 'tram' | 'linh_bao' | 'huy_quyen'
// or reuse the persisted field type — decision: string-typed field, validated
// against MORTAL_PRECURSOR_SKILL_IDS membership (spec D1)

export interface CharacterCreationDraft {
  name: string
  talentIds: string[]
  mortalBasicSkillId: string
}
```

- Delete `CHARACTER_CREATION_ATTRIBUTE_POINTS`, `CharacterAttribute`,
  `CharacterAttributes`, the attributes block in
  `validateCharacterCreationDraft`, and `'invalid_attributes'` — add
  `'invalid_skill'` ("Phải chọn một khởi thủy chiêu thức." or similar per i18n
  convention of the file — service messages are Vietnamese literals here).
- `CharacterCreationService` interface otherwise unchanged.
- `MockCharacterCreationService` — no logic change (draft passthrough).
- `SupabaseCharacterCreationService.createCharacter` — RPC body:
  `p_attributes` out, `p_mortal_basic_skill_id: draft.mortalBasicSkillId` in.
  DEPLOY ORDER (REV-A-02): the migration drops the old overload, so it must be
  applied in the same deploy window as the client — an un-migrated server
  rejects the new body and a migrated server rejects old clients. Q-D tracks
  who applies it.

## Step 2 — bootstrap seam + App.vue wiring

`core/game/EarlyGameBootstrap.ts`:

- `EarlyGameCreationProfile = {name, talentIds, mortalBasicSkillId}`.
- `applyCreationProfile`: name + talentIds only (delete the stats loop).
- `bootstrapEarlyGamePlayer(gameManager, player, basicSkillId: string)`:
  learn `tram`/`linh_bao`/`huy_quyen` (existing order), then
  `progressionOps.setMortalBasicSkill(player, basicSkillId)`; assert the
  return is `true` — post-learn a valid pick cannot fail (drift ⇒ throw).

`App.vue`:

- `onCharacterCreated(payload)`: `applyCreationProfile(player.$state, payload)`
  replacing the inline writes; store `payload.mortalBasicSkillId` in a
  setup-scope `let pendingCreationPick: string | undefined` (survives the
  boot retry path — `newCharacterGrantsApplied` semantics unchanged).
- `onNewCharacter`: replace the three inline `learnSkill` calls with
  `bootstrapEarlyGamePlayer(gameManager, player.$state, pendingCreationPick)`;
  a missing pending value ⇒ fail fast (defensive — the screen always emits
  one). App-only wiring (buildings, materials, production autostart,
  `setActivePlayer`) stays inline unchanged.
- `CharacterCreationPayload` import follows the reshaped emit payload.

`EarlyGameSession.ts`: `options.profile.mortalBasicSkillId` passes into the
bootstrap call.

`Player.ts` — update the `mortalBasicSkillId` comment to name the creation
write path (creation pick via the op inside bootstrap; strip repick).

## Step 3 — unified creation screen + i18n

`CharacterCreationScreen.vue`:

- Remove `step`, stepper markup/styles, the attribute section +
  `changeAttribute`/`pointsSpent`/`pointsLeft`/`attributeLabels`/`attributes`
  state.
- Emit payload `{name, talentIds, mortalBasicSkillId}`.
- Single scroll surface: name block → talent block (unchanged mechanics) →
  skill block: three cards iterating `MORTAL_PRECURSOR_SKILL_IDS`, display
  name + description resolved from the `SKILLS` catalog
  (`data/skill/Skills.ts`) — testids `creation-skill-<id>`. Footer: finish
  button (`creation-finish`, disabled until name valid ∧ 1 talent ∧ 1 skill)
  + back → `emit('back')`.
- Vietnamese section copy via new `onboarding.creation.skillStep` keys
  (`kicker`, `title`, `selected`, `description`); remove `step`/`stepperAria`/`attributeStep`/
  `attributes` keys in BOTH `vi.json` and `en.json` (i18n parity test pins
  key-set equality).

## Step 4 — save v82

- `saveVersion.ts`: `CURRENT_SAVE_VERSION = 82` + changelog entry matching the
  established per-version comment style ("v82 (BETA-CREATION ...): creation
  drop of the 5-point allocation; `mortalBasicSkillId` required on mortal
  saves — the starting-skill pick is now an explicit creation write. Save v81
  is rejected (dev phase, no migration, no compat translator)").
- `GameManagerSaveRestore.ts` preflight (the v71 block :265-283): extend to
  reject a mortal save where the pick is absent, non-precursor, or not in
  `save.skills` ids. Post-path presence rule unchanged.

## Step 5 — tests

New/updated pins (spec §1h inventory):

- `CharacterCreationService.test.ts` — valid draft w/ pick; reject bad pick
  (non-member, empty), forged talent unchanged; attributes cases deleted.
- `CharacterCreationScreen.test.ts` — unified-screen walk; finish gating on
  the pick; emitted payload carries `mortalBasicSkillId`.
- New coverage in `GameManager.mortalBasicSkill.test.ts` (or a bootstrap
  test): `bootstrapEarlyGamePlayer(gm, player, 'linh_bao')` ⇒ learned all
  three + `player.mortalBasicSkillId === 'linh_bao'`; base stats remain
  exactly 1/1/1/1/1 (pins ruling 2 — red before the App.vue delegation lands
  if TDD'd).
- `saveShapeValidation.test.ts` / `SaveSystem.bootRestore.test.ts` — v82
  cases: mortal+absent pick rejected, mortal+non-precursor rejected,
  mortal+pick-not-learned rejected, mortal+valid learned pick accepted,
  post-path pick still rejected; `absent→tram` pin at :2309 rewritten.
- Sim PINNED fixtures ×5 — `attributes` → `mortalBasicSkillId` (values pinned,
  e.g. 'tram' where the suite already exercises the default).
- `tests/e2e/helpers.ts` `createCharacterThroughUi` — step 3 clicks a
  `creation-skill-*` card instead of attribute pluses.
- `tests/e2e/accessibility.spec.ts` — keyboard path updated (finish enabled
  after a skill pick; no points-budget gate).
- `docs/online-login-cloud-save-plan.md` — replace the allocation bullets
  (:44, :207, :213) with the unified name+talent+skill flow.

## Step 6 — gates (post-implementation, in order)

1. `code-simplifier` (E3) on the diff.
2. P3 quick: `npm run type-check` + scoped vitest (spec §6 list). Escalate to
   full `npm run verify` if the diff touches Pinia root state or wiring
   beyond forecast.
3. P18 OCR delegation on the task diff.
4. P13/P14 (triggered — `App.vue` boot seam + creation UI): run
   `boot-fresh`, `create-to-combat`, `accessibility` e2e + one visual pass of
   the unified screen from the worktree dev server.
5. P4 `tutienidle-adversarial-qa` (quick).
6. P5 sequential passes (≥3) with per-pass evidence blocks.

## Step 7 — handoff

Open PR against `beta/rc`; report: spec/plan paths, files changed, gate
evidence, open questions (Q-A..Q-E status), then park for coordinator
impl-run.
