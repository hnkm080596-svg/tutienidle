# Deferred Cleanup Follow-ups — Design Spec

**Ngày:** 2026-09-03
**Phạm vi:** 5 deferred nhỏ từ Task 9.2/9.3/9.7 + T4.1 (ledger final review) + docs sync roadmap 8.5. KHÔNG gồm 2.7 data-layer strings (lập plan riêng).
**Nguồn:** `game/docs/qa/2026-09-03-task-9-followups-i18n-quick.md` + SDD ledger final review (worktree-task-9-followups-i18n).

## Items

### 1. i18n 2.2 leftovers cuối (FunctionOverlayPanel + useBagFilter + HomeBuildingIcons aria)

- `game/src/components/layout/FunctionOverlayPanel.vue` — literals 'Cấp {{level}} / {{max}}' (~72), 'Nâng công trình' (~87 hoặc title bar), 'Cần đạt {realm}' (~84): trích keys `layout.functionOverlay.*`, component thêm `useI18n()`.
- `game/src/composables/useBagFilter.ts` — `GROUP_LABELS` (15) + `AGE_LABELS` (31): core/composable KHÔNG gọi i18n → đổi sang key mapping (`groupLabelKey(group)` / `ageLabelKey(age)` export `...LabelKey` functions), consumers render `t(key)`. Grep consumers trước (`GROUP_LABELS`/`AGE_LABELS` dùng ở đâu — BagGrid/filter UI) và đổi tại render site. Keys: `bag.filter.group.*`, `bag.filter.age.*`.
- `game/src/components/game/HomeBuildingIcons.vue` — aria-labels (~124-126) dùng building name data (data-driven — nếu chỉ interpolate tên building từ data thì GIỮ, chỉ trích phần wrapper text như 'Chọn building' nếu có).
- vi byte-identical; en translated; parity test pass.

### 2. CombatExitConfirmModal focus trap

- Modal standalone (từ `ed1e1a4`) không có useDialogFocus. Áp dụng cùng contract: focus-on-open, Tab cycle, Escape → emit cancel/hủy thoát, focus restore.
- Cách: đọc file — nếu nó là custom overlay (không phải ConfirmModal), gắn `useDialogFocus` trực tiếp với `onEscape` phù hợp semantics thoát trận (cancel = ở lại trận). Nếu convert sang ConfirmModal là smaller-change thì convert.
- Test jsdom: escape→cancel (ở lại trận), không emit exit.

### 3. useDialogFocus 2 Low edges

- **Zero-focusable Tab escape** (`useDialogFocus.ts:37`): `if (list.length === 0) return` xảy ra TRƯỚC `preventDefault()` → Tab native thoát containment. Fix: `event.preventDefault()` trước early-return (Tab trên dialog không có focusable = no-op giữ focus ở card).
- **Same-tick re-open trigger overwrite** (`useDialogFocus.ts:24`): watch không immediate-guard — `false→true` cùng tick ghi đè `lastTrigger` bằng element trong dialog. Fix: chỉ capture trigger khi `lastTrigger === null` HOẶC khi activeElement KHÔNG nằm trong card.
- Test: mở rộng `dialogFocusAdversarial.test.ts` (2 case: zero-focusable Tab giữ containment; re-open cùng tick vẫn restore đúng trigger gốc).

### 4. StageSelectPanel numeric assertion

- `StageSelectPanel.test.ts:61`: `toContain(t('...enemiesSuffix'))` → `toContain(`10 ${t('...enemiesSuffix')}`)` (khôi phục check count 10 render).

### 5. en Body/Form consistency (skillResource)

- 9 keys mixing 'Body' (hoaThe, thoThe = Hóa/Thổ) và 'Form' (thuy/poison/kim). **User chốt 2026-09-03: 'Form' tất cả** — `Ember Form Stacks/Cast`, `Ember Form Decay Reduction`, `Mountain Form Stacks/Cast` (đổi 4 keys: hoaTheGainPerCast, hoaTheDecayReductionPercent, thoTheGainPerCast; kiểm tra cả description strings có 'Body' không — đổi hết cho nhất quán).

### 6. Roadmap 8.5 docs sync

- Row `perf-optimize-pass` stale ("Task 1-3/10... chưa merge") — thực tế đã merge 10/10 (`8b59045`) + flake fix (`79bab1c`).
- Thêm row `task-9-followups-i18n` — ✅ MERGED (`2910247`).
- Row `worktree-task-9-1`, `chi-hien-quan` đã ✅ — giữ nguyên.

## Không thuộc scope

- 2.7 data-layer content strings (materials/buffs/skills/buildings names + lore) — khối lượng lớn, lập plan riêng.
- QA-013/QA-014 (cooldown UX, unequip-before-failed-start) từ Task 9.1 — item riêng nếu user muốn.

## Verify

- Full matrix: test + type-check + build + e2e (từ `game/`).
- Parity test + adversarial dialog tests mở rộng.
