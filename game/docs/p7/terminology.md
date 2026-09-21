# P7 Canonical Terminology

Two layers exist and must not blur (existing `docs/naming-conventions.md` N1/N5):

- **Domain identity** — what the machine resolves: type names, field names, enum values, persisted ids, system names.
- **Lore display** — what the player reads: Vietnamese-diacritics strings from i18n or data `name` fields. Lore names NEVER change via rename work.

## Terms

| Canonical term | Domain form today | Lore/display today | Status |
|---|---|---|---|
| Realm (major) | `realmId` — `mortal`, `qi_refining`, `foundation_establishment` (+7 placeholder) | Phàm Nhân / Luyện Khí / Trúc Cơ / … | CANONICAL |
| Realm level (minor) | `realmLevel` (1..18, gates at 12) | Tầng N | CANONICAL |
| Path | `cultivationPath` — DECIDED: `sword`/`spell`/`body` (D6) | Kiếm Tu / Pháp Tu / Thể Tu | CANONICAL |
| Way | `cultivationWay` — DECIDED: `sword_pathway`/`hidden_sword_pathway`/`spell_pathway`/`hidden_spell_pathway`/`body_pathway`/`hidden_body_pathway` (D6) | (way display names TBD by content; ẩn-family ways ↔ `hidden_*`) | CANONICAL |
| Technique | `Technique`, way `techniqueId` | Tâm Pháp | REDESIGN APPROVED (D1) |
| Technique Rank | `rank` 0–10, auto-progress on usage | — | DECIDED (D1) |
| Technique Grade | `grade`, Phẩm axis; advance = rank10 + material + eligibility; realm-capped | Phẩm (Cửu→Tiên) | DECIDED (D1) |
| Technique Quality | `quality`, Chất axis; fully independent | Chất (Hoàng→Tiên) | DECIDED (D1) |
| Mastery | `mastery`/`masteryProgress` — technique-side rank accrual (renamed from `insight`, D1) | Cảm Ngộ (technique side) | DECIDED — collision resolved |
| Insight (skill) | `player.skillInsight` | Cảm Ngộ | CANONICAL — stays node/skill-upgrade pool only |
| Node | `ProgressionNode`, `nodeLevels` | Điểm Ngộ Đạo / node | CANONICAL |
| Skill | `Skill` | Kỹ Năng / chiêu thức | CANONICAL |
| Skill role | `basic`/`special`/`ultimate` (`TurnSkillSlotRole`) — resolver-facing semantics, not a mandatory authored shape (D3) | Thường / Đặc Biệt / Tuyệt Kỹ | CANONICAL |
| Loadout | `loadoutSlot(s)`, `SkillLoadoutStrip` | Pháp Thuật Đang Vận Hành | RETIRE (D3) |
| Body Refinement | `bodyRefinement*` fields, `BODY_REFINEMENT_TIERS` → BodyChapter | Luyện Thể | FOLD into BodyProgression (D4) |
| Meridian | `openedMeridianIds`, `MeridianSystem` → BodyChapter | Bát Mạch / Kỳ Kinh | FOLD into BodyProgression (D4) |
| Cultivation | `cultivation`, `cultivationPerSecond`, `cultivationOvercharge` | Tu Vi | CANONICAL |
| Breakthrough (minor) | `breakthrough()` on CultivationSystem | Đột Phá | CANONICAL |
| Tribulation (major) | `TribulationDirector`/`OutcomeService` | Độ Kiếp | CANONICAL |
| Initiation Ritual | `chooseCultivationPath` + `applyPathChoice` | Lễ Nhập Môn | CANONICAL (mortal→qi_refining + path commit) |
| Foundation grade | `FoundationType`, `highestFoundationAchieved` | Căn Cơ (Đại Đạo/…) | DEFERRED scope |
| Nhập Đạo grade | `breakthroughGrade` | Bậc Nhập Đạo | CANONICAL mechanic; name collision risk with technique Grade — rename candidate (`initiationGrade`?) |
| Mortal perfection | `mortalPerfectionAchieved` | (hidden) | DEFERRED-adjacent |
| Combat build | `ResolvedCombatBuild` | — | CANONICAL (invariant 25) |

## The Phẩm/Chất axes (already documented, `naming-conventions.md`)

- **Phẩm** = comparative realm-grade axis (10 steps, Cửu→Tiên Phẩm). Technique Grade should ride this axis if it compares to realm ceilings.
- **Chất** = quality axis (5 steps, Hoàng→Tiên Chất). Technique Quality should ride this axis.

Candidate invariant wording ("Grade cannot exceed realm ceiling", "Quality independent of rank") maps cleanly: Grade↔Phẩm, Quality↔Chất, Rank↔the 0–10 mastery steps. Using the documented axes avoids inventing a third vocabulary.

## Known collisions — resolutions

1. **`insight`** — RESOLVED (D1): technique-side accrual renamed `mastery`/`masteryProgress`; `skillInsight` stays the node/skill-upgrade pool.
2. **`grade`** — `breakthroughGrade` (Nhập Đạo bậc 1–6), `ArtifactGrade`, `ProfessionGrade`, item `quality/grade` fields, incoming Technique Grade. Technique Grade rides the Phẩm axis (D1); keep the field name scoped (`technique.grade`/`grade`) and watch display collisions in shared stat/UI contexts.
3. **`tier`** — TechniqueTier (`so_nhap…vien_man`) is RETIRED with the insight model (D1); body refinement tiers become chapter steps (D4). Remaining `tier` usages (node/realm/pill) are out of P7 scope.
4. **Path vs Way** — RESOLVED (D6): both value sets migrate together to English; `CultivationWayId` replaces `PathWayId` naming.
5. **`equipped`** — RESOLVED (D3): loadout semantics die; technique grant becomes way-owned (no equip-as-choice); remaining `equipped` uses (equipment, passives) keep their owner-local meaning.

## Proposed canonical phrases for new domain concepts

- `TechniqueRank` (0–10 mastery), `TechniqueGrade` (Phẩm), `TechniqueQuality` (Chất).
- `CanonicalTechnique` / `wayTechnique` for the way-owned single technique concept.
- `BodyProgression` umbrella; `BodyChapter` = body_refinement / meridian_opening / future realm chapters.
- `MortalSkill` or keep `MORTAL_PRECURSOR_SKILL_IDS` (already semantic).
