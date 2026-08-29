# Cây phả hệ UI Component (Tiên Hiệp Idle)

Xây dựng bằng cách quét import thực tế giữa các file `.vue` trong `game/src/components` + `App.vue`
(không dựa vào tên thư mục). 6 tầng, từ nhỏ nhất (không phụ thuộc component nào khác) đến lớn nhất (root app).

> Quy ước tầng:
> - **T0 Primitives** — khối thị giác thuần túy, dùng ở khắp nơi, không phụ thuộc component khác
> - **T1 Atoms** — độc lập hoặc chỉ bọc 1 primitive
> - **T2 Molecules** — ghép ≥2 atom/primitive thành 1 khối UI có nghĩa
> - **T3 Organisms** — khối tính năng (feature block), ghép molecule + atom
> - **T4 Templates/Panels** — 1 màn hình chức năng hoàn chỉnh (những gì hiện trong overlay/tab)
> - **T5 Layout / Root** — bố cục toàn màn hình và root app

---

## 1. Cây phả hệ (theo quan hệ import thực tế)

```
App.vue                                              [T5 Root]
├─ LoadingScreen                                      T1
├─ ErrorBoundary                                      T1
├─ ErrorScreen                                        T2 (GameButton)
├─ SaveIncompatibleScreen                             T2 (GameButton, ConfirmModal)
├─ onboarding/AuthEntryScreen                         T2 (GameButton, InkWashBackdrop, InkNineSlice)
├─ onboarding/CharacterCreationScreen                 T2 (GameButton, InkWashBackdrop, InkNineSlice)
└─ layout/GameRoot                                    [T5 Root]
   ├─ game/MainScene                                  T4
   │  ├─ game/DongFuScene                             T3 (PlayerPortrait)
   │  └─ game/PhaserCanvas                             T2
   ├─ game/combat/CombatSceneOverlay                  T4
   │  ├─ CombatTopBar                                  T2
   │  ├─ CombatStatusBar                                T2 (Bar)
   │  ├─ CombatEventBar                                  T2
   │  ├─ CombatControlBar                                T2 (GameButton)
   │  ├─ CombatCountdownOverlay                          T2
   │  ├─ CombatAiPanel                                   T2
   │  ├─ CombatResultModal                              T3
   │  │  ├─ CombatVictoryPanel                          T2 (GameButton, InkNineSlice, InkWashBackdrop)
   │  │  └─ CombatDefeatPanel                            T2 (GameButton, InkNineSlice, InkWashBackdrop)
   │  └─ hud/CombatBuildHud                             T4
   │     ├─ hud/MortalCombatHud                          T3 (CombatSkillSlot)
   │     ├─ hud/PhapTuCombatHud                          T3 (CombatSkillSlot, ArtifactCombatSlot)
   │     └─ hud/KiemTuCombatHud                          T3 (CombatSkillSlot)
   │        └─ hud/CombatSkillSlot                        T2 (SlotView, Bar)
   │        └─ hud/ArtifactCombatSlot                     T2
   ├─ game/tribulation/TribulationSceneOverlay        T2 (Bar, GameButton)
   ├─ game/HomeBuildingIcons                           T2
   ├─ game/HomeResourceStrip                           T2
   ├─ game/DongFuCommandWheel                          T2 (NotificationBadge)
   ├─ game/BuildingDetailPopover                       T3 (GameButton, StatRow, Eyebrow, InkNineSlice)
   ├─ layout/LeftPanel                                 T5
   │  └─ panels/CharacterPanel                         T3 (PlayerPortrait, GameButton)
   ├─ layout/RightPanel                                T5
   │  ├─ panels/EquipmentPaperdoll                     T3 (SlotView)
   │  └─ panels/InventoryPanel                          T3
   │     └─ panels/BagGrid                              T3 (TabBar)
   │        ├─ bag-sections/EquipmentBagSection         T2 (SlotView, BagPaginationControls)
   │        ├─ bag-sections/MaterialBagSection           T2 (SlotView, Chip, BagPaginationControls)
   │        └─ bag-sections/PillBagSection               T2 (SlotView, BagPaginationControls)
   ├─ layout/FunctionOverlayPanel                      T5
   │  ├─ panels/BuildingPanelHeader                    T2 (GameButton)
   │  ├─ panels/ProductionPanel                        T3 (BuildingConstructionGate, Bar, GameButton)
   │  ├─ panels/SettingsPanel                          T2 (ConfirmModal, GameButton, Chip)
   │  ├─ panels/PillRoomPanel                          T4
   │  │  ├─ panels/AlchemyView                          T3 (Bar, GameButton, StatRow, SceneHeader)
   │  │  └─ bag-sections/PillBagSection (dùng lại)
   │  ├─ panels/EquipmentHallPanel                      T4 (SlotView, GameButton, TabBar, SceneHeader)
   │  ├─ panels/ScripturePavilionPanel                  T4
   │  │  ├─ scripture/TechniqueCodex                    T3 (SlotView, TechniqueSlotCard)
   │  │  └─ scripture/LoreCodex                          T3 (SlotView, EmptyState, LoreCodexModal)
   │  ├─ panels/StageSelectPanel                        T3 (BuildingConstructionGate, GameButton, Chip, SceneHeader, EmptyState)
   │  └─ panels/SpiritSpringPanel                        T2 (Bar, GameButton, SceneHeader)
   ├─ panels/SkillPathPanel                             T4
   │  ├─ loadout-sections/NodeTreePanel                 T3 (SkillConnections)
   │  ├─ skill-path/NodeInspector                       T2 (GameButton, StatRow, EmptyState)
   │  ├─ skill-path/SkillPathList                       T2
   │  ├─ skill-path/SkillDetailView                      T2 (GameButton, StatRow, EmptyState)
   │  └─ skill-path/SkillLoadoutStrip                    T3 (SlotView, Chip, RadialSkillSelector)
   ├─ panels/TechniquePanel                             T4 (OverlayPanel, Bar, StatRow, Eyebrow, EmptyState)
   │  └─ loadout-sections/TechniqueSlotCard              T2 (SlotView, Bar, InkNineSlice)
   ├─ panels/RealmPanel                                 T4 (OverlayPanel, PlayerPortrait, Bar, GameButton)
   ├─ panels/LuyenThePanel                              T4 (OverlayPanel, Bar, GameButton, EmptyState)
   ├─ panels/QuanKhiPanel                               T4 (OverlayPanel, ConfirmModal, GameButton)
   ├─ panels/QuestPanel                                 T4 (OverlayPanel, Bar, GameButton, EmptyState)
   ├─ panels/ArtifactPanel                               T3
   │  ├─ artifact/ArtifactOverview                       T2
   │  ├─ artifact/ArtifactExperienceBar                  T2 (Bar)
   │  ├─ artifact/ArtifactGradeSection                    T2 (GameButton, StatRow)
   │  └─ artifact/ArtifactPathCards                       T2
   ├─ common/Tooltip                                    T2 (InkNineSlice)
   ├─ common/ToastContainer                              T1
   ├─ common/ActionFeedbackLog                            T1
   ├─ common/WorldAnnouncementOverlay                     T1
   ├─ common/OfflineSummaryModal                          T2 (GameButton, StatRow, InkNineSlice)
   ├─ common/BreakthroughRequirementPanel                 T2 (OverlayPanel, GameButton)
   └─ common/TutorialOverlay                              T2 (GameButton)

--- Primitives dùng lại khắp nơi (T0), không vẽ lặp lại ở trên: ---
common/primitives/InkNineSlice.vue     — nền/khung "ink wash", dùng bởi GameButton, GamePanel, OverlayPanel,
                                          Tooltip, ConfirmModal, NotificationBadge, Chip, TechniqueSlotCard,
                                          CombatVictoryPanel, CombatDefeatPanel, onboarding screens, ...
common/primitives/Bar.vue              — thanh progress/HP/MP, dùng bởi ~10 panel
common/primitives/StatRow.vue          — 1 dòng "nhãn: giá trị", dùng bởi ~8 nơi
common/primitives/Eyebrow.vue          — nhãn nhỏ phía trên tiêu đề
common/primitives/Chip.vue             — tag/pill nhỏ (bọc InkNineSlice)
common/primitives/EmptyState.vue       — trạng thái rỗng dùng chung
```

---

## 2. Danh sách xử lý (flat list, sắp theo tầng nhỏ → lớn)

Dùng bảng này để tick từng component khi bạn duyệt/chuẩn hoá UI-UX. Cột **Dùng bởi (số nơi)** giúp ưu
tiên: sửa primitive/atom trước vì nó ảnh hưởng dây chuyền lớn nhất.

| # | Tầng | Component | Đường dẫn | Dùng bởi (≈ số nơi) | Xử lý |
|---|------|-----------|-----------|----------------------|-------|
| 1 | T0 | InkNineSlice | common/primitives/InkNineSlice.vue | 15+ | ☐ |
| 2 | T0 | Bar | common/primitives/Bar.vue | 10 | ☐ |
| 3 | T0 | StatRow | common/primitives/StatRow.vue | 8 | ☐ |
| 4 | T0 | Eyebrow | common/primitives/Eyebrow.vue | 2 | ☐ |
| 5 | T0 | Chip | common/primitives/Chip.vue | 4 | ☐ |
| 6 | T0 | EmptyState | common/primitives/EmptyState.vue | 5 | ☐ |
| 7 | T1 | SlotView | common/SlotView.vue | 9 | ☐ |
| 8 | T1 | InkWashBackdrop | common/InkWashBackdrop.vue | 4 | ☐ |
| 9 | T1 | SceneHeader | common/SceneHeader.vue | 4 | ☐ |
| 10 | T1 | PlayerPortrait | common/PlayerPortrait.vue | 3 | ☐ |
| 11 | T1 | ActionFeedbackLog | common/ActionFeedbackLog.vue | 1 | ☐ |
| 12 | T1 | ToastContainer | common/ToastContainer.vue | 1 | ☐ |
| 13 | T1 | WorldAnnouncementOverlay | common/WorldAnnouncementOverlay.vue | 1 | ☐ |
| 14 | T1 | LoadingScreen | common/LoadingScreen.vue | 1 | ☐ |
| 15 | T1 | ErrorBoundary | common/ErrorBoundary.vue | 1 | ☐ |
| 16 | T1 | NotificationBadge | common/NotificationBadge.vue | 2 | ☐ |
| 17 | T1 | GameButton | common/GameButton.vue | 20+ | ☐ |
| 18 | T1 | GamePanel | common/GamePanel.vue | 0 (chưa dùng?) | ☐ |
| 19 | T1 | OverlayPanel | common/OverlayPanel.vue | 8 | ☐ |
| 20 | T1 | Tooltip | common/Tooltip.vue | 1 (root) | ☐ |
| 21 | T2 | TabBar | common/TabBar.vue | 3 | ☐ |
| 22 | T2 | ConfirmModal | common/ConfirmModal.vue | 3 | ☐ |
| 23 | T2 | ErrorScreen | common/ErrorScreen.vue | 1 (root) | ☐ |
| 24 | T2 | TutorialOverlay | common/TutorialOverlay.vue | 1 (root) | ☐ |
| 25 | T2 | SaveIncompatibleScreen | common/SaveIncompatibleScreen.vue | 1 (root) | ☐ |
| 26 | T2 | BreakthroughRequirementPanel | common/BreakthroughRequirementPanel.vue | 1 (root) | ☐ |
| 27 | T2 | OfflineSummaryModal | common/OfflineSummaryModal.vue | 1 (root) | ☐ |
| 28 | T2 | BagPaginationControls | panels/bag-sections/BagPaginationControls.vue | 3 | ☐ |
| 29 | T2 | SkillConnections | panels/loadout-sections/SkillConnections.vue | 1 | ☐ |
| 30 | T2 | SkillPathList | panels/skill-path/SkillPathList.vue | 1 | ☐ |
| 31 | T2 | ArtifactOverview | panels/artifact/ArtifactOverview.vue | 1 | ☐ |
| 32 | T2 | ArtifactPathCards | panels/artifact/ArtifactPathCards.vue | 1 | ☐ |
| 33 | T2 | ArtifactExperienceBar | panels/artifact/ArtifactExperienceBar.vue | 1 | ☐ |
| 34 | T2 | ArtifactGradeSection | panels/artifact/ArtifactGradeSection.vue | 1 | ☐ |
| 35 | T2 | BuildingConstructionGate | panels/BuildingConstructionGate.vue | 2 | ☐ |
| 36 | T2 | LoreCodexModal | panels/LoreCodexModal.vue | 1 | ☐ |
| 37 | T2 | NodeInspector | panels/skill-path/NodeInspector.vue | 1 | ☐ |
| 38 | T2 | SkillDetailView | panels/skill-path/SkillDetailView.vue | 1 | ☐ |
| 39 | T2 | TechniqueSlotCard | panels/loadout-sections/TechniqueSlotCard.vue | 2 | ☐ |
| 40 | T2 | EquipmentBagSection | panels/bag-sections/EquipmentBagSection.vue | 1 | ☐ |
| 41 | T2 | MaterialBagSection | panels/bag-sections/MaterialBagSection.vue | 1 | ☐ |
| 42 | T2 | PillBagSection | panels/bag-sections/PillBagSection.vue | 2 | ☐ |
| 43 | T2 | RadialSkillSelector | panels/loadout-sections/RadialSkillSelector.vue | 1 | ☐ |
| 44 | T2 | BuildingPanelHeader | panels/BuildingPanelHeader.vue | 1 | ☐ |
| 45 | T2 | SettingsPanel | panels/SettingsPanel.vue | 1 | ☐ |
| 46 | T2 | SpiritSpringPanel | panels/SpiritSpringPanel.vue | 1 | ☐ |
| 47 | T2 | CombatTopBar | game/combat/CombatTopBar.vue | 1 | ☐ |
| 48 | T2 | CombatStatusBar | game/combat/CombatStatusBar.vue | 1 | ☐ |
| 49 | T2 | CombatEventBar | game/combat/CombatEventBar.vue | 1 | ☐ |
| 50 | T2 | CombatControlBar | game/combat/CombatControlBar.vue | 1 | ☐ |
| 51 | T2 | CombatCountdownOverlay | game/combat/CombatCountdownOverlay.vue | 1 | ☐ |
| 52 | T2 | CombatAiPanel | game/combat/CombatAiPanel.vue | 1 | ☐ |
| 53 | T2 | CombatVictoryPanel | game/combat/CombatVictoryPanel.vue | 1 | ☐ |
| 54 | T2 | CombatDefeatPanel | game/combat/CombatDefeatPanel.vue | 1 | ☐ |
| 55 | T2 | CombatSkillSlot | game/combat/hud/CombatSkillSlot.vue | 3 | ☐ |
| 56 | T2 | ArtifactCombatSlot | game/combat/hud/ArtifactCombatSlot.vue | 1 | ☐ |
| 57 | T2 | HomeBuildingIcons | game/HomeBuildingIcons.vue | 1 | ☐ |
| 58 | T2 | HomeResourceStrip | game/HomeResourceStrip.vue | 1 | ☐ |
| 59 | T2 | PhaserCanvas | game/PhaserCanvas.vue | 1 | ☐ |
| 60 | T2 | DongFuCommandWheel | game/DongFuCommandWheel.vue | 1 | ☐ |
| 61 | T2 | TribulationSceneOverlay | game/tribulation/TribulationSceneOverlay.vue | 1 | ☐ |
| 62 | T2 | AuthEntryScreen | onboarding/AuthEntryScreen.vue | 1 (root) | ☐ |
| 63 | T2 | CharacterCreationScreen | onboarding/CharacterCreationScreen.vue | 1 (root) | ☐ |
| 64 | T3 | DongFuScene | game/DongFuScene.vue | 1 | ☐ |
| 65 | T3 | BuildingDetailPopover | game/BuildingDetailPopover.vue | 1 (root) | ☐ |
| 66 | T3 | MortalCombatHud | game/combat/hud/MortalCombatHud.vue | 1 | ☐ |
| 67 | T3 | PhapTuCombatHud | game/combat/hud/PhapTuCombatHud.vue | 1 | ☐ |
| 68 | T3 | KiemTuCombatHud | game/combat/hud/KiemTuCombatHud.vue | 1 | ☐ |
| 69 | T3 | CombatResultModal | game/combat/CombatResultModal.vue | 1 | ☐ |
| 70 | T3 | CharacterPanel | panels/CharacterPanel.vue | 1 | ☐ |
| 71 | T3 | EquipmentPaperdoll | panels/EquipmentPaperdoll.vue | 1 | ☐ |
| 72 | T3 | InventoryPanel | panels/InventoryPanel.vue | 1 | ☐ |
| 73 | T3 | BagGrid | panels/BagGrid.vue | 1 | ☐ |
| 74 | T3 | AlchemyView | panels/AlchemyView.vue | 1 | ☐ |
| 75 | T3 | ProductionPanel | panels/ProductionPanel.vue | 1 | ☐ |
| 76 | T3 | StageSelectPanel | panels/StageSelectPanel.vue | 1 | ☐ |
| 77 | T3 | TechniqueCodex | panels/scripture/TechniqueCodex.vue | 1 | ☐ |
| 78 | T3 | LoreCodex | panels/scripture/LoreCodex.vue | 1 | ☐ |
| 79 | T3 | NodeTreePanel | panels/loadout-sections/NodeTreePanel.vue | 1 | ☐ |
| 80 | T3 | SkillLoadoutStrip | panels/skill-path/SkillLoadoutStrip.vue | 1 | ☐ |
| 81 | T3 | ArtifactPanel | panels/ArtifactPanel.vue | 1 (root) | ☐ |
| 82 | T4 | MainScene | game/MainScene.vue | 1 (root) | ☐ |
| 83 | T4 | CombatBuildHud | game/combat/hud/CombatBuildHud.vue | 1 | ☐ |
| 84 | T4 | CombatSceneOverlay | game/combat/CombatSceneOverlay.vue | 1 (root) | ☐ |
| 85 | T4 | PillRoomPanel | panels/PillRoomPanel.vue | 1 | ☐ |
| 86 | T4 | EquipmentHallPanel | panels/EquipmentHallPanel.vue | 1 | ☐ |
| 87 | T4 | ScripturePavilionPanel | panels/ScripturePavilionPanel.vue | 1 | ☐ |
| 88 | T4 | SkillPathPanel | panels/SkillPathPanel.vue | 1 (root) | ☐ |
| 89 | T4 | TechniquePanel | panels/TechniquePanel.vue | 1 (root) | ☐ |
| 90 | T4 | RealmPanel | panels/RealmPanel.vue | 1 (root) | ☐ |
| 91 | T4 | LuyenThePanel | panels/LuyenThePanel.vue | 1 (root) | ☐ |
| 92 | T4 | QuanKhiPanel | panels/QuanKhiPanel.vue | 1 (root) | ☐ |
| 93 | T4 | QuestPanel | panels/QuestPanel.vue | 1 (root) | ☐ |
| 94 | T5 | LeftPanel | layout/LeftPanel.vue | 1 (root) | ☐ |
| 95 | T5 | RightPanel | layout/RightPanel.vue | 1 (root) | ☐ |
| 96 | T5 | FunctionOverlayPanel | layout/FunctionOverlayPanel.vue | 1 (root) | ☐ |
| 97 | T5 | GameRoot | layout/GameRoot.vue | 1 (App) | ☐ |
| 98 | T5 | App | App.vue | root | ☐ |

*(Ghi chú: các `.test.ts` cạnh `common/` không phải component UI nên không đưa vào danh sách.)*

---

## 3. Gợi ý thứ tự xử lý

1. **T0 Primitives trước tiên** — InkNineSlice và Bar ảnh hưởng nhiều nhất, chỉnh 1 lần lan toả toàn bộ game.
2. **T1 Atoms** — GameButton/OverlayPanel/SlotView là các "khối chữ ký" của phong cách "ink wash" — chuẩn hoá xong sẽ khoá được ngôn ngữ thị giác chung.
3. **T2 Molecules** theo nhóm tính năng (combat HUD, bag-sections, artifact, skill-path) — xử lý theo cụm để giữ nhất quán trong 1 tính năng.
4. **T3-T4 Organisms/Templates** — review bố cục tổng thể từng panel sau khi atom/molecule đã ổn định (tránh sửa 2 lần).
5. **T5 Layout/Root** — chỉ còn là ghép khung, thường không cần sửa nhiều nếu 4 tầng dưới đã nhất quán.
