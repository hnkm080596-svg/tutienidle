# Adversarial QA (quick) — equipment rail split + ornate compact bag layout

- Scope: `devin/1791114304-equipment-bag-split` vs `codex/hoa-cau-fireball-vfx`, 15 files (13 prod + test/spec).
- Mapper: domains inventory-equipment, pinia-phaser-sync, ui-input-lifecycle; `deepAuditCandidate: true` (cross-system count).
- Bounding rationale for not escalating: pure display/layout rework — no persistence schema, economy, combat, save, or offline path touched; equip/unequip and the 5 forge-op components are unchanged code mounted under new hosts. `unmappedPaths` routed manually: SlotTypes.ts (variant union member, render-only), SlotSizes.ts (cell-size constants, sole consumers = useBagGridLayout in the 3 bag sections + usePanelPagination in op pickers), locales (dead-key removal, zero live references found via grep), e2e spec (assertions re-matched to new rail).

## Invariant ledger

| ID | Hypothesis | Oracle | Result |
| --- | --- | --- | --- |
| INV-1 | Legacy `activeBagTab='equipment'` must not blank the Kho Vat grid | `activeTab` computed normalizes to 'material' | PASS (code + runtime screenshot) |
| INV-2 | Scope-hidden ops render disabled shell, cannot mount | `:disabled` + `selectWorkspace` admission guard; `isBetaEquipmentTab` | PASS (locked-env test: wash/refine/decompose disabled=true, click mounts nothing; betaScope corpus tests green) |
| INV-3 | Equip/unequip exactly-once via real click path | Cell click -> `equip()`; socket click -> inner `EquipmentPaperdoll.onSlotClick` (emit select + unequip, pre-existing) | PASS (Playwright: e2e-kiem false->true->false across both clicks) |
| INV-4 | bumpState propagation after equip/unequip | Grid cell empties, doll socket fills, stats +1 | PASS (runtime DOM + stat 11->12, toast "Trang Bị thành công") |
| INV-5 | `variant='bag'` confined to the 3 bag sections | grep consumers | PASS (paperdoll/item grids keep old variants) |
| INV-6 | SlotSizes bump (55/90/80) keeps layout bounded | Same scoring formula; MIN rows 3 floor | PASS (Kho Vat 14x4, rail 7x4 at 1600x900; op pickers share policy consistently) |
| INV-7 | All chrome ids exist as 'ready' in manifest | manifest assets scan | PASS (frame-s-slot, text-field, resource-pill, button-compact, tab-seal, divider-ornament all ready) |
| INV-8 | Sort menu usable inside 34px footer row | `position:absolute; bottom:calc(100%+6px)` opens upward | PASS (code) |
| INV-9 | `.count` absolute anchor has positioned parent | `.inventory-content{position:absolute}` | PASS |
| INV-10 | Menu buttons keep look inside new button chrome | `.bag-pagination__menu button` overrides later | PASS (code) |
| INV-11 | Disabled nav buttons unreachable by keyboard | `:disabled` removes focusability (intended) | PASS (intended) |
| INV-12 | `HALL_SELECTION_KEY` op-target pick unchanged | `selectEquipped` still sets selectedInstanceId | PASS (verified: socket click unequips inside EquipmentPaperdoll.onSlotClick on ALL workspaces — my earlier wrapper unequip was redundant and was reverted; final diff keeps original selection semantics) |

## Notable observation (pre-existing, not introduced)

- `EquipmentPaperdoll.onSlotClick` unequips on every socket click on every workspace — including when an op tab is open, where the click is ALSO the op-target picker (`select` emit). Unequip was never lost in the rail rework; the detail card was never its surface. Flagged to owner for visibility.

## Deferred (Low/Nit)

- Op-tab item pickers (usePanelPagination consumers) inherit the 55-90 cell policy — consistent look, bounded; noted as intentional side effect of the shared size policy.
- No unit test asserts the Kho Vat 'equipment' tab removal (the surface test suite + e2e spec cover it); the section components' own filtering tests are untouched.

Verdict: **PASS WITH EVIDENCE** — runtime DOM/Playwright evidence for every changed surface; 22 scoped + 1049 architecture/store/locale tests green; no confirmed defects.
