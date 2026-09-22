# M-H — Terminology sweep (spec v6)

Mission graph row: **M-H — Terminology sweep** — "residual naming cleanup." Depends on: all prior P7 missions (merged through M-G `ae57e931`).

v2: external review round `mh-r1` found 5 defects — missed importer, live `techniqueInsight` i18n residual, incomplete loadout-comment census, `equipped`-for-technique comments outside skill-path UI, self-contradicting `TechniqueTier` row. v3: round `mh-r2` — display values reverted to canonical KEEP; four `techniqueInsight` comments added; uppercase `Element Loadout` + case-insensitive census. v4: round `mh-r3` — deterministic three-bucket census; round `mh-r4` — `GameManagerSaveRestore` stale-skill-surface comment, `FoundationEnemies` `insight` local, `tierEffects`→`gradeEffects` stale comment, Bucket D widened. v5: round `mh-r5` — two already-history comments wrongly flagged as stale (`CombatSkillPresentation.ts:10`, `ArtifactRuntime.ts:17`) moved to Bucket B; retired-`equipped` sentinels/history explicitly classified so oracle 5 is closed.

## 1. Scope

The P7 phase retired generic loadout semantics (D3), removed `tu_linh_quyet` (locked), renamed technique-insight → `mastery` (D1), migrated path/way identities to English (D6), and repurposed `TechniqueTier` as rank-band vocabulary (M3 §81). M-H is the **residual naming cleanup**: sweep every identifier/comment/i18n key that still leaks a retired concept. **No gameplay, persisted-shape, or content-id changes.**

Non-goals: no mass VN→EN content-id translation (N2 keeps leaf content ids); no `breakthroughGrade` field rename (CANONICAL, M4-class persisted-field scope); no `TechniqueTier` removal (M3 explicitly kept it); no CSS/design changes beyond rename-synchronized class names; no save migration.

## 2. Evidence (G0 census — verified on `master` @ `695ca34b`, re-verified after external review)

### 2.1 Retired-concept residuals (RENAME/REWORD targets)

| Residual | Location | Evidence |
|---|---|---|
| `useLoadoutActions` composable | `src/composables/useLoadoutActions.ts` + **4 importers**: `CharacterPanel.vue:17`, `NodeInspector.vue:11`, `NodeTreePanel.vue:29`, `SkillLoadoutStrip.vue:17,25` | Exports generic progression actions (`allocateAttributePoint`, `purchaseNode`, `upgradeNode`, `selectSpellPathElement`, `switchSpellPathRoute`, `selectSkillSpecialization`, `setMortalBasicSkill`). Loadout wrappers were already deleted — only the name is residual. |
| `SkillLoadoutStrip` component | `src/components/panels/skill-path/SkillLoadoutStrip.vue` + `SkillPathPanel.vue:28,253` | M4 repurposed it into the resolved-role display ("Pháp Thuật Đang Vận Hành" / "Active Spell Arts") reading `getResolvedSkillRoles` (Basic/Special/Ultimate). Component name + CSS `skill-loadout-strip`, `loadout-specializations*` name the retired slot-loadout concept. |
| `TechniqueSlotCard` `equipped` local + `loadout-card*` CSS | `src/components/panels/skill-path/TechniqueSlotCard.vue` + `TechniqueBand.vue:82` + `InkWashMediumSurfaces.test.ts:29` | `equipped` computed holds the way-owned technique — no equip choice exists post-M3. `equippedTechnique` in `TechniqueBand.vue` same leak. |
| i18n key `panels.skillPath.colTitles.loadoutActive` | `en.json:132`, `vi.json:132`, `SkillPathPanel.vue:251` | Display values already correct ("Active Spell Arts"); key name is the residual. |
| i18n key `combat.rewards.techniqueInsight` | `en.json:720`, `vi.json:720`, `RewardList.vue:16` | **Renders `summary.techniqueMastery`** — key leaks the retired domain identifier. Display values ("Cảm Ngộ Tâm Pháp" / "Technique Insight") are **canonical KEEP** per `terminology.md:20` (Cảm Ngộ is the approved technique-side display term; M3 deliberately kept zero locale diff). |
| `techniqueInsight` historical comments | `Technique.ts:9`, `Reward.ts:3`, `Player.ts:584`, `Enemy.ts:34` | "renamed techniqueInsight reward channel" / `addTechniqueInsight` rename notes — still name the retired channel; reword to current `techniqueMastery` ownership. |
| Stale `loadout`-semantics comments | `SkillPathPanel.vue:11,16`; `QuanKhiPanel.vue:76`; `App.vue:752`; **`CoreSkills.ts:332-335,392-394,459-463,528-530,593-595`; `PhapTuChainSkills.ts:825`; `Skill.ts:142`; `BalanceBaselines.ts:84`; `CharacterPanel.vue:57` ("Element Loadout"); `theme.css:6` (redesign-history "Character/Loadout/Bag" token list); `Companions.ts:3`; `SkillPathPanel.vue:151`** | Comments still assert dead slot/scheduler semantics ("CHIẾM 1 slot Loadout bình thường", "không vào loadout scheduler", "learned into the loadout", "đa hệ qua Element Loadout" — current authority is `player.spellPath.element`). `CombatSkillPresentation.ts:10` and `ArtifactRuntime.ts:17` were dropped from this list — both are already accurate retirement history (Bucket B). |
| `equipped`-for-technique/passive comments | `GameManagerPersistentEffectOps.ts:29,52,92,103`; `BattleSimulation.ts:35` | Say "equipped Technique + equipped passive Skills", "only while equipped". M3 removed technique `equipped` entirely (owner is `techniqueManager.getActive()`); `SkillSystem.ts:219-225` states learned passives are always active — "equipped passive" is stale too. |

### 2.2 Verified KEEP list (audited, NOT residuals)

| Item | Why it stays |
|---|---|
| `tu_linh_quyet` mentions (5 comments + negative drop assertion `resolveDrops.gating.qa.test.ts:53`) | Intentional retirement evidence — assertion pins the id can never resolve. |
| `TuLinhTranBalance` (Tụ Linh Trận) | Unrelated formation economy — the documented F8 near-miss. |
| `artifactInsight` (reward field + `combat.rewards.artifactInsight` key) | Artifact-domain; D1 collision fix scoped to technique-side only. |
| `skillInsight` (pool + `combat.rewards.skillInsight` key + node `insight` i18n) | Canonical node/skill-upgrade currency. |
| `TechniqueTier` + `getTechniqueTierForRank`/`getTechniqueTierModifiers` | M3 §81: kept, re-purposed as rank-band vocabulary. The insight **arithmetic/module** retired; the four-value tier vocabulary lives (`Technique.ts:13`, `TechniqueProgression.ts:24`). |
| `formationLoadout`/`FormationLoadout`/`commitFormationLoadout`/`TranPhapPanel` locals | Live formation system, canonical in its domain. |
| `breakthroughGrade` (persisted field) | CANONICAL; `initiationGrade` was only a candidate. Persisted-field rename is M4-class scope — and the collision with technique Grade is display-side only, field is owner-scoped `player.breakthroughGrade`. |
| `RETIRED_SKILL_ENTRY_KEYS` (`saveShapeValidation.ts:731`) | Intentional rejection list for retired persisted fields. |
| VN-pinyin leaf content ids (`ung_the`, `ngo_dao_*`, skills/materials/zones) | N2-canonical content flavor. |
| `equipped` in equipment/artifact domains (`instance.equipped`, slot markers, `tribulation.stillEquipped`, Tooltip compare) | Owner-local equipment meaning — D3 resolution: `equipped` keeps owner-local meaning outside the retired skill loadout. (`equippedElements` is NOT in this class — it's the retired Pháp Tu element-selection field; its 3 mentions are Bucket-B history.) |

### 2.3 Deterministic residual census — every surviving `loadout`/`equipped` production hit is in exactly one bucket

**Bucket B — KEEP: retirement-history comments + rejection sentinels** (accurate "was removed/rejected" wording; NOT stale semantics):
`SkillPathPanel.vue:2,5,14` (extraction/deletion history) · `StageSelectPanel.vue:35` · `TechniqueSlotCard.vue:2` (provenance from deleted `LoadoutManager.vue`) · `CombatSkillPresentation.ts:10,121` ("đã bị thay"/"đã retire") · `GameManagerProgressionOps.ts:414` ("the retired getLoadoutSkills…") · `GameManagerRealmAdvanceOps.ts:229` ("not a generic slot loadout") · `SkillSystem.ts:296-297` ("the retired unlocked/equipped/loadout flags") · `TechniqueManager.ts:5` ("is gone") · `ArtifactRuntime.ts:17` ("the equippedElements loadout authority **was retired** in Task 14" — already history) · `SaveSystem.ts:64-65` (ElementLoadout/`equippedElements` retirement note) · `saveVersion.ts:42,83,88-89` (`unlockedElements`/`equippedElements`/`tierEffects`/`equipped` removal history) · `stores/ui.ts:27,150-151` ("đã GỠ"/"da xoa") · `saveShapeValidation.ts:727,731` (`RETIRED_SKILL_ENTRY_KEYS` rejection sentinel — live code that *rejects* retired fields, includes `'equipped'` literal by design).

**Bucket C — KEEP: formation-domain + false positives:**
`FormationPlacement.ts` (all hits — live `FormationLoadout` system) · `CombatBuild.ts:302-303` · `Player.ts:304,318,427` (`formationLoadout` field/type) · `GameManagerTurnBattleOps.ts:83,85,953-959` · `TranPhap.ts:7` · `CompanionCombat.ts:30` · `BattleLootSystem.ts:360` (formation-assignment dedup comment) · `saveShapeValidation.ts:560-574` (formationLoadout validation) · `saveVersion.ts:28-29` (formationLoadout history) · `TranPhapPanel.vue` + `TranPhapPanel.test.ts` (formation UI locals) · `CloudSaveService.ts:1,12` + `SaveSystem.ts:410,503` (`LoadOutcome`/`loadGame` — substring false positives) · all `*.test.ts` (historical evidence, excluded by grep).

**Bucket D — KEEP: equipment/artifact `equipped` (category rule, not an enumerated list):** every `equipped` hit whose referent is an **equipment/gear/artifact instance, bag slot, slot marker, or equipment-domain UI** — including but not limited to `bag-sections/`, `equipment-hall/`, `common/SlotTypes.ts`, `common/SlotView.vue`, `common/Tooltip.vue`, `common/BreakthroughRequirementPanel.vue` (`tribulation.stillEquipped`), `BagCell.ts`, `useEquippedRows.ts`, `EquipmentOpsSystem.ts`, `EquipmentSystem`, `equipmentBag`, `presentation/createGamePresentation.ts:111`, `presentation/ActionAvailability.ts:46`, `EarlyGameSession.ts:366-379`, `EarlyGameLoop.ts:159,165`, locale equipment keys (`panels.bag.tooltip.compare.equipped`, `tribulation.stillEquipped.*`), and `instance.equipped`. **`equippedElements` is NOT Bucket D** — it's the retired Pháp Tu element-selection field; its 3 production mentions (`ArtifactRuntime.ts:17`, `SaveSystem.ts:64-65`, `saveVersion.ts:42`) are Bucket-B retirement history only. Equipment `equipped` is a live owner-local concept — the D3 KEEP.

**Bucket A — REWORD targets** = everything else in §3.5 below.

## 3. Changes

### 3.1 `useLoadoutActions` → `useProgressionActions`

- `git mv src/composables/useLoadoutActions.ts → src/composables/useProgressionActions.ts`; rename export; fix file-header comment.
- Update **all 4 importers**: `CharacterPanel.vue`, `NodeInspector.vue`, `NodeTreePanel.vue`, and `SkillRoleStrip.vue` (the renamed `SkillLoadoutStrip` — see 3.2).

### 3.2 `SkillLoadoutStrip` → `SkillRoleStrip`

- `git mv …/SkillLoadoutStrip.vue → …/SkillRoleStrip.vue`; rename component + `SkillPathPanel.vue` import/usage; update its internal `useLoadoutActions` import per 3.1.
- CSS: `.skill-loadout-strip`→`.skill-role-strip`; `.loadout-specializations*`→`.role-specializations*` (scoped, file-local).
- Header comment reword to resolved-role display.
- Vocabulary: `SkillRoleStrip` — the surface displays Basic/Special/Ultimate roles resolved via `getResolvedSkillRoles`; "role" names what it IS (external review's domain-first choice). `ActiveSkillStrip` rejected — "active" describes state, not the role axis; `ResolvedSkillStrip` leaks implementation terminology.

### 3.3 `equipped`→way-owned vocabulary in skill-path UI

- `TechniqueSlotCard.vue`: `equipped` computed → `technique`; all template/script refs; CSS `.loadout-card*`→`.technique-card*`.
- `TechniqueBand.vue`: `equippedTechnique` → `currentTechnique`.

### 3.4 i18n key renames

- `panels.skillPath.colTitles.loadoutActive` → `activeArts` (en+vi keys, values unchanged) + `SkillPathPanel.vue` usage.
- `combat.rewards.techniqueInsight` → `combat.rewards.techniqueMastery`: key in en.json+vi.json + `RewardList.vue:16`. **Display values unchanged** — `terminology.md:20` canonically keeps "Cảm Ngộ" as the technique-side display term (M3 kept the key with zero locale diff intentionally). M-H cleans mechanic-adjacent **identifiers**; display-term changes are a product decision owned by the terminology ledger — the residual display/field gap ("Technique Insight" label on a mastery field) is recorded in terminology.md §3.6 note as a deferred product question, not silently changed here.

### 3.5 Comment rewording — Bucket A (no code change)

*Retired loadout semantics asserted as current:*
- `SkillPathPanel.vue:11,16` (describes the retired 5-slot equip model as live) and `:151` ("không phụ thuộc loadout/path") → resolved-role / learned-skill wording.
- `QuanKhiPanel.vue:76` "loadout skillIds" → resolved skill-kit wording.
- `App.vue:752` "tab loadout" → the actual tab name.
- `Companions.ts:3` "node-tree/loadout" → node-tree/roles wording (companions never had a loadout).
- `CoreSkills.ts:332-335,392-394,459-463,528-530,593-595` "CHIẾM 1 slot Loadout bình thường" → basic-role wording.
- `PhapTuChainSkills.ts:825` "không vào loadout scheduler" → role-execution wording.
- `Skill.ts:142` "KHÔNG thuộc loadout scheduler" → role-execution wording.
- `BalanceBaselines.ts:84` "learned into the loadout" → learned-into-roles wording.
- `CharacterPanel.vue:57` "đa hệ qua Element Loadout" → `player.spellPath.element` authority wording.
- `theme.css:6` redesign token list "Character/Loadout/Bag" → "Character/SkillPath/Bag".

*Retired `equipped` model asserted as current (root/base skill vocabulary):*
- `GameManagerPersistentEffectOps.ts:29,52,92,103` "equipped Technique/equipped passive Skills/only while equipped" → "way-owned (active) Technique + learned passive Skills".
- `BattleSimulation.ts:35` — same tightening.
- `TurnSkillAction.ts:211,392,399-400` "equipped skill/ult/chain-E skill" → root-skill vocabulary (the ROOT identity that owns cast count/cooldown — the domain already calls it `rootSkillId`).
- `TurnBattleSystem.ts:1793` "stays the equipped skill" → "stays the root skill".
- `SkillResolver.ts:276-278` "the equipped base/lane" → "the root base/lane".
- `PhapTuEmpoweredUlts.ts:15` "the equipped chain-E slot's cooldown" → "the root chain-E slot's cooldown".
- `CultivationPathRegistry.ts:160` "the equipped chain-E ultimate" → "the root chain-E ultimate".

*Retired `techniqueInsight`/`insight` naming:*
- `Technique.ts:9`, `Reward.ts:3`, `Player.ts:584`, `Enemy.ts:34` → current `techniqueMastery` ownership wording.
- `FoundationEnemies.ts:136` — local `const insight = 40 + 6 * params.t` assigned to `techniqueMastery: insight` → rename local to `techniqueMastery`/`mastery` (the reward channel's own name). The :130-133 comment ("Leaving insight/stone here would smuggle the old coefficients") is multiplier-removal history — KEEP.

*Stale live-property / skill-surface comments:*
- `GameManagerSaveRestore.ts:307-315` — comment says preserved progression state is "(level/equipped/slot/cooldown/specialization)" — `equipped`/`slot` are retired (v71 rejects them) → reword to the actual preserved state (level/cooldown/specialization per current `Skill` shape).
- `GameManagerPersistentEffectOps.ts:235-237` — "applied to EVERY technique declaring tierEffects" → `gradeEffects` (the live `gradeEffects[grade][tierBand]` property; other `tierEffects` mentions are labeled retirement history and KEEP).

### 3.6 Documentation sync

- `docs/p7/terminology.md` — **fix the self-contradicting row inline**: the `tier` row (line ~48) currently says "TechniqueTier … is RETIRED with the insight model" while M3 §81 kept it; reword to: the insight-progression arithmetic retired; `TechniqueTier` survives as rank-band vocabulary (`so_nhap|tieu_thanh|dai_thanh|vien_man`).
- Append a "Post-sweep residuals (M-H)" note recording the KEEP list with reasons (prevents the next sweep re-litigating `TuLinhTranBalance`, `artifactInsight`, `skillInsight`, `TechniqueTier`, `formationLoadout`, `breakthroughGrade`) — including the deferred display question: `combat.rewards.techniqueMastery` displays "Technique Insight"/"Cảm Ngộ Tâm Pháp" while `skillInsight` displays "Skill Insight"/"Cảm Ngộ Kỹ Năng" — a same-display-word-for-two-domain-pools question owned by the product/terminology ledger, deliberately not changed by M-H.

## 4. Tests / verification

- `npm run type-check` is the primary gate (all renames type-safe).
- `npx vitest run src/components/panels src/components/common` + any file matching the rename greps.
- Regression pins: `TechniqueBand.test.ts`, `InkWashMediumSurfaces.test.ts`, `RewardList`-adjacent tests green unchanged (behavior + rendered text identical — display values are NOT changed).
- Acceptance oracle — **deterministic**, no judgment calls:
  1. `grep -rniE "useLoadoutActions|SkillLoadoutStrip|loadoutActive|techniqueInsight|loadout-card|loadout-specializations|skill-loadout-strip" src/` → **0 hits** (excluding spec/plan docs).
  2. `grep -rni "loadout" src/ --include='*.ts' --include='*.vue' --include='*.css' | grep -v '\.test\.ts'` → every surviving line must come from the explicit **Bucket B + Bucket C lists in §2.3** (enumerated file:line entries). Any hit outside those lists is a miss.
  3. `grep -rni "equipped" src/components/panels/skill-path/` → **0 hits**.
  4. `grep -rniE "equipped (skill|ult|technique|chain)|equipped-technique|equipped passive" src/` → **0 hits** outside `*.test.ts` and the Bucket-B history lines (which say the flags are *retired*).
  5. Broad `equipped` oracle: `grep -rni "equipped" src/ --include='*.ts' --include='*.vue' | grep -v '\.test\.ts'` → every surviving hit must be either (a) a **Bucket-D** equipment/artifact hit (referent = gear/bag/slot instance) or (b) a **Bucket-B** retirement-history line / rejection sentinel (including `RETIRED_SKILL_ENTRY_KEYS`'s `'equipped'` literal and the retired-`equippedElements` history comments). Any `equipped` whose referent is a live skill, technique, passive, or chain-E slot concept is a miss.

## 5. Risks / notes

- Near-miss whitelist is load-bearing: `formationLoadout`/`FormationLoadout`/`commitFormationLoadout`/`TranPhapPanel` are the LIVE formation system — never touched. `artifactInsight`, `TuLinhTranBalance`, `skillInsight`, `TechniqueTier`, `breakthroughGrade`, `RETIRED_SKILL_ENTRY_KEYS` all KEEP.
- `combat.rewards.techniqueInsight`→`techniqueMastery` renames the key ONLY — display values stay canonically-approved "Cảm Ngộ"/"Insight" per `terminology.md:20`; the display-vs-field mismatch is logged in the ledger as a deferred product question.
- CSS renames are scoped file-local; verified no test selects `.skill-loadout-strip`/`.loadout-card*` classes.
- No persisted fields, no ids, no gameplay numbers — nothing reaches saves or balance.
