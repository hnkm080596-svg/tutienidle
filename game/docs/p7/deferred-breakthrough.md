# P7 — Deferred Breakthrough Scope

User directive: **special breakthrough formulas are deferred and cannot force P7 architecture.** This document fixes what that means concretely, so P7 design decisions do not accidentally bind to — or break — this machinery.

## What exists today (Trúc Cơ breakthrough stack)

| Piece | Location | Role |
|---|---|---|
| TribulationDirector | `core/tribulation/TribulationDirector.ts` | Chapter-by-chapter Độ Kiếp battle scripting; resolves grade facts. |
| TribulationOutcomeService | `core/tribulation/TribulationOutcomeService.ts` | Victory/defeat settlement: realm entry, cultivation reset, `highestFoundationAchieved`, `greatDaoOpportunityLost`, talent stacks, artifact seed, way realm rewards. |
| BreakthroughOutcomeService | `core/tribulation/BreakthroughOutcomeService.ts` | Minor/major breakthrough settlement path (non-tribulation), incl. unreachable technique-swap branch noted in source. |
| FoundationType | `core/breakthrough/FoundationType.ts` | Grade union (`great_dao`, …) + labels. |
| BreakthroughGrades data | `data/breakthrough/BreakthroughGrades.ts` | Grade definitions/effects. |
| FoundationResolver conditions | spread across PlayerData flags + systems | Inputs: `mortalPerfectionAchieved` (5/5 capped stats + 6/6 Luyện Thể at Quán Khí), `openedMeridianIds` (9/9 incl. Thiên Địa Chi Kiều), `luyenKhiKillsSinceBeast` (1000-kill hidden beast window), `greatDaoOpportunityLost`, body-refinement-derived `breakthroughGrade`. |
| Hidden beasts | `data/enemy/HiddenBeasts.ts`, `HiddenBeastSystem.ts`, `FoundationEnemies.ts` | Spawn-window machinery feeding the grade formula. |
| Realm passives | `data/realm/RealmPassives.ts`, `RealmPassiveSystem`, `breakthroughGrade` | Nhập Đạo/Kiến Cơ… permanent modifiers; grade read at ritual lock. |

## What "deferred" means for P7

1. **No P7 structural decision may require a final answer on the grade formula** — e.g. whether Đại Đạo needs meridian 9/9 vs. something else is out of scope.
2. **Inputs stay persisted as-is.** The flags (`mortalPerfectionAchieved`, `openedMeridianIds`, `luyenKhiKillsSinceBeast`, `greatDaoOpportunityLost`, `highestFoundationAchieved`, `breakthroughGrade`, `tribulationBonusStacks`) remain the formula's input contract. P7 may reorganize *who owns* body progression, but the persisted fields (or a defined successor) must remain readable by the resolver.
3. **The tribulation chain itself is KEEP** — it is the realm-transition authority, not a "special formula". Only the *grade-computation* surface is deferred.
4. **Realm rewards stay way-declared** (`realmRewards[realmId]`); the *content* of rewards changes (no technique-swap), the channel does not.
5. **Future realms beyond Trúc Cơ remain placeholder data** (`golden_core`…`tribulation` in `data/realms/realm.ts`); P7 does not design their breakthroughs.

## Explicit deferral list

- Final Đại Đạo/Thiên Đạo/… formula and its full condition set.
- Hidden-beast window tuning (`luyenKhiKillsSinceBeast` thresholds).
- Whether meridian/body chapters remain formula inputs after the body-progression consolidation.
- Post-Trúc Cơ realm breakthroughs (none exist).
- `highestFoundationAchieved` reveal UX beyond current announce flow.

## Constraint on the body-progression decision

The single body authority (invariants 15–17) must expose chapter progress through a stable read (e.g. `getBodyChapterProgress(player, chapterId)`) so the deferred resolver can be re-pointed without touching the authority again. Whether `openedMeridianIds`/`bodyRefinement*` fields migrate into chapter-shaped state is a P7 implementation choice; the deferred formula's *inputs* must survive the migration.
