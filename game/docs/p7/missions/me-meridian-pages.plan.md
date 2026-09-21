# M-E — Meridian Page Model — Plan

Spec: `me-meridian-pages.spec.md` (v2, post-review). Decision D2. Worktree `.agent-worktrees/me-meridian-pages`, branch `feat/me-meridian-pages`.

## Task card (G0)

- **Responsibility:** make the meridian chapter's per-realm page structure explicit — one page per realm, monotonic unlock, never re-locks; mortal investment becomes structurally impossible.
- **Owner:** `data/realm/Meridians.ts` (data), `core/realm/body/MeridianPages.ts` (predicate+grouping, new), `MeridianChapter.ts` (gate), `MeridianSection.vue` (render).
- **Chain:** `MeridianDefinition.pageRealmId` → `isMeridianPageUnlocked`/`listMeridianPages` → `invest` gate order (cost → page-lock → page-pace → aux) → UI paged rendering.
- **Non-goals:** new content, balance, M13 invest caller, save changes, BodyRefinement (D1/M-F).

## Steps

1. **Data:** `MeridianDefinition.pageRealmId: string`; assign `'qi_refining'` to all 9.
2. **MeridianPages.ts:** `isMeridianPageUnlocked(player, pageRealmId)` — realm-index ≥, **fail-closed** when either index is -1 — + `listMeridianPages(defs?)` → `{ pageRealmId, meridians: { meridian, flatIndex }[] }` (flatIndex owned by the projection).
3. **Chapter:** `invest()` — page-lock check (step 2) before pace check; pace check keyed on `next.pageRealmId`. `integrityIssues()` — cross-field invariant: opened meridian on a page locked at `player.realmId` → issue (restore preflight rejects the impossible state).
4. **UI:** `MeridianSection` — derive pages; locked page → gate label + all rows `locked`, no `next`; unlocked page → current row semantics; pace label only while `player.realmId === page.pageRealmId`.
5. **Tests (TDD order — red first):**
   - `MeridianPages.test.ts` (new): unlock monotonicity (mortal→false, qi_refining+→true, never re-locks), fail-closed unknown ids, grouping preserves order + flatIndex, page-order authoring invariant (non-decreasing realm index), fabricated two-page characterization.
   - `MeridianChapter.test.ts`: mortal invest → 0 even with materials (new finding coverage); qi_refining pace gate unchanged; foundation invest allowed by sequence+aux; integrity flags opened-on-locked-page.
   - `BodyProgressionSystem.test.ts`: legit progress fixtures re-realed to qi_refining (mortal+opened now corrupt).
   - Section/component test: mortal renders locked-preview (no `next`), foundation suppresses pace label.
6. **Gates:** type-check, focused vitest (realm/body + components), OCR, P14 browser (UI surface changed — RealmPanel at mortal vs qi_refining), adversarial QA (quick), P5 passes, external impl review, merge.

## Risks / watch

- `getRealmIndex` on an unknown `pageRealmId` OR `player.realmId` — fail closed (both indices must resolve); data-invariant test asserts every `pageRealmId` resolves a real realm.
- `requiredRealmLevel` label must not render cross-realm (foundation player sees no "Luyện Khí tầng X" text).
- Realm label lookup must not throw on an unresolved page id — `REALMS.find` + raw-id fallback, not `getCurrentRealm` (which throws).
- i18n: `realmGate` parameterized to `{realm} tầng {level}` (was hardcoded Luyện Khí); new `pageLocked` key in vi+en.
