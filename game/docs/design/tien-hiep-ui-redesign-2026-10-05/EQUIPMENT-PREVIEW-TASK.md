# Equipment art preview

## Task card / approved design

- Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`, branch `codex/tien-hiep-ui-redesign`.
- Scope: interactive component-art preview only. Four approved concepts: Trang Bị, Cường Hóa, Tẩy Luyện, Tinh Luyện. Hóa Luyện and Phân Giải are excluded from this preview, not removed from gameplay.
- Owner: new `HomeEquipmentArtPanel.vue`, mounted by `LandscapeDesignPreview.vue`; no gameplay owners, stores, services, saves or equipment formulas are changed.
- Invariant: shared panel paper/rectangle remains identical to Character and Skill. Six circular equipped slots in two columns, blank idle-art space and equipment-contributed stat card remain fixed across all tabs. Forge workspaces do not repeat equipment illustrations or selection lists.
- State: component-local mock selection, filters, affix locks and action notice; reset on unmount; no persistence, async work or authoritative mutation.
- Components: `EquipmentArtCard` owns reusable nine-slice backdrop; `EquipmentArtSlot` owns circular/square item-frame states; `EquipmentArtButton` owns reusable button art; `EquipmentEnergyTube` owns decorative progress; `EquipmentPaperdollPreview` composes fixed left area; `EquipmentBagPreview` owns mock bag controls; `EquipmentForgePreview` owns three mock forge layouts; root composes tabs and selection.
- Existing primitives: asset URL resolver, shared paper, character-card nine-slice, button art, item-slot art, existing equipment icons and localized preview text.
- New art: alpha-cut circular slot frame, cultivation brush circle, enhancement seal, gold divider. New component atlas is generated with built-in ImageGen, exported as independent assets; no character art.
- User correction: ITEM art already exists. Keep original equipment item icons; newly generated item illustrations were removed from the preview and workspace. Future art creation is limited to UI components, never item art.
- G0/G1: source and dirty-state inspected. Existing task-owned preview edits retained. Q1/Q2/Q3: visual fixture responsibility and local state only. Q4: standalone landscape preview entry, not production game. Q5/Q6: reusable presentation art only, dependency toward asset resolver. Q7/Q8/Q9: no timing or domain calculations/queries. Q10: synchronous mock interactions, reset on unmount. Q11: production equipment/forge paths unchanged. Q12: type-check, localized-key scope checks, browser tab/slot/filter/action/hover checks and visual screenshots.
- Gate proportionality: this is a design-review surface, not a production inventory change or release. No production fixed-point or merge-ready claim is made. Runtime visual verification is required for the preview deliverable.

## Acceptance / planned verification

1. Equipment navigation opens panel in the existing home canvas.
2. Exactly four tabs; all preserve fixed left artwork and bounds.
3. Six independently selectable circular slots; selected frame glows modestly.
4. Bag grid, filters and sorting operate on detached mock items only.
5. Enhance current/next table; Wash paired affix columns and lock states; Refine per-row tubes and actions. No right-side equipment thumbnails.
6. Art is proportionally contained or nine-sliced. Exterior alpha and brush-circle center are transparent.
7. Mouse, keyboard focus, pressed states, reduced-motion, absence of overflow and image load failures checked in Edge.
8. Tooltip and dynamic idle art remain deferred by user request. Text and numeric samples do not define gameplay rules.

## Evidence

Pending implementation and visual review. No commit, push or production integration authorized.

### Filter button slice correction
The long button bitmap was sliced uniformly, stretching the ornamental ends into horizontal stripes. EquipmentArtButton now uses asymmetric source cuts (40 360 130 100) and fixed rendered edges (4px 36px 13px 10px). Confirmed in the actual in-app equipment bag preview after refresh. Type check passed; equipment browser scope: 2 tests passed. Existing item artwork is reused. This is preview verification, not production QA fixed-point certification.

