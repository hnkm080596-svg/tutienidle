# P7 — Mission Dependency Graph

> **QA disposition (2026-09-23, M-QA-INTERNAL):** the "SPEC → ChatGPT review until pass → PLAN → ... → external review until pass" pipeline and `[C2C] NOTICE` transport references in this file — and in every `missions/*.spec|plan|notes` file below — are **historical and non-binding**. External/ChatGPT-Web verdicts are no longer a completion criterion; QA decisions follow the Internal Fixed-Point QA Protocol (`game/docs/qa/protocol/README.md`) with isolated internal reviewers. Locked product/design rulings remain binding; only the external-review transport steps are retired.

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
| M-H | DONE | `0a0a742f` | verify 911t + OCR + QA + P5 (4 passes) + external SPEC (7 rounds) / IMPL (2 rounds) reviewed — loadout/equipped/insight residuals swept; formation + equipment KEEPs preserved |

---

# Luyện Khí Reconciliation Missions (M-QI)

Follow-up graph from the Luyện Khí chapter audit + reconciliation (decisions D1–D8) and the subsequent blocking rulings — all locked in `decisions.md` under "Luyện Khí reconciliation — locked rulings". Same spec → plan → implement → gates → external review → merge workflow. Renumbers the reconciliation report's M-QI-01..11 candidates into dependency order.

## Dependency analysis

- **Canonical Core/Node authority first** (ruling): `M-QI-05` establishes Core Node Level = canonical Skill Level and migrates `skillLevels`/`Skill.level` into `nodeLevels`. No mission may author Skill-level content (technique gates, node caps, new levelled nodes) before it lands — they would entrench the duplicate authority.
- **Physique transformation authority before grade-aware Body content** (ruling): `M-QI-07` owns `physiqueGrade` + the idempotent 6/6-chapter transformation; `M-QI-08` (essence family/costs/drops) resolves against it.
- **Substitution contract + simulated ratio before drop-band swap** (ruling): `M-QI-09` locks the downward-substitution contract and the deterministic-simulated `conversionRatio[N]`; only then may `M-QI-10` shift the live drop band (LQ→Bảo, TC→Pháp) without stranding unfinished lower-grade Body progression. No placeholder ratios in final data.
- **Standalone fixes** (`M-QI-01..04`, `M-QI-11`) are independent of both authority chains and may run in any order; each is one coherent boundary.
- **E2E journey** (`M-QI-12`) consumes the committed gates and lands late by design.

## Missions

| # | Mission | Authority boundary | Depends on |
|---|---|---|---|
| M-QI-01 | **Meridian invest wiring** | `MeridianSection` invest action → `realmAdvanceOps.investBodyChapter` → `meridianChapter`; cost/gate surfacing; sequential + page-unlock + post-advancement lower-page invest contracts. Domain contract already exists (M5 parked). | — |
| M-QI-02 | **Trúc Cơ chapter gate** | `canTriggerBreakthrough` gains Chapter-10 predicate (`completedStageIds ⊋ qi_refining_abyssal_pool`) alongside realmLevel ≥ 12. | — |
| M-QI-03 | **Breakthrough requirement read-model** | Normal UI shows exactly `[LQ tầng 12]` + `[Chương 10 hoàn thành]`; hidden foundation inputs never surface. | M-QI-02 |
| M-QI-04 | **`hoi_xuan_thao` deferred cleanup** | Quest retarget → `tu_linh_thao_qi_refining_decade`; retired family pruned from Động Thiên grotto pool; marked DEFERRED; id tolerance preserved. | — |
| M-QI-05 | **Canonical Core Node Level authority** | D3.9 spec → single level authority (`nodeLevels[coreNodeId]`); deprecate `Skill.level`/`upgradeSkill` as independent authority; `skillLevels` handled by save-version rejection (no field translators); cast-exp skills = one canonical level with casts-only input, Insight rejected; passives: mechanism supports levelled, all current stay fixed; `skillCastCounts` mirror semantics kept; per-node `maxLevel`/`currentLevel`/per-level cost shape (final numbers deferred). | — |
| M-QI-06 | **Technique node gates** | Technique-derived node unlock + node max-level cap mechanism (schema + evaluator) + minimal authored gate set per D3 spec — uses M-QI-05's authority. | M-QI-05 |
| M-QI-07 | **Physique transformation authority** | Persisted `physiqueGrade` (default Phàm; no migration — old save versions rejected); 6/6 Body-Refinement-chapter → transform transaction; persistent/deterministic/idempotent; late-completion valid; ladder data Phàm→Tiên; no stat bonuses (deferred). | — |
| M-QI-08 | **Grade-aware Essence family** | `Tinh Hoa <Grade>` material family (Phàm/Bảo/Pháp authored now); grade-aware Body chapter costs; drop definitions per pinned band map (Mortal→Phàm, LQ→Bảo, TC→Pháp); legacy `tinh_hoa_pham_the` → Phàm-grade mapping. | M-QI-07 |
| M-QI-09 | **Essence substitution contract + sim** | Downward-only substitution (higher→lower) resolved automatically at Body cost check — no exchange UI; data-driven adjacent `conversionRatio[N]`, monotonic, no-arbitrage; deterministic economy simulation locks final ratios before production data. | M-QI-08 |
| M-QI-10 | **Essence drop-band production swap** | Live LQ drops shift to Bảo-grade, TC to Pháp-grade; lower-grade Body requirements stay completable through the M-QI-09 contract. | M-QI-09 |
| M-QI-11 | **Kiem Pho authored combo payloads** | 37-combo authored effect pass replacing length-tier scaffolds (sanctioned deferral); independent of authority chains. | — |
| M-QI-12 | **LQ→TC E2E journey coverage** | Headless journey: initiation → chapter 10 → level 12 (+ Meridian invest, insight/node spend) → successful breakthrough; restore mid-chapter. | M-QI-01, M-QI-02, M-QI-03 |

## M-QI completion ledger

| # | Status | Commit | Gates |
|---|---|---|---|
| M-QI-01 | DONE | `69767cb6` | verify 81t scope + type-check + OCR + runtime (live invest: pill 5→4, nham_mach opened, next row actionable) + QA + P5 + external SPEC/IMPL (2 rounds) reviewed |
| M-QI-02 | DONE | `df2b232d` | verify 1213t scope + type-check + OCR + QA + P5 + external SPEC (2 rounds) / IMPL reviewed — qi_refining breakthrough = L12 + `qi_refining_abyssal_pool` clear (QI-D5) |
| M-QI-03 | DONE | `f4ec23a8` | verify 13t focused / 1020t scope + type-check + OCR + runtime (live: unmet `✗ Chương 10` → seeded clear → `✓`, button disabled→enabled; mortal/foundation 0 rows) + QA + P5 + external SPEC (2 rounds) / IMPL (2 rounds) reviewed — `getBreakthroughRequirements` owns admission truth; `canTriggerBreakthrough` delegates; qi_refining-only requirement block (QI-D6) |
| M-QI-04 | DONE | `2499e626` | verify 207t scope + type-check + OCR + QA + P5 + external SPEC (2 rounds) / IMPL (4 rounds) reviewed — `hoi_xuan` DEFERRED: daily retargeted to `tu_linh_thao_qi_refining_decade`, grotto pool prunes retired families, id tolerance kept (QI-D8) |
| M-QI-05 | DONE | `040a6765` | verify full (type-check + build + 729 files / 6506 tests) + OCR (133+11+5 delta files) + P13/P14 (ritual e2e 7/7 on worktree server) + deep QA report + P5 sequential passes + external SPEC (6 rounds) / IMPL (4 rounds) reviewed — `nodeLevels[core_<skillId>]` sole level authority; `skillLevels` field retired+rejected at v73; `Skill.level` frozen authored; SkillCoreNodes catalog (generated template cores + 14 whitelisted native cores); learnSkill/way-commit/ritual atomic grants; cast sink writes core mirror; `progressionOwnerId` level inheritance + `levelScaling` on 10 native damage defs; canonical bidirectional save ownership validation; `NativeCoreDetail` + Tree/Detail center mode in SkillPathPanel (QI-D3) |
| M-QI-06 | DONE | `7c53410b` | verify full (type-check + build + 734 files / 6548 tests) + OCR (17 reviewable) + P14 (worktree browser: gated node shows authored 5/10, empty cost, `Nâng cấp bị chặn:` + rank reason, disabled upgrade) + quick QA report + P5 sequential passes + external SPEC (3 rounds) / IMPL (2 rounds) reviewed — `ProgressionNode.levelGates` + `getBlockingNodeLevelGates`/`getEffectiveNodeMaxLevel` sole gate authority; `canUpgradeNode` effective read; ops cost previews effective; upgrade-only binding, frozen surplus preserved; 17-node authored set (Pháp god-ults + Thể majors rank5, intensity L6@3/L9@6, Ngự Kiếm L5@4); `NodeInspector` binding-gate reasons, authored `x/max`/`is-maxed` (QI-D3) |
| M-QI-07 | DONE | `146483c5` | verify full (type-check + build + 737 files / 6579 tests, post-review re-run) + OCR (29 reviewable) + P13/P14 (worktree browser :5740, live tick: seeded 5/6 completes → Phàm Thể→Bảo Thể flip persisted) + deep QA report (12-row ledger) + P5 sequential 4 passes + external SPEC (4 rounds) / IMPL (3 rounds) reviewed — `player.physiqueGrade` persisted (default `pham`, no stat bonuses); `PhysiqueLadder` 10-rung catalog sole identity data; `BodyChapter.physiqueAdvancement` contract (`body_refinement`: pham→bao); `investBodyChapterState` sole writer (source-grade gate before mutation, exact-`from` write guard, one rung per complete chapter, idempotent); `derivePhysiqueGrade` authored-chain derivation + restore preflight exact-equality (rejects behind/ahead/unreachable, `derivationBlocked` keeps missing slices in aggregated error); save v74, no migration; `BodyRefinementSection` physique line (QI-D4) |
| M-QI-08 | DONE | `9343215e` | verify full (type-check + build + 738 files / 6607 tests, run twice on final state) + OCR (7 reviewable) + quick QA report (8-row ledger, deepAuditCandidate bounded by inspection) + P5 sequential 5 passes + external SPEC (3 rounds) / IMPL (2 rounds) reviewed — `PhysiqueEssence` sole material-id↔grade authority (pham/bao/phap authored, `tinh_hoa_pham_the` kept via `TINH_HOA_PHAM_THE_MATERIAL_ID`); sparse Map-backed `physiqueEssenceBand`/`physiqueEssenceBandDrop`; `PHYSIQUE_ESSENCE_BAND_DROPS` derived band→grade→materialId, exact-pinned to fixed M-QI-09 sim inputs (0.7 / 1-3) + mortal drift sentinel; `bodyChapterEssenceGrade` namespace-gated (`bag==='material'` first — pill-collision regression covered); BattleLootSystem family-wide essence particle routing (presentation only); no live drops/costs/save change; `huyet_mong` pham ×12 exception documented (QI-D4b/D4c/QI-S) |

## Locked rulings carried into this graph

- Fixed-kit actions exempt from Beta Basic-only (QI-D2); Basic-only = B/S/U role-unlock axis.
- Core Node Level = canonical Skill Level; `Skill.level`/`upgradeSkill` deprecated; `TurnSkillDefinition` progression lives on nodes, not on execution defs (QI-D3).
- Physique transform = 6/6 Body Refinement chapter, idempotent + late-completion (QI-D4).
- Essence: Mortal→Phàm, LQ→Bảo, TC→Pháp; downward substitution only; ratio sim-locked (QI-D4b/c).
- `hoi_xuan_thao` = DEFERRED; quest → `tu_linh_thao`; retired family pruned from grotto pool (QI-D8).
- Cast-exp skills (`tram`/`linh_bao`/`huy_quyen`): one canonical level, casts-only input, Insight can never raise (QI-D3 ruling).
- Essence substitution = automatic at requirement resolution, no exchange UI (QI-D4c ruling).
- No field migration anywhere in this graph — save-version rejection governs (QI-S).
- Physique stat bonuses, remaining 7 grade→realm bands, insight cost curve/max levels, bidirectional essence exchange: deferred — no authoring without a future ruling.
- No temporary compatibility hacks as final architecture.
