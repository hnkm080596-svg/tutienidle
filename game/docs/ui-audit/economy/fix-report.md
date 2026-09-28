# Economy Slice — Fix Report

**Branch:** `devin/ui-fix-economy` · **Fix commit:** `920dd826` (+ this report) · **Baseline report:** `game/docs/ui-audit/economy/report.md` on `origin/devin/ui-audit-report`
**Verify:** `npm run type-check` clean; `npx vitest run` on touched scopes — 36/36 pass (`VendorPanel`, `DecomposeTab`, `ChiHienQuan.integration`, `bag-sections`). Runtime evidence: before/after JPEGs in `game/docs/ui-audit/economy/fixed/` (dev server, seeded Trúc Cơ guest save).
**QA gate (P4):** `game/docs/qa/2026-09-28-economy-ui-fixes-quick.md` — verdict PASS WITH GAPS; one real defect found and fixed (INV-ECON-1, qty clamp); INV-ECON-3 / INV-UI-4 accepted as Low mirror-drift residuals.

## Findings — dispositions

### Critical — none reported in this slice.

### High

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| H1 | No currency HUD — Linh Thạch balance invisible | **FIXED** | New `CurrencyHud.vue` mounted in `GameRoot.vue` inside the non-fullscene overlay (z 9, under panels, hidden in combat). Chips: one per held spirit-stone tier (fallback lowest at 0), Duyên Phận (companion-domain gated), Chiêu Hiến Lệnh (same gate). `aria-label` localized. Shot: `fixed/h1-currency-hud.jpg`, `fixed/bag-leftpanel.jpg`. |
| H2 | Vendor "Bán hết": no qty, no preview, no confirm, no toast | **FIXED** | `VendorPanel.vue`: per-row qty input (clamped 1..owned), live `→ +{total} {stone}` preview, `ConfirmModal` when qty == whole stack, success loot toast `Đã bán N × name — nhận Y Linh Thạch`. Warn-path toasts preserved. Shots: `fixed/h2-vendor-qty-preview.jpg`, `fixed/h2-vendor-confirm.jpg`. Tests updated. |
| H3 | Chiêu Mộ + Đổi Duyên Phận dead-end honesty | **FIXED** | Verified gate in code: `poolEnabled = false` for all pools in current build (feature-flagged off; QuestSystem does award `chieu_hien_lenh` + duyenPhan). Chose "visibly mark disabled-with-reason" path: pooled stat chips (token/pity) get `chieu-mo__status--parked` dashed/muted styling, and `chieuMo.unavailable`/`duyenPhan.unavailable` copy now explains currency still accumulates for a later version. Shots: `fixed/h3-chieumo-parked.jpg`, `fixed/h3-duyenphan-parked.jpg`. Integration test green. |
| H4 | Building header 404 art + dark-on-dark titles | **FIXED** | Confirmed: `artPath` pointed at `dong-fu/<id>.png` (404 — real assets live under `dong-fu/v2/<id>/base.png`). Now points to v2 `base.png` (all 6 mapped buildings verified on disk) + `artBroken` @error fallback hides img if a future asset is missing. Title/cost/upgrade text moved to `--surface-text`/`--surface-text-muted` tokens. Shot: `fixed/h4-building-header.jpg`. |

### Medium

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| M1 | `en` locale unreachable + data strings untranslated | **FIXED (scope)** / **DEFERRED (rest)** | Added `en.json` strings for every new/changed key I introduced (vendor sell.*, quest rewards/bagShortfall, decompose hint/matching, chieuMo/duyenPhan unavailable, bag.pill useHint/used, alchemy outcome*, currencyHud.aria, quaTang.context). Data-layer names (materials/buildings/quests) remain Vietnamese — that is a data-model i18n decision, not a one-line fix; flagged to coordinator. No switcher added. |
| M2 | Pill: click consumes instantly; no success feedback; `+3.0%%` tooltip | **FIXED** | `PillBagSection.vue`: tooltip now has a `Click để dùng` hint section; consumption is a two-click arm (4s timeout, selected ring via `interaction:'selected'` SlotView state, auto-disarm on unmount); success pushes `bag.pill.used` loot toast. `%%` bug fixed — `formatStat` already appends `%`. Shots: `fixed/m2-pill-bag.jpg`, `fixed/m2-pill-armed.jpg`. |
| M3 | Material icons are letter fallbacks (incl. "H" for Linh Thạch) | **FIXED (partial)** | `MaterialBagSection.vue`: `CATEGORY_ACCENT` map tints the monogram disc + glyph per material category (herb/wood/ore/core/stone/essence/byproduct) — adjacent letters are now visually distinguishable and currency reads as gold. True per-material art is asset work → deferred to data slice. Shot: `fixed/m3-material-bag.jpg`. |
| M4 | Alchemy: disabled button label unreadable + confusing yield copy | **FIXED** | `AlchemyView.vue`: `brewBlockReason` computed surfaces the blocking reason (`missing_herb`/`job_slots_full`/`missing_fuel_wood`/`missing_spirit_stone`) as a `--cinnabar` line under the button; yield copy split into `outcomeGuaranteed` / `outcomeChanceOnly` / `outcomeNone` so "Chắc chắn 0 viên" never renders. Shot: `fixed/m4-alchemy.jpg`. |
| M5 | Phân Giải empty state — no guidance | **FIXED** | `DecomposeSystem.listMatchingOres()` (read-only) + `DecomposeTab.vue`: priority hint (`noCapacity` → `noWorkers` → `noMatchingOres`) and a live "matching ores" chip list when the tab can run. Shot: `fixed/m5-decompose-guidance.jpg`. Test fixture gained a real `MaterialRegistry`. |
| M6 | Quest: no reward preview; dup names; hidden claim condition | **FIXED** | `QuestPanel.vue`: reward chips (stones/cultivation/insight + itemDrops filtered through the same `ReleasePolicy` predicates claim uses); `collectShortfall` shows `Còn thiếu: x/y` on the row when bag contents block claiming; once-quest renamed `Dự Trữ Tụ Linh Thảo` to disambiguate. Shot: `fixed/m6-quest-rewards.jpg`. |
| M7 | Standalone panels (Nhiệm Vụ, Đồng Đội) have no close button | **FIXED** | Ghost `panels.common.close` GameButton in `#header-actions` of `QuestPanel.vue` + `CompanionPanel.vue` (shared affordance per mission rules). Shot: `fixed/m7-companion-close.jpg`. |
| M8 | Vendor description promises exchange/convert that doesn't exist | **FIXED** | `buildings.ts` description now: "Nơi bán nguyên liệu dư thừa lấy Linh Thạch theo phẩm cảnh giới hiện hành." |

### Low

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| L1 | Dark-on-dark serif pattern across screens | **PARTIALLY FIXED / DEFERRED** | Building-panel portion fixed under H4. Remaining instances (wash/temper empty-states, offline modal title, companion skill names) sit in screens owned by other slices or need a token-level audit — deferred. |
| L2 | Empty equipment slots unlabeled; "T" grade badge unexplained | **DEFERRED** | Requires slot-label design + grade legend; not one-line. Character/equipment-hall surface. |
| L3 | Command wheel clip / "Trận" label / vendor not on wheel | **DEFERRED** | Navigation/wheel owned by another slice; cross-referenced for that fixer. |
| L4 | Quà Tặng: no pending-gift badge; gift rows lack context | **FIXED (context) / DEFERRED (badge)** | `QuaTangTab.vue`: rows now show the grant context (`realmEntered`/`stageCompleted` from `COMPANION_GIFT_MOMENTS`). Shot: `fixed/low-quatang-context.jpg`. Tab/map badge needs new event plumbing — deferred. |
| L5 | Production placeholder icons + silent claim | **DEFERRED** | Icon assets + claim-summary plumbing; larger than one line. |

### Nit

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| N1 | Offline modal only lists Linh lực | **DEFERRED** | Offline-summary composition owned by meta/progression surface; needs per-domain settlement reporting. |
| N2 | "hạ/đơn vị" unit unclear | **FIXED** | `panels.vendor.sell.unitPriceSuffix` now `Linh Thạch/đơn vị` (vi) / `Spirit Stones/unit` (en). |
| N3 | No scrollbar affordance on left panel | **DEFERRED** | `scrollfade` styling exists; persistent scrollbar indicator is a shared-panel change owned elsewhere. |
| N4 | Companion "C0/C1–C6" cryptic | **DEFERRED** | Needs copy/legend design for Cung Mệnh ranks. |

## P5 review passes (chronological)

**Pass 1 — Local Correctness** (after staging full diff, `/tmp/economy-diff.txt`, 1686 lines):
- CONFIRMED+FIXED: `onQtyInput` clamped to `Math.max(0, …)` — input could display 0 while `qtyFor` sold 1 (INV-ECON-1 from P4). Raised to `Math.max(1, …)`; type-check + scoped vitest re-run green.
- CONFIRMED+FIXED: `outcomeChanceOnly` rendered "0% nhận 0 viên" when `guaranteedPills==0 && extraPillChance==0`. Added `alchemy.outcomeNone` branch + both locales.
- REJECTED: rewardChips could hide non-material/pill drops — `Quest.reward.itemDrops` type is `'material' | 'pill'` only; covered.
- REJECTED: `confirmAllRow` use-after-close — ConfirmModal/component unmount drops the ref with it.
- REJECTED: giftContext recordId mismatch — IDs keyed by `COMPANION_GIFT_MOMENTS[].id`, resolved via `.find`.

**Pass 2 — Architecture / Ownership** (post-Pass-1 state):
- A7 presentation-observes: CurrencyHud/DecomposeTab read via stores + `catalogOps`/`listMatchingOres`; only mutation paths are the pre-existing `sell()`/`drinkPill()`/`collect` actions. Single new core method is read-only (`listMatchingOres` maps `bag.getAll` through existing `oreMatchesFilter`).
- A9 single implementation: quest chips reuse `ReleasePolicy` predicates; vendor sell uses existing `economyOps.sellMaterialToVendor`; brewBlockReason is a diagnostic mirror of `canBrew` ordering — documented residual (INV-ECON-3) since domain exposes no reason channel.
- Seam: `useBagPagination<T extends BagCell>` generic is backwards compatible; `useBuildingHeaderState` comment records the v2-asset convention.
- No production edits outside slice ownership; locale keys added under existing namespaces.

**Pass 3 — Adversarial Integration**:
- SlotView contract: `interaction:'selected'` is a valid `SlotPresentationState` (`showSelected` gate verified in `SlotView.vue`).
- `alchemy.reason.*` keys resolve for every `brewBlockReason` value (vi+en).
- `chieu-mo__status--parked` applied only when `!poolEnabled`; ChiHienQuan integration test asserts new copy (`Chưa mở trong bản hiện tại` + `Quà Tặng` markers) — green.
- ConfirmModal teleport-to-body stacking over overlay panel verified in `h2-vendor-confirm.jpg` runtime shot.
- No Medium+ defect surfaced on this pass → no additional pass forced.

## Remaining risks (top)

1. **Currency HUD vs. narrow widths** — chips stack under `top-3 left-3`; on very narrow windows they could overlap the left-panel edge. Mitigated by compact chip styling; not exercised at 320px.
2. **brewBlockReason mirror drift** — duplicates `canBrew` check order for diagnosis (accepted residual INV-ECON-3); if alchemy gating grows, both sides must change together.
3. **Data-layer i18n** — en locale covers UI chrome only; material/building/quest names stay Vietnamese (M1 scope note).
