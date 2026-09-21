# P7 — Naming Debt Census & Migration Classes

## Existing authority

`docs/naming-conventions.md` (v41, still cited by current code):
- **N1** mechanic/system identifiers → English.
- **N2** content flavor ids → unaccented VN pinyin, derived from display name (N2b), consistent per family.
- **N3** never mix languages inside one id or family.
- Family map: realms/buildings/enemies/pills/stages/stats/battle-states = English; **skills, techniques, material-flavor, zones = VN pinyin**. `CultivationPathId` (`phap_tu`/`kiem_tu`) explicitly grandfathered as consistent.

## The P7 conflict

Candidate invariants 21–22 ("new identifiers canonical semantic English", "lore names do not leak into domain identity") collide with N2 for the *content* families. The real question is classification, not translation effort:

- If skill/technique/path/way ids are **domain identity** → they violate the invariant today and migrate.
- If they are **content flavor** → N2 already legitimizes them; invariant 22 is satisfied by keeping VN only in `name`/i18n display strings and English in *mechanic* identifiers.

This was a material decision → human Notice.

**DECIDED (D6, 2026-09-21): spine English, leaves VN.** `CultivationPathId = 'sword'|'spell'|'body'`; `CultivationWayId = 'sword_pathway'|'hidden_sword_pathway'|'spell_pathway'|'hidden_spell_pathway'|'body_pathway'|'hidden_body_pathway'`. Canonical technique ids → English. New mechanic/type/property identifiers → English. Leaf content ids (skills, nodes, materials, zones, authored content like `ngu_hanh`/`ngu_kiem`/`kiem_pho` underneath a Way) stay VN under N2 — no repo-wide rename. N2 amended narrowly: path/way/technique identity = mechanic family, not content flavor. Direct identity cut — no persisted-value compat layer.

## Census of VN-pinyin machine identifiers (current worktree)

- ~**511** unique `id: '…'` literals across `src/data/**` — the majority VN pinyin (skills, techniques, materials, quests, nodes, enemies-flavor).
- ~**93** source files carry VN morphemes in their names, concentrated in:
  - `core/phap-tu/` (PhapTuPath, PhapTuState, PhapTuRoutes…)
  - `core/kiem-tu/` (KiemTuPath, KiemTuState, KiemPhoSystem/Provider/NodeModifiers, NguKiemDao(Provider))
  - `core/the-tu/` (TheTuPath, TheTuCapabilities, TheTuAnMechanicModifiers, TheTuBatTuSurvival, TheTuExternalWard, TheTuStatChannels…)
  - `core/realm/` (MeridianSystem), `core/economy/` (TuLinhTranBalance — unrelated to `tu_linh_quyet`, see F8)
  - Panels: `LuyenThePanel.vue`, `QuanKhiPanel.vue`, `TranPhapPanel.vue`
  - `data/`: `PhapTu*`, `KiemPho*`, `NguKiemDao*`, `TheTu*`, `Meridians.ts`, `BodyRefinement.ts`, `TranPhap.ts`, `NguHanhChau.ts`, `ThuanHeBuffs.ts`, `KiemPhoBuffs.ts`…
- Persisted/save-visible VN values: `cultivationPath` (`kiem_tu`…), `cultivationWay` (`ngu_hanh`, `ngo_dao`, `hien`, `ngu`, `ung_the`), `realmId` (English already), `phapTu`/`kiemTu` field names, skill/technique/node ids inside `nodeLevels`, `skillCastCounts`, `purchasedNodeIds`, `openedMeridianIds`, companion ids, formation ids.
- UI-facing-only VN: panel labels, `StandalonePanel` values (`luyen_the`, `quan_khi`, `tran_phap`), `LeftPanelMode` (`scripture_pavilion`), i18n keys (English already).

## Migration classes (cost model)

| Class | Scope | Cost | Mechanism |
|---|---|---|---|
| **M0 — Display only** | i18n keys, labels | none | No id touched. Always safe. |
| **M1 — New identifiers** | Fields/types/ids introduced BY P7 | none | Just author in English (invariant 21 applies regardless of the family decision). |
| **M2 — Type/file rename, values unchanged** | `PhapTuPath.ts→…`, `LuyenThePanel` etc. | Medium | Pure rename; ids inside data untouched; no save impact. Git-renames + import updates. |
| **M3 — Persisted value rename** | `cultivationPath`/`cultivationWay` values, `realmId`-adjacent ids, node/skill/technique ids | High | Save-version bump (v68+, reject old saves — no translators needed under the no-migration convention); every gate/prerequisite/data row referencing the id updates atomically; i18n unaffected. |
| **M4 — Save field rename** | `phapTu`, `kiemTu`, `openedMeridianIds`, `bodyRefinement*`, `skillInsight`… | High | Same as M3 + PlayerData field rename + every reader/writer. |

## Recommended scope

Regardless of the family decision, P7 should:

1. Author ALL new identifiers in English (M1) — includes TechniqueRank/Grade/Quality, BodyChapter, canonical-technique constructs.
2. Rename `tu_linh_quyet` by *deleting* it (locked) — no rename needed.
3. NOT mass-translate the ~511 content ids — even if content ids are reclassified as domain identity, migrating only the ids P7 actually re-authors (way techniques, mortal precursors, loadout-adjacent skills) keeps the diff reviewable.
4. Fix the dangerous near-miss: `TuLinhTranBalance.ts` (formation economy) vs `tu_linh_quyet` (technique) — a careless `tu_linh` grep-delete would hit the wrong system. Explicit whitelist in implementation.
5. Decide path/way value language once, then apply M3 atomically to the pair — never migrate `cultivationPath` without `cultivationWay`.
6. Rename `skillInsight`↔technique-insight collision (terminology doc, collision #1) in whichever model wins.

## What must NOT happen

- Mixed-language ids (N3): e.g. `sword_ngu_kiem`, `phap_tu_fire`.
- Leaving renamed ids' old values readable "for compat" — save rejection makes that moot; dual-identity in gameplay violates invariant 23's intent.
- Translating display strings — lore names are correct as-is (N5).
