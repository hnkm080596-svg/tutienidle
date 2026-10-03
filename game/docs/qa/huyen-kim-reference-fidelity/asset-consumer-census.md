# Huyen Kim Reference Fidelity - Asset / Consumer Census

Task 0 census: manifest ID -> registry -> URL -> primitive -> caller -> computed paint.

## Registry chain

`src/ui/huyen-kim-chrome.json` (43 assets, single manifest) -> `src/ui/huyenKimChrome.ts` (`HUYEN_KIM_CHROME`, `chromeSlice()`, `hkChromeUrl()`, `pendingChromeIds()`) -> `InkNineSlice.vue` `chrome-id` prop (ready PNG via border-image; tintable via mask-box-image; pending -> --hk-* CSS fallback, never fetches) or direct `hkChromeUrl()` for non-sliced art (rollers/plaques/orbs/props).

Verified: all 42 `ready` slots resolve to real files under `public/assets/ui/huyen-kim/<category>/`. Only `scrollbar` pending (HOLD, Ruling 03).

## chrome-id consumers (real PNG art path)

- `ImperialScrollScene`: imperial-scroll-body + frame-xl-ceremony + icon-button-utility (+ hkChromeUrl rollers/plaque/grain/ornaments)
- `GameButton`: chromeSlot map sm/md/lg -> button-compact/standard/ceremonial; circle -> icon-button-utility
- `OverlayPanel`/`ConfirmModal`: surface-m-panel + frame-m-modal
- `Chip`: tab-seal / seal-chip; `ToastContainer`/`Tooltip`: frame-xs-tooltip
- `CurrencyHud`: resource-pill; `GlobalTopBar`: identity-plate
- `CombatVictoryPanel`/`CombatDefeatPanel`: surface-xl-scroll body
- `RewardList`: frame-s-slot x5; `TribulationSceneOverlay`: entity-bar + surface-m-panel x2
- `AuthEntryScreen`/`CharacterCreationScreen`: text-field (inputs migrated)
- `QuestPanel`: list-row
- Direct `hkChromeUrl` consumers: command wheel nodes, building plaques, identity plate avatar frame, combat turn tokens, skill orb frames + toggle track/thumb, scroll rollers/plaque/grain/cloud/corner ornaments

## asset-id callers still on legacy CSS chrome (22 bindings / 12 files)

| File | asset-id(s) | Disposition |
|---|---|---|
| AuthEntryScreen.vue | surface-xl-paper-scroll + frame-xl-ceremony | MIGRATE -> surface-xl-scroll + frame-xl-ceremony chrome (no tint needed) |
| CharacterCreationScreen.vue | same | MIGRATE same |
| CombatDefeatPanel.vue | frame-xl-ceremony | KEEP asset-id: cinnabar tint requires tintable CSS frame (chrome slot tintable:false) |
| TechniqueSlotCard.vue | frame-m-seal-corner | candidate -> frame-m-modal (verify visual parity first) |
| BuildingDetailPopover.vue | surface-m-paper + frame-m-seal-corner | candidate -> surface-m-panel + frame-m-modal |
| ErrorScreen / SaveIncompatibleScreen / TutorialOverlay | surface-xl-paper-scroll + frame-xl-ceremony | candidate migrate (out-of-band screens, low risk) |
| NotificationBadge / OfflineSummaryModal / TalentEntitlementModal / GuestAbandonDialog | surface-m-paper, frame-m-seal-corner, frame-xs-ink-line | micro overlays; migrate only if parity verified |

## Stable scene art (StableSceneArt.ts)

Stacks delivered: auth-creation L0-L5 (1672x941), realm-ascent L0-L4 (812x610 = S05 ascent-map region), skill-tree L0-L3 (640x470 = S07 tree-canvas), body figure+meridian overlay (640x520 = S08 figure-focus), technique plinth (448x480 = S06 artifact-vista), equipment paperdoll (380x610 = S12), exploration map frame/mask/divider (700x524 = S10 map-canvas), tribulation storm far/near/dais/vignette (1672x941).

Consumers today: HuyenKimParallaxStack mounts auth-creation on Login/Creation; realm-ascent inside RealmPanel; DongFuScene uses its own DongFuArt modular kit (times x seasons variants); TribulationSceneOverlay mounts storm layers. skill-tree stack + body figure/plinth/paperdoll/map frames exist but are NOT yet placed inside their scene regions (or only partially) -> placement work in Tasks 5-8.

## Findings

1. F-LOGIN-MATERIAL: Login/Creation cards use legacy `asset-id` dark-ink CSS chrome, not the delivered paper-scroll/ceremony PNG. Fix via chrome-id migration (Task 1 pilot).
2. F-DONGFU-VARIANT: home renders DEFAULT_THANH_VAN_VARIANT = spring/morning (pinned 2026-08-26). Night kit exists and matches ref mood; variants rotate per battle. Presentation-level decision, not an art gap - record in art-gaps as variant-mood note.
3. F-NAVRAIL-CLIP: nav-seal-vertical labels clip two-line text at 1280.
4. F-SETTINGS-DOUBLE-RAIL: scene rail + internal section nav both render; spec S17 wants shared rail + 2-col sections grid.
5. F-WHEEL-ORBIT: command wheel renders single orbit; spec wants inner r=185 (character/realm/skill) + outer r=264 (rest).
6. F-TRIB-FRAME: tribulation shows an ornamental frame around the whole viewport (likely misplaced vignette/frame layer); ref is full-bleed storm.
7. F-EQUIP-BAG: EquipmentHallPanel has no right bag-grid column; ops as top tabs not left rail; paperdoll head clipped.
8. F-QUEST-EMPTY / F-TECH-EMPTY / F-SKILL-FLAT: beige voids with a single line / flat lists - composition missing.
