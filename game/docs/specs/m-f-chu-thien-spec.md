# M-F-CHU-THIEN — Trúc Cơ Chu Thiên Body Chapter — Spec

Status: v1 — draft (worker-authored, pending C2C spec review)
Depends on: M-F-BODY-CORE (BodyChapter contract + registry + state
slice — merged on `p7/truc-co`), M-QI-09 (essence substitution at the
invest seam — `BodyChapterEssenceSubstitution`), M-QI-10 (Pháp
essence material `tinh_hoa_phap_the`, live on the TC band), M-F-ESSENCE
(persisted-shape contract + derived-grade seam — this mission owns the
registry/state/save-version tail assignments per its sec.3.4).

Mission-graph scope: the third Body chapter — `zhou_tian` (Chu Thiên
circulation), the Trúc Cơ normal-Body track — plus the authored
sequential-unlock mechanism it introduces, and the TC-side currency
mechanism it exercises.

Ruling (coordinator, §20–21/§25, verbatim in mission prompt):
TC normal Body = Chu Thiên circulation; 20 capacity per minor level;
180 = Tiểu Chu Thiên (Lv9), 360 = Đại Chu Thiên (Lv18) = normal
completion; 361–365 CANCELLED; chapters sequential (A normal → B may
unlock when realm permits).

## 1. Intent

- A new `zhou_tian` Body chapter kind joins the canonical registry
  (`BodyChapterId`, `BODY_CHAPTERS`, `BODY_CHAPTER_BY_ID`) as the third
  and last entry, after `body_refinement` then `meridian`.
- The chapter tracks **circulation** — one scalar counter bounded by a
  realm-derived capacity: `20 × realmLevel` while the player's realm is
  `foundation_establishment` (TC L9 → 180 = Tiểu Chu Thiên; TC L18 →
  360 = Đại Chu Thiên = normal completion). Pre-TC realms have capacity
  0 (chapter locked); post-TC realms cap at 360 (meridian-page
  convention: content ceiling cannot be exceeded after exit).
- **Milestone flags are derived reads, never persisted flags** — Tiểu
  (`circulation >= 180`) and Đại (`circulation >= 360` ≡ complete) are
  computed off the sole authority `circulation` (A3: no duplicated
  state; a persisted flag could disagree with the counter). (C2C flag:
  the delta says "milestone flags" — this spec reads them as derived
  predicates, the convention already used for meridian page locks and
  refinement tier reads.)
- **Sequential unlock is an authored contract, not a positional
  assumption**: `BodyChapterShared` gains an optional
  `unlocksAfterChapters: readonly BodyChapterId[]` field — chapter is
  locked for invest while any listed chapter is incomplete. zhou_tian
  authors `['body_refinement', 'meridian']` — ALL chapters earlier in
  the canonical registry order (Body progression is sequential by
  design; the ruling's A→B chain is read as the full earlier set). (C2C
  flag: a narrower reading — only the immediate predecessor
  `['meridian']`, or none since LQ meridian today gates on nothing —
  is mechanically identical; the authored list is the only difference.)
- Currency: **candidate** `tinh_hoa_phap_the` (Pháp essence, bag
  `material`) per §38 — wired through the existing
  `BodyChapterCurrency` typed seam so `investBodyChapter`'s M-QI-09
  substitution path (`planEssenceSubstitution`) works unchanged. Pháp
  has coverage 0 in the triangle (top rung) → exact debit only, no
  substitution fill and no change-back; the seam proves it on a real
  chapter. Currency CHOICE is content/balance and deferred — the
  mechanism is the mission.
- Invest is capacity-bounded and idempotent: `consumed = min(available,
  capacity − circulation)`; `circulation += consumed`. No per-invest
  amount, cost curve, or batching (balance deferred — mechanism only).
- Emission kind: **`'baseStat'`** — the M-F-BODY-CORE contract comment
  names "CHU-THIEN values" as riding `collectBaseStatDeltas`
  (BodyChapter.ts:129-138). `collectBaseStatDeltas` returns `{}` for
  now — the typed channel is wired; magnitudes are deferred to a
  balance pass (scope limit: no stat values). `legacyModifierPrefix:
  'zhou-tian:'` reserves the legacy-scrub namespace (mirrors
  refinement; currently no-op).
- `physiqueAdvancement` NOT authored — circulation vs. physique grade
  coupling is a product ruling not yet given; the declared-field seam
  stays for a future mission.
- UI: one new `ZhouTianSection.vue` row in `RealmPanel`'s
  `.realm-panel__body` grid beside refinement/meridian — existing Body
  panel row pattern (summary line, capacity bar with Tiểu/Đại
  milestone markers, lock states, manual invest button + owned count —
  the MeridianSection invest pattern). No theme/UI-system work
  (M-UI-SYSTEM owns that).
- Tick auto-invest is NOT wired (`GameManagerTickOps` auto-invests
  `body_refinement` only). Whether Chu Thiên drains each world tick is
  a product/balance ruling not given; manual invest via the UI row
  keeps the mechanism in scope. (C2C flag.)

## 2. Authored data + canonical state

`data/realm/ZhouTian.ts` (new) — data/constants only:

```ts
export const ZHOU_TIAN_REALM_ID = 'foundation_establishment'
export const ZHOU_TIAN_CAPACITY_PER_REALM_LEVEL = 20
export const ZHOU_TIAN_TIEU_CIRCULATION = 180   // Tiểu Chu Thiên (Lv9)
export const ZHOU_TIAN_DAI_CIRCULATION = 360    // Đại Chu Thiên (Lv18) = normal completion
export const TINH_HOA_PHAP_THE_MATERIAL_ID = 'tinh_hoa_phap_the'
```

`bodyProgression.zhou_tian` slice (persisted):

```ts
export interface ZhouTianChapterState {
  circulation: number;   // integer, 0..360, <= current capacity
}
```

- Persisted field is `circulation` only — capacity, milestones, lock
  state are all derived. `createDefaultBodyProgression` gains
  `{ zhou_tian: { circulation: 0 } }`.
- `expectedBodyProgressionCompleteness` (registry check) accepts the
  slice automatically through `BODY_CHAPTERS`; `BODY_CHAPTER_BY_ID`
  gains the lookup.

## 3. Capacity + milestones

`ZhouTianChapter.ts` (new, beside `BodyRefinementChapter.ts` /
`MeridianChapter.ts`) exports the canonical reads — pure helpers in
the chapter file, mirroring the refinement convention:

```ts
getZhouTianCapacity(player): number
// realmIndex < index(TC) -> 0
// realmId === 'foundation_establishment' -> 20 * realmLevel
// realmIndex > index(TC) -> 360

isTieuChuThienReached(player): boolean   // circulation >= 180
isDaiChuThienReached(player): boolean    // circulation >= 360 (== isComplete)
```

- Capacity is derived from live player state at read time — never
  cached, never persisted.
- `isComplete` = `circulation >= 360`. `361+` is impossible by
  construction: invest clamps at capacity (≤ 360), `integrityIssues`
  reports `circulation > 360` or `circulation > capacity` as corrupt,
  `validatePersistedState` rejects non-integer/negative circulation.
  (The ruling's cancelled 361–365 band simply never exists — the 360
  ceiling IS the completion cap.)

## 4. Sequential unlock mechanism

Contract + enforcement:

- `BodyChapterShared` gains `unlocksAfterChapters?: readonly
  BodyChapterId[]` — absent = no sequential gate (refinement, meridian
  stay unchanged).
- `investBodyChapterState` (BodyProgressionSystem) checks it BEFORE
  the physique source-grade gate: while any listed chapter's
  `isComplete(player)` is false, invest returns 0 (same silent
  no-op convention as the existing gates).
- `isBodyChapterUnlocked(player, chapterId)` — exported canonical
  read for UI mirror (all listed chapters complete, or field absent).
- Registry validation (`validateBodyChapterRegistry`) pins the
  sequential invariant: every listed ref must resolve to a registered
  chapter id sitting STRICTLY EARLIER than the declaring chapter in
  catalog order (backward-only) — no self, no forward refs, no unknown
  ids; cycles impossible by construction, and canonical order stays
  the sequencing authority.
- zhou_tian authors `['body_refinement', 'meridian']`.

## 5. Currency + invest path

- `currency: { bag: 'material', id: 'tinh_hoa_phap_the' }`. No
  `auxCurrency`.
- `investBodyChapter` (GameManagerRealmAdvanceOps:518-598) needs ZERO
  changes: `bodyChapterEssenceGrade` resolves 'phap'; top-rung
  coverage 0 → `planEssenceSubstitution` returns the exact-Pháp debit;
  under-owned shortfall → partial invest of only what exists (existing
  partial-invest convention), no change-back, no cross-band fill.
- The chapter `invest` mutates only `state.circulation` (clamped at
  capacity); `applyPhysiqueAdvancement`/`applyChapterEffect` run on
  `consumed > 0` per the existing dispatch (baseStat →
  `scrubLegacyModifiers`).
- Idempotent: at capacity or post-completion, invest returns 0; the
  ops seam's `consumed > 0` probe/commit keeps "invest with 0 effect"
  a no-op end-to-end.
- `EarlyGameSession` not touched (TC-side chapter, outside its sim
  window).

## 6. Registry + emission

- `BodyChapterId` union gains `'zhou_tian'` (mission owns the
  extension per m-f-essence sec.3.4).
- `EXPECTED_BODY_CHAPTER_KIND` gains `zhou_tian: 'zhou_tian'`
  (delta 5 — kind pre-declared in `BODY_CHAPTER_KINDS`).
- `BODY_CHAPTERS` appends the definition — registry iteration order
  remains the canonical chapter order (BodyChapter.ts:192).
- `collectBaseStatDeltas` returns `{}` (wired, empty). `progress()`
  returns `{ completed: circulation, total: 360 }`.
- `integrityIssues(player, state)`: `circulation` integer in
  `[0, 360]` and `<= getZhouTianCapacity(player)`.
- `validatePersistedState(raw)`: object slice, `circulation` number —
  dispatched by `validateBodyProgressionPersistedState` from the
  save-shape seam (saveShapeValidation.ts:729 delegates; it picks the
  chapter up automatically). `GameManagerSaveRestore` integrity
  preflight picks it up through `assertBodyProgressionIntegrity`
  (BodyProgressionSystem.ts:222-271 iterates the registry).

## 7. UI — ZhouTianSection

New `components/panels/realm/ZhouTianSection.vue`, mounted as a third
`.realm-panel__body` column in `RealmPanel.vue` (existing grid —
columns stretch per panel). States:

- `locked`: `!isBodyChapterUnlocked` — names the incomplete earlier
  chapter(s) (sequential gate reason).
- `realm-locked`: realmIndex < TC (capacity 0) — mirrors meridian's
  page-lock treatment.
- `active`: capacity bar `circulation / capacity` with Tiểu (180) and
  Đại (360) milestone markers + invest row.
- `complete`: Đại Chu Thiên reached (circulation 360).

Invest row mirrors MeridianSection: manual button disabled unless
unlocked && circulation < capacity && owned ≥ 1, with owned count
label; calls `realmAdvanceOps.investBodyChapter(player, 'zhou_tian')`
then `bumpState()` — the A3 render-loop convention both existing
sections use. i18n keys under `panels.realm.zhouTian.*` in en + vi
(i18nKeyParity guard applies).

## 8. Save contract

- `CURRENT_SAVE_VERSION 76 → 77` — dev-phase convention: bump = reject,
  no translator (QI-S). Changelog comment in `saveVersion.ts` per the
  v65-v76 pattern.
- A v76-shaped payload (no `zhou_tian` slice) is rejected by the
  delegated persisted-state validator at
  `player.bodyProgression.zhou_tian` — the slice is required-present
  like every chapter slice.
- No registry-reference preflight changes needed (delegate path
  covers the new chapter through `BODY_CHAPTERS`).

## 9. Consistency invariants

- `0 <= circulation <= 360`, integer; `circulation <=
  getZhouTianCapacity(player)` at all times (capacity-360 ceiling
  makes 361+ unreachable).
- Tiểu iff `circulation >= 180`; Đại iff `circulation >= 360`;
  complete iff Đại.
- Pre-TC invest always returns 0 (capacity 0); locked-by-sequence
  invest always returns 0; invest otherwise consumes the lesser of
  essence-on-hand and remaining capacity.
- `player.bodyProgression` key set = exactly the registry ids (now
  three) — enforced by `expectedBodyProgressionCompleteness` +
  `assertBodyProgressionIntegrity`.
- No persisted milestone/lock/capacity state anywhere.

## 10. Out of scope (restated)

- Invest cost curve, per-invest amounts, batch size (balance pass).
- `collectBaseStatDeltas` magnitudes / any stat values (balance pass).
- Currency choice finalization beyond the §38 candidate mechanism.
- `physiqueAdvancement` coupling, tick auto-invest wiring.
- Content beyond the chapter itself; UI redesign / M-UI-SYSTEM theme.
- Save migration (v77 rejects v76).

## 11. Acceptance

| # | Acceptance |
|---|---|
| A1 | `BodyChapterId`/`BODY_CHAPTERS`/`BODY_CHAPTER_BY_ID` carry `zhou_tian`; `EXPECTED_BODY_CHAPTER_KIND.zhou_tian === 'zhou_tian'`; defaults + slice validation cover `bodyProgression.zhou_tian`. |
| A2 | Capacity = 0 pre-TC, `20 × realmLevel` in TC, 360 post-TC; invest consumes `min(available, capacity − circulation)` and never exceeds 360; `isComplete` iff 360. |
| A3 | `unlocksAfterChapters` field enforced at `investBodyChapterState` + `isBodyChapterUnlocked` read; zhou_tian locked until body_refinement + meridian complete; registry validation rejects self/forward/unknown refs. |
| A4 | Pháp essence path through the real chapter: exact `tinh_hoa_phap_the` debit (coverage 0, no substitution fill, no change-back); under-owned → partial invest of owned amount only; bag consumed only on success. |
| A5 | Tiểu/Đại derived reads at 180/360; `progress()` = `{circulation, 360}`; `collectBaseStatDeltas` returns `{}`; no physique advancement declared. |
| A6 | UI row renders locked (sequential + realm) / active / complete states; invest button + owned label wired through the ops seam; i18n keys en + vi. |
| A7 | Save v77; v76 payloads rejected; persisted-shape validation covers the slice (missing/non-object/non-number circulation all reject); `circulation > 360` or `> capacity` = corrupt. |
| A8 | Idempotency: invest at capacity or complete returns 0 and debits nothing; repeated `validatePersistedState`/integrity runs never throw on legal states. |
