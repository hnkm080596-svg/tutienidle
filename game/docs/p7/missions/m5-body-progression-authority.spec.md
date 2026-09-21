# P7-M5 — Unified BodyProgression Authority — Spec

Status: SPEC_PASS (ChatGPT review; v1: 3 findings fixed in v2; v3 = plan-phase errata - meridian currency is a pill, `currency`/`auxCurrency` channel descriptor replaces `materialId`/`auxMaterialId`; signatures pinned player-level)
Date: 2026-09-22
Depends on: M1 (canonical ids), committed M1–M4 state
Locked inputs: D4 (single BodyProgression authority, chapter registry), deferred-breakthrough.md (formula inputs must survive migration; stable `getBodyChapterProgress` read), D13 ops model.

---

## 1. Context and intent

Two body-progression engines exist today as sibling leaf modules under `core/realm/`:

- `BodyRefinementSystem.ts` — Luyện Thể: 6 sequential tiers, each a progress bar filled by investing Tinh Hoa Pham The; emits `luyen-the:*` modifiers; feeds the Nhap Dao grade (`computeBreakthroughGrade`) and the mortal-perfection snapshot.
- `MeridianSystem.ts` — Bat Mach: 9 sequential one-shot openings (no partial progress) consuming Thong Mach Dan (+ Thien Dia Chi Kieu for the last); emits `bat-mach:*` modifiers; feeds the Kien Co grade ladder (`resolveKienCoGrade`). The invest path is PARKED — no production caller.

State lives as three flat `PlayerData` fields (`bodyRefinementCompletedTiers`, `bodyRefinementCurrentTierProgress`, `openedMeridianIds`) read directly by the ritual, the grade resolver, the panel, and save validation — each consumer touching engine internals.

D4 locks the target: one `BodyProgressionSystem` owning a `BodyChapter` registry — unified ownership/lifecycle/persistence/querying, while chapters keep specialized rules (tier-progress vs one-shot are different strategies, not one giant conditional). Future Truc Co+ body progression becomes a new chapter definition, not a new engine. Persisted state migrates to chapter-keyed canonical state. The Dai Dao coupling is preserved: meridian/refinement counts become a **canonical chapter-derived fact** the deferred breakthrough resolver reads — the formula itself is NOT redesigned.

## 2. Current state — evidence map

| Concern | Today | File |
|---|---|---|
| Refinement engine | `getTierCap`/`getActiveTierIndex`/`isTierRequiredRealmLevelMet`/`isActiveTierUnlocked`/`investTinhHoa`/`computeBreakthroughGrade`; modifier prefix `luyen-the:` | `src/core/realm/BodyRefinementSystem.ts` |
| Refinement content | `BODY_REFINEMENT_TIERS` (6 tiers: id/cap/stats/percentAtFullTier/requiredRealmLevel), `TINH_HOA_PHAM_THE_MATERIAL_ID` | `src/data/realm/BodyRefinement.ts` |
| Meridian engine | `nextMeridian`/`getOpenedMeridianCount`/`applyMeridianModifiers`/`investThongMachDan(availableDan, thienDiaChiKieuOwned)`; prefix `bat-mach:`; `[M13 STATUS: PARKED]` header | `src/core/realm/MeridianSystem.ts` |
| Meridian content | `MERIDIANS` (9: id/thongMachDanCost/requiredRealmLevel/requiresThienDiaChiKieu/stats/percent), `THONG_MACH_DAN_MATERIAL_ID`, `THIEN_DIA_CHI_KIEU_MATERIAL_ID` | `src/data/realm/Meridians.ts` |
| Invest op | `realmAdvanceOps.investBodyRefinement` — reads `materialBag(TINH_HOA_PHAM_THE)` → engine → `bag.remove(consumed)` | `GameManagerRealmAdvanceOps.ts:421` |
| Auto-invest | tick calls `investBodyRefinement(activePlayer)` every update | `GameManagerTickOps.ts:117` |
| Ritual reads | `computeBreakthroughGrade` → `player.breakthroughGrade`; `bodyRefinementCompletedTiers >= 6` → `mortalPerfectionAchieved` | `GameManagerRealmAdvanceOps.ts:251-258` |
| Grade resolver | `resolveKienCoGrade`: `bodyRefinementCompletedTiers >= EARTH/HEAVEN_BODY_TIERS`, `openedMeridianIds.length >= HEAVEN/GREAT_DAO_MERIDIAN_COUNT` | `src/data/breakthrough/BreakthroughGrades.ts:38-44` |
| Panel | reads `player.bodyRefinementCompletedTiers`/`CurrentTierProgress` + `BODY_REFINEMENT_TIERS` directly | `src/components/panels/LuyenThePanel.vue` |
| Talent input | `getBodyRefinementProgressMultiplier(player.selectedTalentIds)` inside `investTinhHoa` | `src/core/talent/TalentEffects.ts` |
| Sim | `session.gameManager.realmAdvanceOps.investBodyRefinement(player)` | `EarlyGameSession.ts:203` |
| Persisted | `bodyRefinementCompletedTiers`, `bodyRefinementCurrentTierProgress`, `openedMeridianIds` on `PlayerData` | `src/core/player/Player.ts:215-225` |
| Save validation | 2× `requireNonNegativeNumber` + `openedMeridianIds` array-of-strings | `saveShapeValidation.ts:232-233,475-478` |
| Save version | `CURRENT_SAVE_VERSION = 71` | `saveVersion.ts` |

Behavior invariants to preserve (contract-tested): sequential completion order; `requiredRealmLevel` gates pace progress **only while mortal/qi_refining** respectively — after leaving the realm the chapter opens fully (sequential order remains); invest consumes at most the missing amount and returns the amount actually spent (never auto-overflows to the next unit); talent multiplier spends *less* material for the same progress (`ceil(remaining/mult)`); modifiers rebuild idempotently under each prefix; grade = `clamp(completedTiers,1,6)`; meridian last entry additionally requires Thien Dia Chi Kieu ≥1; Dai Dao thresholds unchanged.

## 3. Target design

### 3.1 Module layout (`src/core/realm/body/`)

- `BodyChapter.ts` — the `BodyChapter` contract + `BodyChapterId` union (`'body_refinement' | 'meridian'`), `BodyChapterState` per-chapter state types, the persisted `BodyProgressionState` record, `createDefaultBodyProgression()`, and `BODY_CHAPTERS` registry (definition lookup, iteration order = canonical chapter order).
- `BodyRefinementChapter.ts` — the Luyen The strategy (ports `BodyRefinementSystem` logic).
- `MeridianChapter.ts` — the Bat Mach strategy (ports `MeridianSystem` logic).
- `BodyProgressionSystem.ts` — the single authority: registry access, invest routing, modifier rebuild dispatch, canonical derived-fact reads. Stateless service object (deps live at the ops layer) — same shape as the leaf modules it replaces.

`core/realm/BodyRefinementSystem.ts` and `core/realm/MeridianSystem.ts` are deleted (logic moved, not shimmed — M4 convention).

### 3.2 Persisted state — chapter-keyed

```ts
// PlayerData
bodyProgression: {
  body_refinement: { completedTiers: number; currentTierProgress: number }
  meridian: { openedIds: string[] }
}
```

`createDefaultPlayer` seeds both chapters' zero-state. The three flat fields are removed from `PlayerData` entirely (no dual-write). Save contract → **v72**; v71 payloads rejected.

### 3.3 Chapter contract

Each chapter declares:

- `id`, `modifierPrefix` (`luyen-the:` / `bat-mach:` — preserved byte-identical so modifier ids and any id-keyed tooling stay stable).
- `currency` — the primary invest currency as a channel descriptor `{ bag: 'material' | 'pill'; id }` (`{material, tinh_hoa_pham_the}` for refinement; `{pill, thong_mach_dan}` for meridian — Thong Mach Dan lives in `pillBag` today, NOT `materialBag`), optional `auxCurrency` (`{material, thien_dia_chi_kieu}` — a material). Both bags expose the same `getAmount`/`remove` shape; the ops layer resolves the declared bag.
- `invest(player, available, auxOwned) → consumed` — chapter-owned rule: gates (sequential order, realm-level pace gates, aux-material requirement), talent multiplier (refinement), clamp-to-missing, mutation of its own slice inside `player.bodyProgression`, returns the primary-currency amount actually spent.
- `applyModifiers(player)` — rebuilds its prefix slice of `player.modifiers` from its own slice. The system calls this exactly once after every successful `invest` (consumed > 0) AND on the restore/rehydrate path — `player.modifiers` is a derived projection of chapter state, never a second authority: a persisted modifier that disagrees with chapter state is corrected on rehydration (same re-derive-on-restore convention as M3 authored fields).
- `progress(player) → { completed: number; total: number }` — the canonical progress read (`completed` = finished units: tiers done / meridians opened).
- `isComplete(player)`, plus chapter-specific reads needed by consumers (`activeTierIndex`, `isUnlocked` for refinement's panel).
- `validatePersistedState(slice, basePath, emit)` — chapter-owned structural validation of its own persisted slice (P1-M6 precedent: module-owned validation, save layer only delegates).
- `integrityIssues(player)` — chapter-owned sequential-integrity invariants (member of the pinned §3.7 set), consumed by the BodyProgression-owned preflight entry point.

### 3.4 Canonical derived-fact reads (deferred-resolver seam)

`BodyProgressionSystem` exposes the stable reads `deferred-breakthrough.md` requires:

- `getBodyChapterProgress(player, chapterId) → { completed, total }` — the pinned stable read.
- `getBodyRefinementCompletedTiers(player) → number` — feeds `computeBreakthroughGrade` semantics and `mortalPerfectionAchieved`.
- `getOpenedMeridianCount(player) → number` — feeds `resolveKienCoGrade` thresholds.

Consumers MUST read these — `resolveKienCoGrade`, the ritual snapshot, `computeBreakthroughGrade`, the panel, and save validation all re-point; no consumer may reach into `player.bodyProgression.*` internals (except the system's own strategies and the store's structural restore).

### 3.5 Unified invest

`realmAdvanceOps.investBodyChapter(player, chapterId) → consumed`:

1. Chapter lookup → `currency` descriptor; `available = bagFor(chapter.currency).getAmount(id)` where `bagFor` resolves `materialBag`/`pillBag`; `auxOwned = chapter.auxCurrency ? bagFor(aux).getAmount(aux.id) : 0`.
2. `consumed = chapter.invest(player, available, auxOwned)` — the chapter strategy reads/mutates its own slice inside `player.bodyProgression`.
3. `consumed > 0 → bagFor(chapter.currency).remove(id, consumed)` (aux currency is a gate, not consumed — matches today's `requiresThienDiaChiKieu` semantics) **and `chapter.applyModifiers(player)` runs exactly once** — modifier rebuild is pinned inside the system dispatch, so no invest path can mutate chapter state without refreshing the projection.
4. Returns `consumed` (0 when gated/absent/complete — no mutation, no rebuild needed).

`investBodyRefinement` retires; `GameManagerTickOps` calls `investBodyChapter(player, 'body_refinement')`. Meridian's op path exists and is exercised by tests but stays PARKED for callers (same status as today — no new UI/gateway this mission).

### 3.6 Ritual + resolver re-points

- `computeBreakthroughGrade` ports into the refinement chapter (grade = clamp(completed,1,6)); the ritual calls the chapter/system read.
- `mortalPerfectionAchieved` snapshot reads `getBodyRefinementCompletedTiers >= 6` (field itself stays a PlayerData flag — it is a formula input, not body state).
- `resolveKienCoGrade` reads `getBodyRefinementCompletedTiers`/`getOpenedMeridianCount` — thresholds untouched.
- `LuyenThePanel.vue` re-points to chapter state/progress read (mechanical; IA unchanged, M7 owns structure).
- `EarlyGameSession` re-points to `investBodyChapter`.

### 3.7 Save validation (v72) — BodyProgression-owned, boundary delegates

- **Shape layer:** `player.bodyProgression` required object; per-chapter slice validation is DISPATCHED to the owning chapter's `validatePersistedState` (BodyProgression authority owns its schema — a future chapter adds its own validator, never a save-layer edit; P1-M6 module-owned precedent). Boundary rejects only a missing/non-object `bodyProgression` itself.
- **Integrity layer:** sequential-integrity checks are BodyProgression-owned too (`validateBodyProgressionIntegrity(state) → issues`, chapter-dispatched) and called from `preflightSaveRegistryReferences` — the preflight calls ONE authority entry point, same seam as the M3/M4 contracts, never per-field logic in the save layer. Pinned invariants:
  - `body_refinement.completedTiers`: integer, 0 ≤ n ≤ TOTAL_TIERS.
  - `body_refinement.currentTierProgress`: finite, ≥ 0; when `completedTiers < TOTAL` must be `< activeTier.cap`; when `completedTiers === TOTAL` must be exactly `0` (no active tier remains to hold residue).
  - `meridian.openedIds`: every id a known `MERIDIANS` member (registry-drift → corrupt) AND a strict prefix of the canonical MERIDIANS order (sequential contract).
- **Modifier rehydration:** restore applies `applyModifiers` for every chapter once, rebuilding `luyen-the:`/`bat-mach:` slices from canonical chapter state — persisted modifiers are corrected, not trusted (chapter state is the only authority).
- Flat legacy fields (`bodyRefinement*`/`openedMeridianIds`) inside a v72 payload are ignored like other unknown keys (existing tolerance rule; v71 payloads die at version check before any of this).

## 4. Explicit non-goals

- No meridian UI/gateway (stays PARKED).
- No new chapters, no formula/threshold/balance changes.
- No `LuyenThePanel` IA restructure (M7); no file/panel renames.
- No breakthrough-formula redesign — `resolveKienCoGrade` logic is re-pointed verbatim.
- No `breakthroughGrade`/`mortalPerfectionAchieved`/`greatDaoOpportunityLost`/`luyenKhiKillsSinceBeast`/`highestFoundationAchieved`/`tribulationBonusStacks` field moves — formula inputs stay (deferred-breakthrough.md §2).
- Modifier prefixes unchanged (`luyen-the:`, `bat-mach:`).
- No removal of `data/realm/BodyRefinement.ts`/`Meridians.ts` content files — they become chapter definitions.

## 5. Test plan (summary — plan details)

- Chapter contract tests: ported behavior table (sequential order, realm pace gates, invest clamp/no-overflow, talent multiplier, aux gate, modifier rebuild, progress read, isComplete).
- Derived-fact tests: `getBodyChapterProgress`/count reads from chapter state; `resolveKienCoGrade` produces identical grades for equivalent migrated state (earth/heaven/great_dao thresholds); ritual snapshot + grade via chapter reads.
- Unified invest op tests: material read→invest→remove consumed (refinement live path; meridian path exercised at op level even though caller stays parked).
- Save v72: literal v71 rejection; chapter-state shape validation (missing/malformed chapters, non-prefix `openedIds`, unknown meridian id, out-of-range tiers) — preflight rejections before mutation.
- Round-trip: default + mid-progress + complete states serialize/restore byte-faithful; modifier rebuild identical post-restore.
- Migration sweep: zero production reads of the three retired flat fields; panel renders identical numbers.

## 6. Open questions

None blocking — D4 + deferred-breakthrough.md pin the boundary, material ids, and the stable read signature. `LuyenThePanel` read-source shape (direct chapter-state read vs progress API) is an implementation detail fixed in the plan.
