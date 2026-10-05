# PC UI implementation — 2026-10-05

Branch: `codex/tien-hiep-ui-redesign`. Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`. App root: `game/`. Base HEAD: `f8af8007b0b6519e6aa6997fedad2cc77939538a`. Changes are local, uncommitted and unpushed. The earlier art-only handoff is superseded by the user's request to implement directly. Mobile is deferred.

## Implemented surface coverage

This is a whole-PC visual system, not an eighteen-route limit. The inventory remains 286 Vue files; shared components deliberately restyle their real consumers without duplicating their gameplay responsibilities. Inventory/reachability counts are not runtime acceptance evidence.

| Surface family | Implementation | Runtime evidence |
|---|---|---|
| Login / creation / home / wheel / Thiên Cơ / resource HUD | World vista, ink-gold identity/resource plates, vertical building plaques, wheel art, separate paper event board | Production login, guest creation and home capture; real wheel click/Escape |
| Character / equipment / inventory | Parchment envelope, ink navigation, title plaques, gold slots, existing animated portrait | Production and three PC sizes; tooltip hover; equipment canvas stays above summary |
| Realm / skill / body / technique / exploration / quests | Shared envelope, scene composition, art-backed tree and collection controls | Production captures for admitted routes; populated standalone fixtures for additional states; fresh-mortal technique lock preserved |
| Alchemy / equipment hall / production | Shared workshop skin, inspector/actions, scrollable production cards, existing systems | Production captures; scroll envelope/header containment checked |
| Combat / tribulation / victory / defeat | Shared ink UI and paper result panels; existing battle renderer and VFX retained | Actual battle and result flows, actual tribulation capture |
| Formation | Paper dialog, roster / projected battlefield / formation choices in three columns, localized combatant labels | Isolated fixture, real Phaser canvas, native DragEvent/DataTransfer draft placement; beta owner still rejects hidden commit |
| Companion / artifact / recruitment / affinity / gifts | Shared paper dialog, selectable ink cards, two-column artifact layout, secondary panels | Real component fixtures in ui-secondary.html; release admission not changed |
| Tooltip / item cards / node and equipment detail | Ink panel with transparent frame; semantic/rarity colors retained | Actual stat tooltip hover at three PC sizes; populated scene fixtures |
| Confirm / feedback / lore dialogs | Separate parchment and alpha frame, readable field colors, shared controls | Real components in isolated fixture; screenshot after entry transition; Escape/close checks |
| Offline / beta completion / entitlement / tutorial / guest abandon / error / save incompatibility | Same common dialog skin, retained focus/command owners and state rules | Source consumer review; not every exceptional state has been exercised individually |
| Toasts / loading / announcements / update banner / pagination / tabs / filters | Ink-gold or paper controls according to context; Teleport-to-body supported | Actual battle loot toasts and boot flow; contrast review of active page and selected companion metadata |

## Transparency and assets

### Review repair following the user's rejection

The earlier implementation was not accepted by the user. Its report and green checks did not establish visual fidelity. The current review found and repaired actual assembled UI defects:

- Ready untinted PNG chrome still painted the generic fallback rectangle beneath its alpha. `InkNineSlice` now clears that fallback only after ready art resolves; unresolved art keeps its fallback. A mounted regression checks this behavior.
- Frame consumers used opaque paper/ink composites or lost their independent backing when migrated. Scene frames now use `panel-frame-v2`, with deliberately separate paper/ink backgrounds. Inventory/equipment details, combat chrome and result panels were checked as siblings.
- Alchemy and exploration used generic `.paper` classes, so the scene skin never reached them. Dedicated scene classes now receive the actual paper envelope; browser capture asserts the background and border slice. This was a concrete runtime defect, not a successful theme migration.
- The skill tree fitted unused square layout space rather than painted discs and labels. Its presentation viewport now centers the actual graph bounds below the header; two deterministic cases and browser node bounds cover the repair.
- Character identity/power spacing, attribute icons, section density and element summary were recomposed. Browser checks ensure the fresh character's element summary is not clipped at all three PC sizes. Longer talent lists retain scrolling.
- Formation choices expose their existing descriptions and occupied-cell patterns, with selection state. The queue uses the existing animated player portrait. Native draft drag/drop and the unchanged beta rejection are exercised.
- Technique receives its own scene plaque, separate from the current technique name. Settings save actions use two columns rather than excessively stretched ribbons.
- Defeat hint contrast, equipment loot toast contrast, artifact milestone contrast and exploration reward space were repaired from fresh screenshots. Tooltip capture waits for final opacity.

`scripts/audit-tien-hiep-alpha.mjs` records raw RGBA evidence for **130 source/runtime PNGs** in `ALPHA-REVIEW.json`. Transparent RGB can appear brown in an image preview even when the corresponding alpha is zero; raw alpha and actual browser composition are the evidence. Filled paper surfaces and world backgrounds are intentional; they are not substituted for cutout frame assets.

`source/button-primary-v2.png` was edited with ImageGen from the original primary button, with `transparent_background: true`, to give it a broad ivory label area and less intrusive ornament. The active pack uses crop `{ x: 7, y: 152, w: 2034, h: 448 }` and cap fraction `0.12`; the original source is retained. Generated output provenance: `exec-7c256e6f-95c0-491b-a1ee-c05fa5d13858.png` in this thread's generated-images folder. Prompt intent: remove exterior background/glow, simplify corner ornaments, retain a blank wide ivory center, no text, approximately 5:1 silhouette.

`source/panel-frame-v2.png` is an actual transparent frame: 1448×1086 RGBA, center alpha 0, 1,290,116 fully transparent pixels. See `panel-frame-v2-alpha.json`. Exterior and the center opening are transparent; the paper texture is a separate intentionally filled surface. Tooltip and secondary dialog chrome use the transparent frame rather than a baked paper composite. Full world backgrounds, paper textures and button/plate fills are intentionally opaque inside their painted silhouettes.

`scripts/build-tien-hiep-ui.mjs` produces the registry-compatible slices and runtime exports. Original gameplay character/item/skill/building animation assets are retained. No character or combat animation was generated. The formation scene change only replaces its presentation background palette. CSS URLs are installed through `resolveAssetUrl`, including configured CDN routing, rather than bypassing the existing asset base.

## Verification

Latest repair verification supersedes the earlier counts below:

- Type-check: PASS, `polish-typecheck.log`.
- Production build: PASS, `polish-build.log`; existing chunk/timing warnings remain.
- Full Vitest: **932 files PASS; 8647 tests PASS; 12 expected failures; 8 skipped**, `polish-vitest.log`.
- Real browser: **8 scenarios PASS**, `polish-browser-final.log`, including canonical production flows, three PC viewports, tooltips, dialogs, populated scene fixtures and secondary panels.
- Two additional affected component suites: **6 tests PASS**, `polish-focused.log`.
- Independent visual review first found inventory/result backing, formation omission and artifact contrast; the resulting-state review then found the production defeat hint and loot toast defects. These were fixed; the final focused review visually confirmed their closure and the exploration reward repair. This is focused independent review, not approval of every possible consumer/state.

OCR workspace selection and selected rule resolution are recorded in `polish-ocr-preview.json` / `polish-ocr-rules.txt`. Full per-file OCR coverage and the internal protocol terminal ledger are not established by these artifacts; no formal `QA_FIXED_POINT_REACHED` or merge-ready claim is made.

- Type-check and production build: PASS. Build reports existing large-chunk warnings.
- Full Vitest, four workers: **931 files PASS; 8644 tests PASS; 12 expected failures; 8 skipped**. `implementation-vitest-final.log`.
- Canonical browser capture: **4 PASS**. Login, fresh admitted panels, actual combat/results and tribulation. `implementation-canonical-final.log`.
- PC interaction/secondary/dialog checks: **4 PASS**. `implementation-pc-secondary-final.log`. Viewports: 1280×720, 1672×941, 1920×1080 for main navigation/tooltip/equipment flows.
- Final production envelope regression: separate fresh-mortal run with plaque/header and rail/envelope bounding-box assertions. `implementation-production-final.log`.
- After the final formation canvas label cleanup, its directly affected suites pass **18 tests / 2 files**, with type-check/build rerun and the formation browser scenario rerun in `implementation-formation-final.log`. The DOM owns the localized visible combatant label; the canvas does not duplicate raw identifiers.
- Two source review rounds identified CDN routing, dark-subpanel tokens, active pagination and selected companion metadata defects; these were repaired. This is independent source review evidence, not a claim of formal protocol fixed-point completion.

The final aggregate does not change core gameplay, save, inventory mutation or quest rules. The dedicated authoring fixture owns its own player/store instance and does not turn hidden beta features on in the shipped app. Locked navigation guards both its visual state and click emission. Existing animation reduced-motion and asset-load handling have focused regression coverage.

## Naming / limits

Visible navigation now uses Túi, Công Pháp, Luyện Đan and Bản Đồ where appropriate. The character label uses Đạo Lộ. Gameplay identifiers and content definitions are retained.

Exceptional error/import/entitlement variants, every possible inventory density and every user-selected UI zoom have not all been individually captured. The shared skin is implemented for these consumers, but source coverage is not equivalent to exhaustive visual proof. Mobile is intentionally deferred. No commit, push, merge or deployment has been performed.

Runtime screenshots are in `runtime-evidence/`. The old authoring preview and initial zip remain historical design deliverables; use the current worktree and runtime evidence to assess this implementation.
