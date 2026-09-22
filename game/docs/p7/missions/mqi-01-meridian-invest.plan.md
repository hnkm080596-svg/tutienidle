# M-QI-01 — Meridian Invest Wiring — Plan

Spec: `mqi-01-meridian-invest.spec.md` v1 (pending external verdict — plan updated if spec bumps).
Worktree: `.agent-worktrees/mqi-01-meridian-invest` · branch `p7-mqi-01-meridian-invest`.

## Step order (TDD)

### Step 1 — failing component tests (`RealmBodySections.test.ts`, MeridianSection describe)

Extend `mountSection` to optionally provide a real `GameManager` (`new GameManager()` + `catalogOps.registerMaterials/registerPills`, `GAME_MANAGER_KEY`) and a spy `BUMP_STATE_KEY`. Tests (mirroring spec §5):

1. `qi_refining` + sufficient `thong_mach_dan` → `next` row shows enabled invest button; click → `openedIds` grows by one, `pillBag` debited exactly `thongMachDanCost`, row flips `next`→`opened`, `bumpState` called once.
2. Insufficient pill → button `disabled`; forcing `investBodyChapter` anyway returns 0 (already pinned domain-side — component asserts disabled only).
3. In-page-realm pace: `realmLevel < requiredRealmLevel` at `qi_refining` → disabled; `>=` → enabled.
4. `foundation_establishment` (past page realm) → `next` stays enabled when pill sufficient (no pace gate cross-realm).
5. Final meridian: no `thien_dia_chi_kieu` → disabled; with aux → enabled; after invest aux count unchanged.
6. Mortal (locked page) → no button at all.
7. `opened`/`locked` rows never render a button.

Expect all fail initially (no button element exists).

### Step 2 — implementation (`MeridianSection.vue` + locales)

- `useGameManager()` injected; `gameManager.realmAdvanceOps.investBodyChapter(player.$state, 'meridian')` on click; `bumpState()` iff `consumed > 0`.
- Row view gains `canInvest` + `owned` fields inside the existing `stateVersion`-gated `pageViews` computed (bag reads are non-reactive — same precedent as `BuildingConstructionGate`).
- `canInvest` mirrors chapter preconditions (pill ≥ cost, pace, aux ≥ 1); button only rendered on `next` rows (which already only appear on unlocked pages).
- `GameButton` (`size="sm"`), label `panels.realm.meridian.invest` ("Mở Mạch" / "Open Meridian"), owned-hint `panels.realm.meridian.owned` ("sở hữu {count}").
- Header comment: drop the "M13-PARKED — no Thong Mach Dan gateway" note; record QI-D1 manual-invest ownership (button = presentation, chapter = authority).
- External-review Low: sync stale PARKED/no-caller comments — `MeridianChapter.ts:5-7` ("no production caller") and `MeridianChapter.test.ts:14-17` (same claim) become false once this lands. Comment-only, English/ASCII per P15.
- i18n keys en+vi.

### Step 3 — verification

- `npm run type-check`
- `npx vitest run src/components/panels/realm src/core/game/GameManager.bodyChapter.test.ts src/core/realm`
- Tick regression: `App.wiring` / tick-ops tests stay green untouched (meridian NOT tick-bound).
- Gates: P18 OCR → P4 adversarial QA → P5 sequential passes (≥3) → external impl review → merge + ledger.

## Explicit non-changes

`MeridianChapter.ts` logic (comment-sync only), `MeridianPages.ts`, `BodyProgressionSystem`, `GameManagerRealmAdvanceOps`, `GameManagerTickOps`, `Meridians.ts` data, save shape — no logic/domain changes. Any discovered need for a production-side dry-check is a reported finding, not a silent addition.
