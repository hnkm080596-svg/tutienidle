# P7 — Mission Dependency Graph

Refined from the user's M1–M8 guideline. Each mission = one coherent authority boundary, independently spec'd/planned/implemented/reviewed/gated/committed. Ordering is dependency-driven: later missions build on committed earlier state.

## Dependency analysis

- The **English spine cut** must run first: every later mission authors new ids (techniques, chapters, prerequisites) — running it late double-renames. It is mechanical and independently testable (pure rename ⇒ suite stays green).
- The **passive ladder migration** precedes the technique model: removing `passiveSkillIdsByRealm` is part of the technique cut, but the *channel* (`realmRewards.passiveSkillId`) is independent of the new technique model — landing it first shrinks the technique mission's blast radius. Alternative order (inside the technique mission) would leave realm passives dead in the intermediate state — invalid per mission rules.
- **Technique model** before **node prerequisites** (they evaluate canonical technique state) and before **UI** (technique card renders the new model).
- **Loadout retirement** after technique (the starter-basic resolution at initiation interacts with the way grant; doing it first is possible but couples two authority cuts in one diff either way — sequencing loadout after technique keeps each diff on one boundary).
- **BodyProgression** independent of technique/loadout; placed after them only because UI consolidation wants all domain cuts landed.
- **UI consolidation** last of the domain missions — it consumes every new authority at once.
- **Integration sweep** final.

## Missions

| # | Mission | Authority boundary | Depends on |
|---|---|---|---|
| M1 | **English identity-spine cut** | `cultivationPath` values `kiem_tu→sword`/`phap_tu→spell`/`the_tu→body`; `cultivationWay` values → `*_pathway`/`hidden_*_pathway`; `PathWayId`→`CultivationWayId`; identity-facing predicates/fields renamed; save validation cut. Leaf content ids (`kiem_pho`, `ngu_kiem`, node/skill/material ids) untouched. | — |
| M2 | **Realm-entry passive ownership migration** | `realmRewards[realmId].passiveSkillId` channel; shared canonical passive ladder (deduped authoring, way-overridable); `syncRealmPassive` re-pointed to way reward; `Technique.passiveSkillIdsByRealm` removed; `innateSkillId` → way kit grant. | M1 |
| M3 | **Canonical Technique authority** | New Technique model (`rank`/`mastery`/`grade`/`quality` per D1/D8/D9); `techniqueMastery` reward channel + dedicated progression API; `getTechniqueGradeCeiling`; grade transaction; way-owned grant at initiation; 6 semantic English technique defs; retire `tu_linh_quyet`, `dai_ngu_hanh_quyet_truc_co` swap, `TechniqueTier`, learn-by-drop, TechniqueManager list/equip semantics. | M1, M2 |
| M4 | **Combat-role contract unification** | Generic loadout retired (Skill save fields, ops, combat reads); mortal role contract (`tram`→basic, empty roles); path starter basics (`huy_quyen`/`linh_bao` authored, path authority resolves starter at initiation); precursor/cast-threshold tables reworked; loadout UI reduced to resolved-role display (full IA in M7). | M1, M3 |
| M5 | **Unified BodyProgression authority** | `BodyProgressionSystem` + `BodyChapter` registry; body_refinement + meridian chapters migrated (engines, persisted fields → chapter-keyed state); invest paths unified; chapter-derived Đại Đạo fact exposed; deferred resolver re-pointed; existing panels re-pointed to new reads (IA in M7). | M1 |
| M6 | **Technique-gated node prerequisites** | `requiredTechniqueRank`/`requiredTechniqueGrade` schema + evaluator + tests; no authored gates. | M3 |
| M7 | **Progression UI consolidation** | SkillPathPanel = way identity + technique card + node tree + resolved roles; RealmPanel = realm + body chapter subviews; remove `TechniquePanel`, `LuyenThePanel`, loadout widgets; Scripture Pavilion → lore-only; wheel catalog + i18n updates. | M2–M6 |
| M8 | **Integration sweep + final validation** | Save version decision (final bump if accumulated cuts require it — v68 is M1's, v69 M2's) + shape validation; dead-authority sweep (incl. `TuLinhTranBalance` whitelist); docs sync (roadmap, naming-conventions amendment); `npm run verify`; adversarial QA; P5 sequential review; merge gate. | all |

## Non-goals (phase-level)

- No new balance/content tuning (DPS, rates, hours, curves, difficulty).
- No breakthrough-formula redesign (deferred scope).
- No post-Trúc Cơ content.
- No repo-wide leaf-id rename.
- No save translators — version rejection is the mechanism.

## Notes

- M4's minimal UI change (strip → read-only role display) keeps the intermediate state valid; full widget removal happens in M7.
- M5's panel re-point is mechanical (same UI, new read source); structural IA change is M7's job.
- If ChatGPT review forces a boundary change, update this graph rather than smearing authorities across commits.

---

# Post-P7 — Mortal Chapter Consolidation Missions

Follow-up graph from the Mortal Chapter decisions reconciliation (D1–D6). Each mission keeps the same spec → plan → implement → gates → external review → merge workflow.

| # | Mission | Authority boundary | Depends on |
|---|---|---|---|
| M9 (A+B) | **Companion domain & Ring-2 realm gating** | `isCompanionDomainUnlocked` (CompanionAvailability) gates pull/exchange/feed + wheel `companion_roster` + Chi Hien Quan gacha tabs at `foundation_establishment`; `isFormationUnlocked` (M9-F1) gates formation commits + wheel `formation_slot`; `daily_chieu_hien_lenh` realm-gated with stale-active reconcile closure; Mortal/LK `chieu_hien_lenh` drops removed. | P7 M1–M8 |
| M-C | **MortalChapterJourney suite** | Canonical happy-path + boundary + save/restore journey on `EarlyGameSession`; retires `M0LoopProbe`. | M9 |
| M-E | **Meridian page model** | `pageRealmId` on `MeridianDefinition`; monotonic page-unlock predicate; paged `MeridianSection`. | M9 |
| M-F | **Body base-stat re-emit (D1 spec)** | `BaseStatBodyChapter.collectBaseStatDeltas` + `assembledBase = baseStats + body deltas` before derivation; `percentAtFullTier` → `baseGains`; magnitudes deferred to balance phase. | M9 |
| M-D | **Perfection economy simulation** | Deterministic T_normal vs T_perfect measurement + drop-rate feasibility report (analysis only). | independent |
| M-G | **Beta companion roster** | `than_nong` (healer) + `khai_minh` (buffer) definitions; existing-10 disposition stays "future content". | M9 |
| M-H | **Terminology sweep** | Residual naming cleanup. | all |

Locked product decisions carried into this graph: no save migration (grandfathering only); existing companion roster retained as post-Beta content; balance numbers owned by a later dedicated phase; Formation unlock = `foundation_establishment` (M9-F1, independently re-decidable).

## Completion ledger (2026-09-21)

| # | Status | Commit | Gates |
|---|---|---|---|
| M1 | DONE | `ce32f140` (v68) | verify + runtime two-path + review |
| M2 | DONE | `cca7f91b` (v69) | verify + runtime + review; balance oracle regenerated |
| M3 | DONE | `e9a0bd32` (v70) | verify + runtime + review |
| M4 | DONE | `05eba824` (v71) | verify + OCR + runtime + QA + P5 + external IMPL_PASS |
| M5 | DONE | `c4b31df8` (v72) | verify + OCR + runtime (tick auto-invest live) + QA + P5 + external IMPL_PASS |
| M6 | DONE | `8ff4c975` | verify + OCR + runtime (mirror republish + fail-closed live) + QA + P5 + external IMPL_PASS |
| M7 | DONE | `d8c2cb42` | verify 719f/6337t + OCR clean + runtime 30/30 + QA + P5; retro external review after bridge repair: IMPL_PASS (1 Medium + 2 Low fixed in follow-up) |
| M8 | DONE | — | save decision: no bump (v72 boundary stands); dead-authority sweep clean; docs synced; final verify + merge |
| M9 (A+B) | DONE | `28279570` | verify 563t + OCR + runtime (live gating verified) + QA + P5 + external SPEC/IMPL reviewed |
| M-C | DONE | `9744dd53` | verify 12t + OCR + QA + P5 + external SPEC/IMPL reviewed |
| M-E | DONE | `6854fe27` | verify 536t + OCR + runtime (3 page states live) + QA + P5 + external SPEC/IMPL reviewed |
| M-F | DONE | `c1714dd0` | verify 226t + OCR + runtime (flat gains live) + QA + P5 + external SPEC/IMPL reviewed |
| M-D | DONE | `c42d827b` | verify 15/15 (3-seed measured) + OCR + QA + P5 + external SPEC/IMPL reviewed — verdict: perfection infeasible under enumerated sources (shortfall 23) |
| M-G | DONE | `ae57e931` | verify 294t + OCR + QA (8 hypotheses, 2nd externalWard producer closed) + P5 + external SPEC/IMPL reviewed — than_nong + khai_minh added; BETA_COMPANIONS acquisition pool split from full catalog |
