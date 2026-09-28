# Progression slice — fix report

Branch: `devin/ui-fix-progression`
Verified with: `npm run type-check` (clean), `npx vitest run` on touched scopes (RealmPanel, BreakthroughRequirementPanel, NodeTreePanel — 34 tests, green), `eslint` on touched files (0 errors), P18 `ocr delegate` checklist (reasoned, no violations), and a Playwright evidence pass `tests/e2e/ui-audit-progression-fixed.spec.ts` that walks the fixed screens end-to-end and captures `fixed/*.jpg` at 1280x800.

## FIXED

### [Critical] Quán Khí disabled with zero requirement info at mortal realm
`RealmPanel.vue` gated requirement rows on `!isCurrentRealmMortal`, so the `level` row `getBreakthroughRequirements` already returns ("Phàm Nhân tầng 12") was suppressed exactly when the player needed it. Removed the mortal suppression; the row now renders for all realms. Evidence: `fixed/04-realm-panel-mortal.jpg` (✗ row at Tầng 1), `fixed/06-realm-lv12-ready.jpg` (✓ row, enabled button). Regression test updated in `RealmPanel.test.ts`.

### [High] Quán Khí path ritual offers an irreversible choice with zero information
`QuanKhiPanel.vue` rendered three identical crimson `Bước Vào …` buttons. Each choice button now carries the way's path description (`panels.quanKhi.pathDescriptions.*`, vi + en) plus an initiation-kit line (`pathSelection.kit`, derived from `sealedKitSkillNames`). Evidence: `fixed/13-quankhi-path-panel.jpg` — three cards with distinct name + description + kit.

### [High] Tribulation title watermark collides with the question card
`TribulationSceneOverlay.vue`: `.tribulation-ui__mind` top 16% → 26% so the card clears the THIÊN KIẾP / Tâm Ma Kiếp title band. Confirmed `__mind` and `__result` are mutually exclusive before moving the card. Evidence: `fixed/12-tribulation-mind.jpg`.

### [High] Node tree auto-fits to ~40% zoom — node text unreadable
`NodeTreePanel.vue`: added `FIT_ZOOM_MIN = 0.65` floor on the auto-fit (max stays `ZOOM_MAX`), with `rawFitZoom` kept so panning still enables when the floor holds zoom above the true fit ratio. Also surfaced `Cảm Ngộ` points in the panel header. Evidence: `fixed/21-tree-default-zoom.jpg` (65% floor).

### [Medium] Cultivation bar shows no rate and no ETA
`RealmPanel.vue`: new `realm-panel__cultivation-meta` line `+{rate} Tu Vi/giây · còn ~{eta}` under the cultivation bar, using `player.cultivationPerSecond` + `formatDuration`. Evidence: `fixed/04-realm-panel-mortal.jpg`, `fixed/18-realm-panel-qi.jpg`.

### [Medium] Locked stage floors selectable; "Bắt Đầu" dead with no reason
`StageSelectPanel.vue`: locked floor tiles get a 🔒 badge and a reason tooltip via new `stageLockReason()` (realm gate → "Cần {realm} tầng {level}", chain gate → "Hoàn thành Tầng {floor} trước"); the detail pane shows `stage-select__locked-hint` in crimson for a locked selection. Evidence: `fixed/22-stage-select.jpg` (badges), `fixed/23-stage-locked-detail.jpg` ("Hoàn thành Tầng 1 trước").

### [Medium] Combat top-bar leaks unrounded HP float (107/111.24000…)
`TurnOrderStrip.vue` line 129: member HP now `formatNumber(Math.max(0, Math.ceil(currentHp)))` / `formatNumber(Math.max(0, Math.round(maxHp)))` — the shared `formatNumber` helper (grouping + no decimals), applied at the render site since no separate shared HP formatter exists. Evidence: `fixed/27-battle-topbar.jpg` ("112/111"); the spec also asserts no `.NNNN` float tails in any `.turn-order-strip__member-hp` row.

### [Medium] Realm ladder has no "you are here" for Phàm Nhân; terminology mixes
`RealmPanel.vue`: the node track prepends the real mortal home node (`{ realmId: 'mortal', label: 'Phàm Nhân', unlockTier: getRealmTier('mortal') }`) ahead of `REALM_PASSIVE_NODES`, with state labels `Đang tu hành` / `Đã đạt` / `Chưa mở` / `Sắp ra mắt` (`nodes.current`, `nodes.unlocked` added to vi/en). Evidence: `fixed/04` (node 0 "Đang tu hành"), `fixed/18` (node 0 "Đã đạt", node 1 "Đang tu hành").

### [Medium] Floor-description tooltip overlaps the detail pane's own description
`StageSelectPanel.vue`: locked-floor tooltips now show `stageLockReason()` instead of re-showing the description; unlocked tiles keep the description tooltip and the selected tile's tooltip is suppressed (it is already rendered in the detail pane).

### [Low] Equipment warning shows even with nothing equipped
`BreakthroughRequirementPanel.vue`: the "still equipped" subtitle is now `v-if="hasEquippedGear"` via `equipmentBag.getEquipped()`. Evidence: `fixed/07-breakthrough-confirm.jpg` (warning absent on a gear-less save). Tests updated + new "hidden with no gear" case in `BreakthroughRequirementPanel.test.ts`.

### [Low] Node tree chrome mixes languages
`vi.json`: `nodeTree.title` → "Cây Kỹ Năng", `respec.title` → "Đặt Lại Cây Kỹ Năng"; `SkillPathPanel.vue` header pill now `✦ Cảm Ngộ: N` via `panels.nodeTree.labels.insight`.

## REJECTED

None — every owned Critical/High/Medium reproduced in code and (via the Playwright pass) at runtime.

## DEFERRED / out of slice

- [High] Combat right dock dead void — combat slice owns dock/slot layout.
- [Medium] Command wheel bottom slot clips below viewport — wheel chrome, other slice.
- [Medium] Talent cards leak English dev tags — entitlement copy, other slice.
- [Medium] No close affordance on overlay panels — shared chrome, other slice.
- [Medium] EN locale unreachable — locale switcher, other slice.
- [Low] Victory announcement overlaps QuanKhiPanel — announcement is click-to-dismiss and transient; stacking the two panels is a shared-overlay concern, deferred.
- [Low] Combat AI panel permanent overlay; bare `Thủ công` checkbox; AutoFarmIndicator contrast — combat slice.
- [Nit] Confirm modal chrome differs from parent panel — `ConfirmModal` rides `SysModalBase` (system chrome); giving it an `ink` variant is a shared component change beyond one line.
- [Nit] Stray empty separator at bottom of realm node track — inspected shot 32: the thin bar is not the `:last-child`-excluded `::after`; likely the node-track `border`/`mask` edge. Not confidently reproducible; deferred rather than blind-fixing.
- [Nit] Entitlement body promises an upgrade branch that may not render — copy wording, other slice.

## Remaining risks

- The 🔒 badge renders as a monochrome glyph box in headless Chromium (missing emoji font); on real clients it renders as a lock emoji. If the team prefers a pure-CSS lock, that's a follow-up.
- `stageLockReason` covers realm-gate and same-zone chain-gate; stages with other implicit lock causes fall back to the generic "Hoàn thành tầng trước" copy.
- The e2e evidence spec is committed for repeatability; it is heavier than a unit test (~44s) — keep it out of the default CI gate if the suite is time-budgeted.
