# Lưu / Tải / Cloud save

**Trạng thái:** Live.

## GameSave shape

`services/save/SaveSystem.ts` — `CURRENT_SAVE_VERSION = 59` (`services/save/saveVersion.ts`). `GameSave` chứa:

| Trường | Nội dung |
|---|---|
| `version` | literal 59 — save cũ hơn = `incompatible`, không migrate |
| `player` | toàn bộ `PlayerData` |
| `techniques` | `Technique[]` |
| `skills` | `Skill[]` |
| `materials` | `MaterialStackSave[]` |
| `equipment` | `EquipmentInstance[]` |
| `pills` | `PillStackSave[]` |
| `talismans` / `formations` | stack save (registry giữ shape dù Phù/Trận gameplay khai tử) |
| `buildings` | `BuildingInstance[]` |
| `equipmentSlots` | `EquipmentSlotState[]` (6 slot cố định) |
| `productionSites` | `ProductionSiteSave[]` (level + active cycle + seed) |
| `alchemyJobs` | `AlchemyJobSave[]` |
| `questState` | trạng thái nhiệm vụ |
| `decomposeState` | settings + `nextCycleAt` + `started` |

`PlayerData.lastSavedAt` bị loại khỏi restore-identity fingerprint — cùng payload save restore lặp lại là idempotent.

## Validate & restore order

Validate diễn ra 2 lớp: **version check trước** (không khớp 59 → `incompatible`), rồi **shape validation**. Restore order chuẩn (R10):

```text
1. gameManager.preflightSaveRegistryReferences(save)  — mọi id tham chiếu
   (material, equipment, skill, pill…) phải tồn tại trong registry TRƯỚC
   khi mutate bất kỳ state nào
2. player.restoreFromSave(save)                      — Pinia store nhận PlayerData
3. gameManager.setActivePlayer(player.$state)        — đưa reference vào domain
4. gameManager.restoreFromSave(save)                 — manager/bag/slot/cycle
5. player.setEquipmentModifiers(...)                 — re-derive modifier trang bị
```

Save lỗi (`corrupted`/`incompatible`) không crash boot — đi vào recovery path (`stores/saveIssue.ts` báo UI, `useAppLifecycle`'s `saveIssue.report`).

## Cloud save

`services/cloudSave/`:

- `CloudSaveService.ts` — interface (`load`, `save(snapshot, revision)` → `ok | empty | conflict | unavailable`), `capability`.
- `CloudSaveCoordinator.ts` — giữ `revision` cục bộ; `save()` thành công thì cập nhật revision. **Conflict không còn terminal**: coordinator re-sync revision rồi retry đúng 1 lần (last-writer-wins, hợp lệ cho game 1 người). Nếu retry vẫn fail thì revision đã mới → autosave kế (15s) tự thành công.
- `LocalCloudSaveService.ts` — implementation local (localStorage/…), kèm quota test.
- Supabase-backed service qua `services/supabase/` khi online feature bật.
- `BOUNDS.md` trong thư mục mô tả quota/giới hạn.

## Auth

`services/auth/` — `AuthService` interface + `MockAuthService` + `SupabaseAuthService` (chọn qua `AuthServiceFactory`). Auth quyết định route `auth`/`character`/`home` lúc boot qua presentation coordinator.

## Liên quan

- [game-loop.md](./game-loop.md) — autosave interval, offline settle sau load.
- [inventory.md](./inventory.md) — Linh Thạch là material, không nằm trên `PlayerData`.
