# P7-M1 — English Identity-Spine Cut (spec)

Status: `DRAFT` → ChatGPT review until PASS → plan → implement → review → commit.

Mission of the P7 Progression Consolidation phase. Locked decisions: `game/docs/p7/decisions.md` (D6, D13 govern this mission). Census: `game/docs/p7/system-inventory.md`, `game/docs/p7/naming-migration.md`.

## 1. Scope

Migrate the canonical **path/way identity spine** to semantic English — the values, types, persisted fields, and identity-facing API names the engine branches on — as ONE atomic cut. Nothing about gameplay behavior changes: every renamed value keeps identical semantics, gates, and flow. This is a pure identity migration.

| Current | New |
|---|---|
| `CultivationPathId = 'kiem_tu' \| 'phap_tu' \| 'the_tu'` | `CultivationPathId = 'sword' \| 'spell' \| 'body'` |
| `PathWayId = string` (open, path-scoped) | `CultivationWayId = 'sword_pathway' \| 'hidden_sword_pathway' \| 'spell_pathway' \| 'hidden_spell_pathway' \| 'body_pathway' \| 'hidden_body_pathway'` (strict union) |

Way-value mapping (the `(path, way)` pair stays the atomic identity; `hidden_*` = the ẩn-family way of that path):

| Path | Old way | New way |
|---|---|---|
| kiem_tu → sword | `hien` | `sword_pathway` |
| kiem_tu → sword | `ngu` | `hidden_sword_pathway` |
| phap_tu → spell | `ngu_hanh` | `spell_pathway` |
| phap_tu → spell | `ngo_dao` | `hidden_spell_pathway` |
| the_tu → body | `hien` | `body_pathway` |
| the_tu → body | `ung_the` | `hidden_body_pathway` |

Note the current union shares `hien` between kiem_tu and the_tu; the new values make each way globally unambiguous while the pair remains the identity.

**Pinned contract for `ways` (review HIGH-1).** `CultivationPathModule.ways` must NOT become `Record<CultivationWayId, PathWayDefinition>` — that would force every module to define all six ways. Replacement contract:

```ts
type SwordWayId = 'sword_pathway' | 'hidden_sword_pathway'
type SpellWayId = 'spell_pathway' | 'hidden_spell_pathway'
type BodyWayId  = 'body_pathway' | 'hidden_body_pathway'
type CultivationWayId = SwordWayId | SpellWayId | BodyWayId
```

Each module declares its own way-keyed record (`ways: Record<SpellWayId, PathWayDefinition>` inside the spell module, etc.). `CultivationPathModule.ways` is typed as the union of those per-path records, so `module.ways[wayId]` resolves correctly while ownership stays per-path. A catalog completeness guard (contract test) asserts: each module's way keys ⊆ its path's way-id set, and all six union members are covered across the catalog. Fallback if per-path generics prove awkward: `Partial<Record<CultivationWayId, PathWayDefinition>>` + the same guard — the guard is required either way.

## 2. Authority being migrated

The `(cultivationPath, cultivationWay)` pair — resolved by `CultivationPathSystem.applyPathChoice`/`getActiveWayDefinition` through `CULTIVATION_PATH_MODULES` — is already the single identity authority. This mission changes its **vocabulary**, not its ownership.

## 3. Locked decisions governing this mission

- **D6**: spine English, leaves VN. Direct identity cut — no legacy persisted-value compatibility layer (save rejection applies). Leaf content ids (`kiem_pho`, `ngu_kiem`, `ngu_hanh`/`ngo_dao` as authored content/branchTag/display strings, skills, nodes, materials) stay VN under N2.
- **D13**: mission lifecycle + autonomy rules.

## 4. Invariants (must hold before and after)

- `(path, way)` pair is written atomically inside the initiation ritual; invalid/absent pairs fail closed everywhere (`getActiveWayDefinition`).
- Way-strict predicates are the only way discriminator — no raw-path branches, no identity inference from skills/nodes/UI.
- Node gating: `requiredCultivationPath`/`requiredWay` keep identical semantics on new values.
- `PlayerData` reactivity contract: renamed fields must still be declared explicitly in `createDefaultPlayer()` (Pinia `toRefs()` snapshot requirement — same constraint documented in `Player.ts`).
- Save validation: enum membership check on the new value set; pre-M1 saves rejected by the version bump (no translators).

## 5. Rename surface (mechanical, exhaustive)

**Types / contracts**
- `PathWayId` → `CultivationWayId` (strict union replaces open `string` — this TIGHTENS the type; all declaration sites updated).
- `CultivationPathId` values per table above.
- Way `id` fields inside `CULTIVATION_PATH_MODULES[path].ways` records + the record keys.
- `PathWayDefinition`, `PathWayRead`, `PhapTuWayRead`/`KiemTuWayRead`/`TheTuWayRead`, `PathWayStatFacet`, `PathWaySubpaths`, `PathConditionalRead`, `PathOfferGate`, `PathCapability`, `PathCapabilityFacet`, `CultivationPathModule`, `PathStateIssue`, `CultivationPathRealmReward`, `PathWayDefinition` — type-name audit: rename only names that encode the VN identity (`PhapTu*`/`KiemTu*`/`TheTu*` prefixes → `Spell*`/`Sword*`/`Body*`), e.g. `PhapTuState`→`SpellPathState`, `KiemTuState`→`SwordPathState`, `isPhapTuNguHanh`→`isSpellPathway`, `isPhapTuNgoDao`→`isHiddenSpellPathway`, `isKiemTuHien`→`isSwordPathway`, `isKiemTuNgu`→`isHiddenSwordPathway`, `isTheTuHien`→`isBodyPathway`, `isTheTuUngThe`→`isHiddenBodyPathway`. Contract names that are already generic English (`PathWayRead`, `PathWayDefinition`, `PathOfferGate`, …) keep their names with the `CultivationWayId` type swapped in.
- `MORTAL_PRECURSOR_SKILL_IDS` and way `skillIds`/`unequipSkillIds`/`techniqueId` values: **unchanged** (leaf content ids; technique ids are replaced by M3, not this mission).
- `PathCapability` union values — mechanic authority contract (N1: English, N3: no mixed-language), fully semantic-English (review v2 MEDIUM-1):
  `phap_tu.elemental_casting`→`spell.elemental_casting`, `phap_tu.the_pool`→`spell.essence_pool`, `phap_tu.empowered_ult`→`spell.empowered_ult`, `phap_tu.reaction_aura`→`spell.reaction_aura`, `kiem_tu.kiem_pho`→`sword.sword_scroll`, `kiem_tu.ngu_kiem_dao`→`sword.sword_riding`, `the_tu.the_economy`→`body.essence_economy`. All declarations, conditional predicates, callers, and tests move atomically.
- `StatDomain` path/way values — mechanic domain tags (N1): `phap_tu`→`spell`, `kiem_tu`→`sword`, `the_tu`→`body`, `the_tu_an`→`hidden_body` (the hidden-body way's own domain, way-scoped not path-scoped). Migrates atomically across the `STAT_DOMAIN` registry, `PathWayStatFacet` emissions, `resolveActiveWayStatDomains`, delta-deriver registrations, and direct checks (`includes('phap_tu')` etc.).
- `TurnBasicAttacks.ts` — `BASIC_ATTACKS_BY_BUILD` keys (`kiem_tu:…` etc.) + `REQUIRED_BUILD_IDS` move atomically with the path-id cut; **harden the map type from `Record<string,…>` to `Partial<Record<CultivationPathId,…>>`** — the map is intentionally sparse (only sword carries a static entry; spell resolves authored elemental basics elsewhere, body falls through to `GENERIC_PHYSICAL_BASIC`), so the typed map must preserve sparseness while making a missed key a compile error, not a silent runtime miss. Fallback behavior unchanged (review v3 HIGH).
- `PathConditionalRead` slice picks — `'phapTu' | 'kiemTu'` → `'spellPath' | 'swordPath'` (review MEDIUM-3).
- `PathSubpathAxis.state` literals — `'player.phapTu.element'`→`'player.spellPath.element'`, `'player.phapTu.route'`→`'player.spellPath.route'`, `'player.kiemTu.preset'`→`'player.swordPath.preset'`, `root` axis doc strings updated (review MEDIUM-3).

**Persisted fields (PlayerData)**
- `cultivationPath`/`cultivationWay` → new value sets (names unchanged — already English).
- `phapTu: PhapTuState` → `spellPath: SpellPathState` (required field, all players).
- `kiemTu?: KiemTuState` → `swordPath?: SwordPathState`.
- Inner leaf member names unchanged (`spellPath.element`, `swordPath.kiemY`, `swordPath.kiemDaoCount`, …) — only the containing slice names migrate (review v2 LOW).
- `grantedRealmPassiveIds`, `nodeLevels`, `skillCastCounts`, `skillLevels`, `purchasedNodeIds` — contents unchanged except where values encode path/way ids (see below).

**Data**
- `requiredCultivationPath`/`requiredWay` values across `data/progression/*` (PhapTuNodes, KiemTuNodes, TheTuNodes, TheTuAnNodes, RealmPassiveNodes) → new ids.
- `branchTag` values (`kiem_pho`, `ngu_kiem`, `the_tu`, `the_tu_an`, element tags) — **leaf, unchanged**.
- Way `realmRewards`, `offerGate` contents unchanged (values reference leaf ids only); `realmRewards` keys stay `realmId`s (already English). `statModifiers` DO change where they carry path/way `StatDomain` tags (see StatDomain item above).
- ~~`ARTIFACT_ID_BY_CULTIVATION_PATH`~~ — **dead symbol, removed from surface** (artifact path lookup already lives in way-owned `realmRewards`; review v2 LOW).

**Save boundary**
- `CURRENT_SAVE_VERSION` → 68; enum-membership validation updated to new unions. v67 and older rejected, same convention — **no field translators**.
- `saveShapeValidation` + module-owned persisted-state validators updated to the new unions (review MEDIUM-4: `computeRestoreIdentity` fingerprints the payload and does NOT validate path/way — it changes only via mechanical fixture/type fallout, not behavior).

**Callers**
- All readers/writers of `player.cultivationPath/cultivationWay/phapTu/kiemTu`, `is*Pathway` predicates, `getActiveWayDefinition`, `applyPathChoice`, way modules, `nodeWayApplies`/`nodePathApplies`, UI way-gates (`SkillPathPanel`, `CharacterPanel`, `TurnCombatSkillBar` way branches), `GameManager*` ops, `TurnBattleSystem` way riders — updated to new names/values.
- ~74 non-test files + test suite — all updated mechanically in the same commit.

## 6. Behavior that MUST be preserved (do not touch)

- All gameplay behavior, gating outcomes, combat resolution, ritual flow, offer-gate results, stat facets, tree selection, hidden/sealed offer behavior.
- All display strings (N5): lore names unchanged — `Kiếm Tu`, `Pháp Tu`, `Ngũ Hành`, `Ngộ Đạo`, `Hiện`, `Ngự`, `Ứng Thể`, i18n keys.
- `unequipSkillIds` semantics (M4 owns its rework), `realmRewards` contents (M2 owns `passiveSkillId` addition), `techniqueId` values (M3 owns).
- `branchTag`/`element`/route leaf vocabularies.

## 7. Explicit non-goals

- No behavior/balance change of any kind.
- No file/directory renames (`core/phap-tu/`, `core/kiem-tu/`, `core/the-tu/`, `PhapTuPath.ts`, `LuyenThePanel.vue`, …) — cosmetic M2-class rename is deferred (flagged for M8 decision; module dirs are not runtime identity).
- No leaf-id translation (skills, nodes, materials, enemies, quest ids).
- No technique-id migration (M3 authors the 6 semantic English technique ids).
- No save-field additions/removals — only renames + value changes.
- No `branchTag` rename.
- Comments/docstrings: update only lines that would become factually wrong (identifier names inside comments updated mechanically; prose stays).

## 8. Persistence impact

- `CURRENT_SAVE_VERSION` 67 → 68. Old saves rejected by existing convention (dev phase, no migration).
- Persisted renames: `phapTu`→`spellPath`, `kiemTu`→`swordPath`; value changes: `cultivationPath`, `cultivationWay`, `requiredCultivationPath`/`requiredWay` in node data (data-side, not save-side), `grantedRealmPassiveIds` unaffected.
- `Skill.loadoutSlot(s)` untouched this mission (M4 owns removal).

## 9. UI/runtime impact

- No visual change intended. Way-gated UI branches (`SkillPathPanel` tree selection, `CharacterPanel` Quán Khí entry + aura, `TurnCombatSkillBar` dynamic-basic/emblem branches) must resolve identically on new values.
- i18n keys unchanged.

## 10. Tests / gates required

- `npm run type-check` clean.
- `npx vitest run` — full suite green with ZERO behavioral test changes beyond mechanical identifier updates (a test asserting an old id literal gets the new literal; assertions on behavior stay).
- `npm run build` (full verify — save schema + Pinia root state touched ⇒ P3 `full` mode: `npm run verify`).
- Contract/guard tests that enumerate identifiers (e.g. save-shape validation, canonical-surface guards) updated + green.
- A migration-consistency test is NOT required (no translator exists); instead assert the new unions' exhaustiveness where the codebase already does (module catalog keyed completeness, way↔path pairing validity).

## 11. Dependencies

- None — first P7 mission. Branched from `0c07d56e` (post-P1–P6 merge base).
- Downstream consumers that assume English spine: M2 (realm rewards channel), M3 (technique ids + way grant), M4 (starter-basic resolution), M6 (technique prerequisites), M7 (UI consolidation).

## 12. Risks / notes for review

- `PathWayId` was `string`; making it a strict union may surface places that stored ad-hoc way strings — each must be resolved to a real union member (fail-closed behavior preserved).
- `player.spellPath` exists on every character including sword/body players — same semantics as today's `phapTu` (inert shape for non-spell ways); the rename documents intent, not presence.
- `TuLinhTranBalance` (economy) must NOT be touched — shares the `tụ linh` morpheme with `tu_linh_quyet` but is unrelated (naming-migration.md F8).
- **PINNED (review MEDIUM-5): NO file renames, including test files** — consistent with §7; `*.kiemTu*.test.ts`/`*.phapTu*.test.ts`/`*.theTu*.test.ts` keep their filenames (contents still updated to new identifiers). Cosmetic filename parity is deferred to M8's sweep decision.
- `stateVersion`/Pinia reactive reads of renamed fields — must re-verify no raw `player.phapTu`/`player.kiemTu` reads survive (greppable).
