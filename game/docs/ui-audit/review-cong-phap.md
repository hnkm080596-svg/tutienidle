# Review: Công Pháp audit (skeptical re-check)

## Missed

Things the audit did not mention or under-described, each verified in code:

1. **`skill.svg` fallback icon absent from the art map.** `SkillSurface.vue:56` defines `FALLBACK_ICON = '/assets/ui/huyen-kim/symbols/skill.svg'`; `nodeIcon` returns it at `SkillSurface.vue:419` when both manifests miss; `basicUiNode`/`ultimateUiNode` also fall back to it (`SkillSurface.vue:716,741`); `SkillPaperTree.vue:95` reuses it as `spawnIcon` for the 12-type design spawn palette (`SkillPaperTree.vue:131`). Report maps `lock.svg` and node frames but never `skill.svg`.

2. **Live timers in SkillSurface.** `noticeTimer`: `flashNotice` runs `window.setTimeout(() => notice.value='', 3200)` (`SkillSurface.vue:158-165`); `unlockTimer`: `flagUnlock` runs a 1500ms timeout (`SkillSurface.vue:261-270`); both cleared in `onBeforeUnmount` (`SkillSurface.vue:163-165,267-270`). The report's interaction inventory omits both.

3. **Live battle-state subscription.** `inBattle = useTurnBattleInfo()` (`SkillSurface.vue:155`) gates `actionDisabled` in `toUiNode` (`SkillSurface.vue:651,664`), `respecDisabled` (`SkillSurface.vue:835`), and a `watch(inBattle)` auto-cancels `pendingRespec` when battle starts (`SkillSurface.vue:836-838`). Report never mentions this store-derived gating.

4. **Window-level pointer listeners in SkillPaperNode.** Hold-to-activate registers `pointermove`/`pointerup`/`pointercancel` on `window` (`SkillPaperNode.vue:99-113`) — the report describes the 0.85s hold ring but omits the window-listener lifecycle entirely.

5. **`onMounted` side-effect in SkillPaperTree.** Emits `select` for `mainNode` and seeds `frozenScale` at mount (`SkillPaperTree.vue:283-288`) — mount behavior absent from the inventory.

6. **`@contextmenu` spawn-delete + `@scroll` reset.** `onContextMenu` deletes design spawns (`SkillPaperTree.vue:112-124`, bound L443); `onScrollReset` snaps pan/zoom back (`SkillPaperTree.vue:276-280`). Report condenses to 'wheel zoom/dblclick reset'.

7. **Missing locale key `devPanel.exported`.** `SkillConstellationPanel.vue:211` calls `t('devPanel.exported')`; the key exists in neither `src/locales/vi.json` nor `src/locales/en.json` — the export chip renders the raw key. Dormant + master-only, low impact, but a real bug the report missed.

8. **Hardcoded Vietnamese strings, no i18n.** `SkillPaperTree.vue:78-92` `DESIGN_NODE_TYPES` carries 12 literal VN labels; the design toolbar literals 'Thiết Kế'/'Xuất Bố Cục'/'Đã Chép'/'Về Mặc Định'/'+ Node…' (`SkillPaperTree.vue:468-478`) bypass `t()`. Report audits orphan keys but not these non-keyed strings.

9. **`layoutRadialGraph` computed-then-discarded for element trees.** `SkillSurface.vue:302` always builds `base = layoutRadialGraph(...)`, but for `!mortal && entries.length>1` every entry position is overwritten by `FIRE_DESIGN_POS` or the parked-column/anchor branch (`SkillSurface.vue:313-346`). Radial only survives for mortal/`entries.length<=1` (`SkillSurface.vue:309-312`) — wasted compute on every element tree.

10. **NAV_ACTIVE_STANDALONE rail highlight.** `DongFuStage.vue:258-259` maps `skill:'skill'`, consumed at `DongFuStage.vue:274` to mark the rail button active while the panel is open — a live chrome link the mount-chain section omits.

11. **useDialogFocus does more than Escape.** `useDialogFocus.ts:37-60` also does focus-on-open, Tab containment cycling, and focus restore; the report credits only 'Escape→emit(back)'.

12. **`.design-tools` container always renders.** `SkillPaperTree.vue:468` renders the wrapper unconditionally; only inner buttons are master-gated — report says the row renders 'khi designMode', the container itself is not gated.

13. **`designOffsets`/`designSpawns` load for every user, not master-gated.** `SkillPaperTree.vue:32,77` reads `skill-tree-design-pos-v1`/`skill-tree-design-spawns-v1` at setup regardless of `isMaster`; `spawnNodes` render whenever the key is non-empty — a stale key would surface stamped nodes for non-master too.

14. **Stale `paintNodes` comment.** `SkillPaperTree.vue:166-168` justifies descending-y paint order for label occlusion, but `SkillPaperNode.vue` renders no label DOM (aria-label only) — comment references a removed feature.

15. **Constellation path has no activation affordance.** `SkillConstellationPanel`/`ConstellationNode` only emit `select`; no hold-to-act/upgrade emit exists — wiring it live would have no upgrade path. Relevant to report's open question 1 which frames only a slot/coordinate conflict.

16. **Even SkillPreview cannot switch elements.** `SkillPreview.vue:67` binds `@element="chooseElement"` but its template contains zero buttons — `chooseElement` is dead-bound; `emit('element')` is dead end-to-end, preview included. Strengthens the element-pills finding.

17. **SceneDesignCanvas overlay is itself pointer-events:none.** `SceneDesignCanvas.vue:41-42` makes viewport+canvas click-through; combined with `.skill-paper-scene{pointer-events:none}` (`tien-hiep-ui.css:391`) the backdrop kill is two-layered — report cites only the CSS half.

18. **SkillIconManifest.ts not inventoried.** The file (`src/data/skill/SkillIconManifest.ts`) holds `SKILL_ICON_MANIFEST` (15 keys) + `NODE_ICON_MANIFEST` (24 entries incl. reused art for minors) — cited in logic but missing from the file inventory.

## Wrong

Claims that do not match the code:

1. **`betaScopeSurface.ts` third cite invalid.** Report cites `skill:null` at `L67/L133/L165`; exactly two occurrences exist — `betaScopeSurface.ts:67` (wheel map) and `betaScopeSurface.ts:133` (standalone map). L165 holds no `skill:` entry.

2. **FIRE_CONSTELLATION counts wrong and swapped.** Report says '21 point 22 stroke'; actual is **23 points** (`SkillConstellationLayouts.ts:52-83`) and **21 strokes** (`SkillConstellationLayouts.ts:84-113`).

3. **'DESIGN seat luôn render locked placeholder, không data' wrong for `basicUiNode`.** It renders `state:'learned'` with real Ly Hỏa Thuật name, `SKILL_ICON_MANIFEST` icon and description (`SkillSurface.vue:713-734`); only `ultimateUiNode` is the locked placeholder (`SkillSurface.vue:737-760`).

4. **'layoutRadialGraph live cho mortal/non-fire' wrong for non-fire.** Non-fire element trees overwrite all radial positions with parked-column + anchors (`SkillSurface.vue:313-346`); radial output surfaces only for mortal/`entries.length<=1` (`SkillSurface.vue:309-312`).

5. **Phantom locale keys listed as orphans.** `panels.skillPath.nodeInspector.element`/`.elementMismatch`/`.wayMismatch` do not exist in `vi.json` or `en.json` — they cannot be 'orphaned keys'. The other orphan keys verify.

6. **'Pipe art dead' contradicts report §6.** `skill-connection-pipe-v1.png` is rendered live by `ui-preview/HomeSkillArtPanel.vue` (`<image ... skill-connection-pipe-v1.png>`) — production-dead but preview-live; only `pipe-v2` is fully dead.

7. **Minor cite drift.** `openBuild` writes `ui.standalonePanel='skill'` at `ExplorationSurface.vue:86` (report: L86-87); tribulation seam is `useTribulation.ts:104-108` (report: L108); `masterAccess.ts` lives at `src/services/master/masterAccess.ts`, not `src/stores` as implied.

## Verified-ok

- **Gate + mount chain:** `SkillPathPanel.vue:16` gate; `GameRoot.vue:15` async comp, watcher L78-100 (`mountedStandalone.add` L96), mount L156, idle prefetch L110-123; `ui.ts` `standalonePanel` L151 / `openStandalonePanel` L244-255 / `closeHomeOverlays` L258-263 / `toggleStandalonePanel` L320-331; `DongFuStage.vue:228` NAV_TARGET + SLOT_SYMBOL L114 + activateSlot L344; `PhapTuLabBridge.vue:40`; `usePaperNavigation.ts:47` + `PaperPanelNavigation` mounted only by `PaperPreviewSurface.vue` → preview-only.
- **Dead emit/listener:** SkillFidelityScene declares `element` in defineEmits (L44) never calls it; `<SkillPaperDetails @upgrade>` bound (L71) while SkillPaperDetails has no defineEmits — dead listener.
- **Backdrop-dismiss dead:** `tien-hiep-ui.css:390-411` `.skill-paper-scene{pointer-events:none}` + `>*{pointer-events:auto}`; `:is(#app,body)` ID specificity beats scoped → `@click.self` (SkillFidelityScene L57) cannot fire; `.skill-sheet` (auto) swallows clicks without dismissing.
- **Global-over-scoped live hits:** `.skill-head h1` in gradient-shine selector (`tien-hiep-ui.css:135,148`) 72px inside 61px band (box 58px fits; glyph ink may overhang, nothing clips it); `.skill-respec{border-radius:0;min-height:32px}` L223 beats scoped 5px.
- **Dead global rules:** `.skill-paper` band (6+ rules L25/133/177/253-256/278/344), `.skill-heading` L134/150/217, `.skill-elements` L216, `.skill-paper-details`+`.skill-detail-body`+`.skill-info-frame`+`.skill-meta` L218-222, `.skill-upgrade` L237-238, `th-panel-swap-*` L373-379 — no matching classes in the new DOM.
- **Constellation dormant:** `SkillSurface` never passes `:constellation` (template L846-876); only `SkillPreview.vue:67` does; `skillConstellationLayoutFor` (`SkillConstellationLayouts.ts:122-127`) has zero production callers; probe test note '(SkillSurface only renders the paper tree)' (`skillConstellationDesign.probe.test.ts:4`).
- **Slot mismatch real:** `.constellation-panel` left:228/top:259/710×445 (`SkillConstellationPanel.vue:228-233`) vs `.skill-paper-tree` left:365/top:198/600×487 (`SkillPaperTree.vue:485`) vs sheet left:345 — would overflow the paper's left edge; 'Same frame slot' comment stale.
- **Art map:** `skill-node-spare-v1.png` on disk, no `frameKind` maps 'spare' (dead art); `skill-connection-pipe-v1/v2` warmed at `AssetBundleCatalog.ts:663-664` while `SkillPaperTree.vue:27` rules plain lines; unreferenced `skills/` trio `hoa_an.png`, `hoa_cau_thuat_empowered.png`, `tam_muoi.png` absent from `SKILL_ICON_MANIFEST`; `rune-node/dao-luan-node/dao-luan-center@2x` + `node-ring-v1.png` consumed only by `ConstellationNode.vue`.
- **Orphan components:** `TechniqueSlotCard.vue` imported only by `InkWashMediumSurfaces.test.ts` (stale comment L3-4 cites removed `TechniquePanel.vue`); `TechniqueRuneRing.vue` imported only by TechniqueSlotCard; `skillGraphLayout.ts` still imported at `SkillSurface.vue:41`.
- **Dual design stores:** masterAccess persists `skill-tree-design-mode-v1` + `skill-tree-design-const-pos-v1` (`masterAccess.ts`); SkillPaperTree uses `skill-tree-design-pos-v1` + `skill-tree-design-spawns-v1` — parallel, unmerged.
- **Respec master gate:** `.skill-respec v-if="isMaster"` (`SkillFidelityScene.vue:74`); full pendingRespec/ConfirmModal chain render-ready but invisible to non-admin.
- **stableParallaxStack('skill-tree'):** 4 layers (sky/far-mountains/celestial-field/atmosphere) with motion metadata (`StableSceneArt.ts:66,141-162`), consumed only by `ConstellationBackdrop.vue` (dormant).
- **Orphan locale keys (the ones that exist):** `panels.skillPath.colTitles/elementTabs/centerTabs/list/detail/roleStrip`, `nodeInspector.upgradeGateHeader`, `skill.elements`, `skill.infoCasts`, `skill.levelLabel`, `skill.navigation` — present in both locales, no production reference.
- **Panel slot geometry:** sheet 345/101/1065×608, tree 365/198/600×487, details `.skill-detail-card` 985/198/400×487 (`SkillPaperDetails.vue:51`), head band 372/123/1011×61 — all inside the paper except `.skill-preview-label` top:719 (below sheet bottom 709, preview-only).
- **useTribulation seam:** `openStandalonePanel(result.standalonePanel)` exists but `TribulationOutcomeService.ts:72,273` only ever emits 'quan_khi' → 'skill' never arrives via this seam (report's 'theoretical seam' claim correct).
- **Emphasis/`edgeLinkLength`/`accent`/`elements`+`onSelectElement` claims** — each verified as described.