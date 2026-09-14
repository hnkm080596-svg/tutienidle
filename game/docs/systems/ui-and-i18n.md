# UI layer & i18n

**Trạng thái:** Live.

## Cấu trúc Vue

- `App.vue` → `GameRoot.vue` (design frame 16:9 cố định, `core/ui/DesignFrame.ts`: `DESIGN_WIDTH=2560`, `DESIGN_HEIGHT=1440`, `TOP_BAR_HEIGHT=64`, `BOTTOM_BAR_HEIGHT=72`, `LEFT_PANEL_WIDTH=25%`). Mọi panel cần kích thước frame **import từ DesignFrame**, không hardcode — đổi 1 hằng số thì mọi layout tự tính lại.
- Chrome combat (top/status/event/control bar) **không** có hằng số ở đây — nguồn sự thật là DOM đo thật qua `getCombatInsets`/`setCombatInsets` (`presentation/geometry/combatInsets.ts`, khớp CSS `clamp() --combat-*-h` trong `theme.css`), fallback ở `getFallbackCombatInsets`.

## Panel id — `presentation/contracts/panelIds.ts`

Hai union tách biệt (sống ở presentation vì đây là chỗ 2 layer gặp nhau hợp lệ; `stores/ui.ts` re-export):

- `LeftPanelMode` — trang chiếm panel trái: `character | inventory | exploration | settings | equipment_hall | pill_room | worker_lodge | scripture_pavilion | stage_select | vendor | null`.
- `StandalonePanel` — overlay full-screen mount trực tiếp trong `GameRoot.vue`: `skill | technique | realm | luyen_the | quan_khi | quest | artifact | tran_phap | null`.

## Component

- `components/common/` — primitive: `GamePanel`, `GameButton`, `TabBar`, `Tooltip`, `ToastContainer`, `ConfirmModal`, `OverlayPanel`, `SlotView`, `LoadingScreen`, `ErrorScreen`, `SaveIncompatibleScreen`, `OfflineSummaryModal`, `TutorialOverlay`, `WorldAnnouncementOverlay`, `ActionFeedbackLog`, `InkWashBackdrop`, `SceneHeader`, `PlayerPortrait`, `NotificationBadge`, `BreakthroughRequirementPanel`, `dialogFocus*` (a11y), `primitives/`.
- `components/panels/` — feature panel theo hệ thống: `CharacterPanel`, `InventoryPanel` + `BagGrid`, `EquipmentPaperdoll`, `EquipmentHallPanel`, `PillRoomPanel`, `AlchemyView`, `ProductionPanel`, `WorkerLodgePanel`, `VendorPanel`, `QuestPanel`, `StageSelectPanel`, `RealmPanel`, `TechniquePanel`, `ScripturePavilionPanel`, `SkillPathPanel`, `LuyenThePanel`, `QuanKhiPanel`, `ArtifactPanel`, `TranPhapPanel`, `SettingsPanel`, `BuildingConstructionGate`, `LoreCodexModal`; subfolder `artifact/`, `bag-sections/`, `equipment-hall/`, `loadout-sections/`, `scripture/`, `skill-path/`.

## Store (`stores/`, Pinia)

- `player.ts` — facade phía Vue đọc/ghép `PlayerData` (finalStats, cultivationSpeed, aiStrategy, artifact, ngoDao, save/restore...).
- `ui.ts` + `uiFlagsPersistence.ts` — panel đang mở, combat input mode, flag UI persist.
- `notification.ts` — toast queue phía Vue; `actionFeedback.ts`, `worldAnnouncement.ts`, `offlineSummary.ts`, `saveIssue.ts`, `error.ts`, `breakthroughRequirement.ts`.

## NotificationQueue → toast

`core/game/NotificationQueue.ts` — hàng đợi toast phát sinh **trong core** (loot, skill upgrade, bag overflow...): `push`/`drain`. `App.vue` tick rút qua `GameManager.drainNotifications()` → đẩy vào `stores/notification.ts`. Toast sinh sẵn ở Vue layer gọi thẳng store, không qua queue. Event type thuần ở `core/notification/NotificationEvent.ts` (kind/message/messageKey/messageParams — `messageKey` cho i18n, `message` làm fallback tiếng Việt; loot toast mang `loot` presentation payload: `name`/`nameColorVar`/`nameTone`/`gradeLabel`/`accentColorVar`); `core/notification/bagOverflow.ts` helper.

## i18n

- `src/i18n/index.ts`: `createI18n({ legacy: false, locale: 'vi', fallbackLocale: 'en' })`, schema từ `vi.json`. `locales/{vi,en}.json`.
- **Vi là locale chính**, en fallback. Text UI tiếng Việt đi qua `t('...')` (`useI18n()` — global scope; `useScope: 'local'` chỉ khi component tự định nghĩa `messages` — P16), không hardcode trong template; `data/**` content giữ nguyên tiếng Việt.
- `core/i18n/termGlossary.ts` — `TERMS`: bảng thuật ngữ chuẩn chống trôi từ ngữ (Cấp=level skill/node/công trình, Tầng=tầng cảnh giới 1-18, Bậc=bậc xếp loại, Sát Thương/ST, Chỉ Số, Công Kích, Phòng Thủ, Cảnh Giới, Phẩm). Chuỗi mới tra bảng trước khi viết; `term(key)` accessor.

## Format — `core/format/`

`NumberFormatter.ts` (số lớn), `formatDuration.ts` (mm:ss/h) — helper format thuần dùng chung UI + toast.

## Liên quan

- [presentation.md](./presentation.md) — coordinator/scene/route.
- [architecture.md](./architecture.md) — presentation không phải authority.
