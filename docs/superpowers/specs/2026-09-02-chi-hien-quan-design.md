# Chiêu Hiền Quán — Hệ Thống Nhân Công Thống Nhất

- Ngày: 2026-09-02
- Trạng thái: DRAFT — chờ user review
- Nguồn: roadmap 6C + design direction chốt trực tiếp với user session này
- Phạm vi: NEW building Chiêu Hiền Quán + swap nguồn worker capacity + UI phân bổ nhân công + chuyển Linh Tuyền → linh mạch Khai Vật Đường

## 1. Bối cảnh & vấn đề

Hệ nhân công hiện tại gắn nguồn capacity vào sai chỗ:

```
HIỆN TẠI:
  gathering_outpost "Khai Vật Đường" (workersPerLevel: 1)
    → player.autoWorkerCapacity = outpost level × 1 (max 9)
  ProductionSystem.tickWorkers() — round-robin chia slots, không có manual assignment
  DecomposeSystem (Phân Giải khoáng) — nhận capacity qua constructor
```

Thiết kế đúng (user chốt): **nhân công là của riêng Chiêu Hiền Quán** — nơi THUÊ/QUẢN LÝ; các trạm sản xuất (Khai Vật Đường, Phân Giải) chỉ SỬ DỤNG. Ngoài ra Linh Tuyền (building tài nguyên độc lập) bị thay thế — chức năng generate Linh Thạch chuyển vào Khai Vật Đường như một "linh mạch" trong hệ sản xuất.

## 2. Quy tắc thiết kế (chốt user)

| Quy tắc | Giá trị |
|---|---|
| **Nhân công tối đa** | `1 + cấp CHQ × 2` (CHQ cấp 0 chưa xây = 1? — KHÔNG: chưa xây CHQ = 0 nhân công; công thức áp cho building đã xây: cấp 1 → 3, cấp 9 → 19) |
| **Nơi cấp nhân công** | Chỉ CHQ. Outpost/Dissolve là consumer |
| **Cycle time** | Nhân công KHÔNG giảm thời gian chu kỳ |
| **Sản lượng** | Tuyến tính: mỗi slot nhân công = 1 cycle đầy đủ song song (giữ nguyên mô hình workerCycles hiện có — đã khớp "sản lượng = cơ sở × số nhân công") |
| **Khí Đường** | Ngoại lệ — KHÔNG cần nhân công (không đụng) |
| **Vendor** | Không liên quan nhân công (không đụng) |

## 3. Thay đổi

### 3.1 NEW building `chi_hien_quan` (data + registry)

```ts
{
  id: 'chi_hien_quan',
  name: 'Chiêu Hiền Quán',
  description: 'Tụ hiền nouri dưỡng sĩ, quản lý nhân công toàn cục...',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 9,
  workersPerLevel: undefined, // KHÔNG dùng pattern cũ — capacity riêng 1 + level×2
  functionType: 'worker_lodge', // panel riêng (xem 3.4)
  upgradeCost: extendCosts([...]) // theo cùng pattern building khác
}
```

- Capacity helper mới (thuần data): `getWorkerCapacityForLevel(level) = 1 + level × 2`
- GameManager.refreshAutoWorkerCapacity: đổi điều kiện `buildingId !== 'gathering_outpost'` → `'chi_hien_quan'`; công thức dùng helper mới (KHÔNG còn `level × workersPerLevel`)
- Restore boot: compute capacity từ instance CHQ trong buildingManager (nếu có) — gọi refresh sau restoreFromSave
- **Outpost**: bỏ field `workersPerLevel` (không còn nguồn capacity); giữ vai trò gate Sản Xuất panel (functionType 'exploration' giữ nguyên)

### 3.2 Linh Tuyền → Linh Mạch của Khai Vật Đường

- **BỎ building `spirit_spring`** khỏi `buildings.ts` (data + không build mới được)
- Chức năng generate Linh Thạch offline chuyển thành **linh mạch**: Khai Vật Đường có cơ chế thạch ngầm — KHÔNG phải production cycle, giữ nguyên engine rate/storage của BuildingSystem nhưng gắn vào outpost:
  - BuildingSystem.getSpiritSpringRatePerSecond → đổi nguồn lookup từ `spirit_spring` → linh mạch của `gathering_outpost` (rate theo level outpost, giữ công thức scale realm hiện có)
  - Storage/claim flow giữ nguyên — chỉ đổi building nguồn
- Save cũ: **bump `CURRENT_SAVE_VERSION`** (naming-conventions "Save v41" pattern) — save cũ bị từ chối tự động qua màn SaveIncompatibleScreen (đã có flow + Export/Backup rescue), KHÔNG filter restore, KHÔNG migration thủ công. Dev phase AGENTS.md cho phép break compatibility.
- SpiritSpringPanel.vue: repurpose hiển thị "Linh Mạch" trong panel outpost HOẶC xóa panel + gắn claim UI vào ProductionPanel — **quyết định: gắn vào ProductionPanel** (một nơi quản lý tài nguyên thu thập duy nhất, tránh panel mồ côi)

### 3.3 ProductionSystem — manual assignment + auto mode

- `ProductionSiteState` thêm field `assignedWorkers?: number` (persist; undefined = auto/round-robin)
- `tickWorkers(nowMs, bag, registry, realmId, capacity, assignments?)` — thêm logic phân bổ:
  - **Auto mode** (mặc định): round-robin như hiện tại (giữ behavior)
  - **Manual mode** (khi có assignment): mỗi site nhận đúng `assignedWorkers` slots; tổng assigned ≤ capacity — vượt thì truncate theo thứ tự; slots dư (capacity - tổng assigned) → round-robin cho các site auto
- Offline settle (`settleWorkersOffline`): cùng logic phân bổ — dùng assignments snapshot (persist trong save để offline đúng online)
- Invariant: tổng slots đang chạy ≤ capacity luôn; không slot âm; site non-autoRestart không nhận slot (giữ hiện tại)

### 3.4 UI

- **ProductionPanel.vue**: mỗi site row thêm control phân bổ:
  - Mode "Tự động" (toggle toàn cục — bật = mọi site auto/round-robin, tắt = từng site slider)
  - Slider per-site `0..(capacity)` (chỉ hiện khi mode manual) + hiển thị "x/slots đang dùng"
  - Header panel: "Nhân công: đang dùng/total (CHQ cấp N)"
- **CHQ building panel** (functionType 'worker_lodge'): panel nhỏ hiển thị cấp CHQ, nhân công tối đa hiện tại, chi phí nâng cấp (đường lên capacity kế) — theo pattern panel building hiện có (BuildingPanel chung)

### 3.5 Save shape

- `productionSiteStates[]`: thêm `assignedWorkers?: number` — optional, không bump version bắt buộc (dev phase, save cũ thiếu field = auto mode)
- `buildings[]`: instance spirit_spring bị filter khỏi restore; chi_hien_quan instance mới
- `player.autoWorkerCapacity`: vẫn là field computed — giờ nguồn CHQ

## 4. Non-goals

- Không đụng Khí Đường (không cần nhân công), Vendor, alchemy jobs
- Không đổi reward tables/cycle balance — chỉ nguồn capacity + phân bổ
- Không art v2 CHQ (placeholder — dùng chung building icon; art riêng đợt sau theo dong-fu pipeline)
- Không migration save tinh tế (dev phase)

## 5. Kiến trúc dữ liệu (flow)

```
CHQ level N ──(1+N×2)──► player.autoWorkerCapacity
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
ProductionSystem         DecomposeSystem      (tương lai: consumer khác)
  tickWorkers(capacity, assignments)
    ├─ auto mode: round-robin (hiện tại)
    └─ manual mode: assignedWorkers per site + phần dư round-robin
              │
              ▼ workerCycles (persist) ──► settleOffline (cùng phân bổ)
```

## 6. Edge cases

| Case | Hành vi |
|---|---|
| Chưa xây CHQ | capacity = 0 — nhân công tắt hoàn toàn (chấp nhận nerf tạm đầu game: người chơi mới phải xây CHQ; CHQ tier 1 giá rẻ như outpost hiện tại) |
| Nâng CHQ giữa trận | capacity tăng ngay tick kế (đã vậy với outpost) |
| Manual assign tổng > capacity | Truncate theo thứ tự site trong panel; UI disable slider khi đạt giới hạn |
| Site đang chạy được tắt autoRestart | Giữ workerCycles đang chạy tới hoàn thành (hiện trạng), slot tự rời vòng phân bổ kế |
| Save cũ (pre-bump) | Bị từ chối bởi version gate — màn SaveIncompatible hiện, user export/backup hoặc tạo mới. Không crash, không filter |
| Save cũ có assignedWorkers thiếu | Chưa thể xảy ra sau bump (mọi save hợp lệ đều post-bump); defensive: undefined → auto mode |
| Offline + manual | settleWorkersOffline dùng assignments từ save — online/offline khớp nhau |

## 7. Testing

1. `getWorkerCapacityForLevel`: 1+1×2=3, 1+9×2=19, level 0 chưa xây → 0 (helper thuần)
2. `refreshAutoWorkerCapacity` (GameManager test): build/upgrade CHQ → capacity đúng công thức; outpost upgrade KHÔNG đổi capacity nữa
3. `tickWorkers` manual mode: assigned 2/1/0 cho 3 sites → slots đúng; tổng vượt → truncate; dư capacity → round-robin phần auto
4. Auto mode giữ nguyên (regression: test tickWorkers hiện có không đổi)
5. `settleWorkersOffline` manual: offline phân bổ khớp online (cùng assignments → cùng số cycle)
6. Restore: save có spirit_spring → instance bị lọc, boot OK; save có assignedWorkers → restore đúng
7. UI: ProductionPanel hiển thị mode toggle + slider bound capacity; CHQ panel hiển thị cấp + capacity kế
8. E2e: boot-fresh không vỡ (guest mới không có CHQ → 0 nhân công — production vẫn chạy manual cycle như cũ)

## 8. Rủi ro

- **Nerf tạm đầu game**: người chơi cũ mất capacity outpost (9 max) cho tới khi xây CHQ. Dev phase + user đã chốt "nhân công là của riêng CHQ" — chấp nhận; e2e xác nhận guest flow không deadlock (production manual cycle vẫn chạy không cần nhân công).
- **Offline/online mismatch** nếu assignments không persist — đã thiết kế persist field; test 5 khóa.
- SpiritSpring removal: mọi chỗ import/functionType 'spirit_spring' phải sweep (BuildingSystem claim path, panel, e2e, save validation) — grep khóa trong plan.

## 9. Verification chuẩn

- `npm.cmd run type-check` + focused tests + full vitest + build
- E2e: boot-fresh + save-reload (save cũ có spirit_spring)
- QA quick mode (AGENTS.md) — economy/progression risk → QA report trước khi declare done
