# Chiêu Hiền Quán Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiêu Hiền Quán (CHQ) là nguồn nhân công DUY NHẤT (`1 + level×2`), Khai Vật Đường nhận linh mạch (thế Linh Tuyền), UI phân bổ nhân công per-site với auto/manual toggle, save version bump hủy save cũ.

**Architecture:** Data building mới + helper capacity thuần → GameManager swap nguồn capacity → ProductionSystem thêm manual assignment (persist) song song auto round-robin → UI slider/toggle → Linh Tuyền bỏ, engine thạch gắn outpost → save bump v54→v55.

**Tech Stack:** TypeScript, Vitest, Vue 3 + Pinia (ProductionPanel), existing BuildingSystem/ProductionSystem.

**Spec:** `docs/superpowers/specs/2026-09-02-chi-hien-quan-design.md`

**Worktree:** `E:/tutienidle/.claude/worktrees/chi-hien-quan` (branch `worktree-chi-hien-quan` — đã tạo từ `f06a6ba`).

## Global Constraints

- Quy tắc chốt: nhân công là của riêng CHQ; cycle time không đổi; mỗi slot = 1 cycle song song (sản lượng tuyến tính); Khí Đường + Vendor không liên quan.
- Không đụng: `core/skill/**`, `core/equipment/**`, `core/pill/**`, `services/cloudSave/**` (ngoài saveVersion bump), Vendor panel.
- Save version bump: `CURRENT_SAVE_VERSION` 54 → 55 trong `services/save/saveVersion.ts` — kèm comment lý do (xóa spirit_spring, thêm chi_hien_quan + assignedWorkers). Save v54 tự động từ chối.
- Flexible UI rule: slider/panel không hardcode số cột/px màn hình dev.
- Verify chuẩn mỗi task: focused vitest; cuối plan: type-check + full suite + build + e2e boot-fresh + QA quick.

---

### Task 1: Save version bump v54 → v55

**Files:**
- Modify: `game/src/services/save/saveVersion.ts`
- Modify: `game/src/services/save/SaveSystem.ts:372` (comment version nếu có — đọc trước)
- Test: `game/src/services/save/SaveSystem.test.ts` (đọc test version hiện có — thêm case v54 bị từ chối)

**Interfaces:**
- Produces: `CURRENT_SAVE_VERSION = 55` — mọi consumer re-export không đổi.

- [ ] **Step 1: Sửa `saveVersion.ts`** — bump lên 55 + comment:

```ts
// v55 (2026-09-02, chi-hien-quan spec): XÓA building spirit_spring
// (chức năng linh mạch chuyển vào gathering_outpost), THÊM building
// chi_hien_quan (nguồn nhân công duy nhất 1+level×2), thêm field
// productionSiteStates[].assignedWorkers (phân bổ nhân công manual).
// Save v54 bị từ chối (dev phase, không migration).
export const CURRENT_SAVE_VERSION = 55 as const
```

- [ ] **Step 2: Thêm/chỉnh test** trong `SaveSystem.test.ts` — tìm test version hiện có (grep `54` hoặc `incompatible`) và thêm:

```ts
it('save v54 bị từ chối — incompatible sau bump v55 (chi-hien-quan)', () => {
  const saveV54 = { ...buildValidSaveShape(), version: 54 }

  const result = validateGameSave(saveV54) // hoặc hàm parse hiện có trong test

  expect(result.status).toBe('incompatible')
  expect(result.foundVersion).toBe(54)
})
```

(Đọc file test để dùng helper tên thật — KHÔNG bịa; pattern tương tự test version cũ nếu có, hoặc tạo từ helper buildSave của file.)

- [ ] **Step 3: Chạy focused tests** — `npx vitest run src/services/save`
Expected: PASS (mọi test dùng helper build save theo CURRENT_SAVE_VERSION tự thích ứng; test incompatible mới PASS).

- [ ] **Step 4: Commit** — `feat(save): bump CURRENT_SAVE_VERSION 54→55 (chi-hien-quan, spirit_spring removal)`

---

### Task 2: Building data — `chi_hien_quan` thêm, `spirit_spring` xóa, outpost bỏ workersPerLevel

**Files:**
- Modify: `game/src/data/building/buildings.ts` — xóa block spirit_spring (L66-100), thêm chi_hien_quan, sửa gathering_outpost (bỏ `workersPerLevel: 1`, thêm linh mạch comment), outpost `producesMaterialId` thêm
- Modify: `game/src/core/building/Building.ts` (type) — đọc type Building để xem `workersPerLevel` optional hay bắt buộc (nếu bắt buộc → optional hoá)
- Modify: `game/src/core/building/BuildingSystem.ts` — `getEffectiveRate`/`getEffectiveCapacity`/`getStoredAmount` conditions `template.id === 'spirit_spring'` → `'gathering_outpost'` (linh mạch)
- Test: `game/src/data/building/buildings.rework.test.ts` (sửa fixture list: thay spirit_spring → chi_hien_quan), `game/src/core/building/BuildingSystem.test.ts` (fixture spirit_spring → gathering_outpost linh mạch), `game/src/data/building/buildings.test.ts` nếu có

**Interfaces:**
- Produces: building `chi_hien_quan` (id, category 'crafting_station', tier 1, maxLevel 9, upgradeCost 9 bands theo pattern outpost); `gathering_outpost` có `producesMaterialId: SPIRIT_STONE_MATERIAL_ID` + `baseProductionRate: 5.5/60/2.6` + `baseStorageCapacity: 100` + `functionType: 'exploration'` (giữ) — linh mạch dùng cùng engine cũ qua conditions BuildingSystem.
- `workersPerLevel` không còn ở bất kỳ building nào (outpost bỏ) — Task 3 sẽ đổi nguồn capacity.

- [ ] **Step 1: Viết failing tests** trong `buildings.rework.test.ts`:

```ts
it('chi_hien_quan tồn tại với maxLevel 9 + 9 cost bands', () => {
  const chq = buildings.find((entry) => entry.id === 'chi_hien_quan')!

  expect(chq).toBeDefined()
  expect(chq.maxLevel).toBe(9)
  expect(chq.upgradeCost).toHaveLength(9)
})

it('spirit_spring đã bị XÓA khỏi buildings data', () => {
  expect(buildings.find((entry) => entry.id === 'spirit_spring')).toBeUndefined()
})

it('gathering_outpost mang linh mạch (producesMaterialId Linh Thạch) nhưng KHÔNG còn workersPerLevel', () => {
  const outpost = buildings.find((entry) => entry.id === 'gathering_outpost')!

  expect(outpost.producesMaterialId).toBe(SPIRIT_STONE_MATERIAL_ID)
  expect(outpost.workersPerLevel).toBeUndefined()
})
```

- [ ] **Step 2: Chạy FAIL** — `npx vitest run src/data/building`
- [ ] **Step 3: Implement data changes** (xóa spirit_spring block, thêm chi_hien_quan block — cost bands pattern outpost: L1 free/cheap tăng dần; outpost thêm 3 fields linh mạch; bỏ workersPerLevel)

Chi_hien_quan data (balance khởi điểm — tuning sau playtest):

```ts
{
  id: 'chi_hien_quan',
  name: 'Chiêu Hiền Quán',
  description: 'Nơi chiêu nạp và quản lý nhân công khai thác toàn cục. Cấp càng cao, càng nhiều hiền sĩ theo về.',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 9,
  baseStorageCapacity: 0,
  functionType: 'worker_lodge',
  upgradeCost: extendCosts([
    [],
    [{ materialId: 'mortal_ore_hoang', amount: 4 }],
    [{ materialId: 'qi_refining_wood', amount: 6 }],
  ], 4),
}
```

- [ ] **Step 4: Sửa BuildingSystem linh mạch conditions** (3 chỗ `'spirit_spring'` → `'gathering_outpost'`) + sửa fixtures BuildingSystem.test.ts tương ứng (instance buildingId `'gathering_outpost'` cho các rate/storage test)
- [ ] **Step 5: Chạy PASS** — `npx vitest run src/data/building src/core/building`
- [ ] **Step 6: Commit** — `feat(building): add chi_hien_quan, remove spirit_spring (linh mach moves to gathering_outpost)`

---

### Task 3: Worker capacity — nguồn CHQ duy nhất + helper thuần

**Files:**
- Create: `game/src/core/production/WorkerCapacity.ts` — helper thuần:

```ts
/** Nhân công tối đa theo cấp CHQ — công thức user chốt (roadmap 6C).
 *  Chưa xây CHQ (level 0) = 0 nhân công. */
export function getWorkerCapacityForLevel(chiHienQuanLevel: number): number {
  if (!Number.isFinite(chiHienQuanLevel) || chiHienQuanLevel <= 0) {
    return 0
  }

  return 1 + chiHienQuanLevel * 2
}
```

- Test: `game/src/core/production/WorkerCapacity.test.ts`
- Modify: `game/src/core/game/GameManager.ts:2364-2371` — `refreshAutoWorkerCapacity` đổi guard `gathering_outpost` → `chi_hien_quan`, công thức `getWorkerCapacityForLevel(instance.level)`
- Modify: `game/src/core/game/GameManager.ts` restore path — sau restore buildings, tìm instance CHQ + gọi refresh (tìm đoạn restoreFromSave dựng buildings — grep `buildingManager` trong restore)
- Test: `game/src/core/game/GameManager.workerCapacity.test.ts` (mới)

**Interfaces:**
- Consumes: Task 2 building data (`chi_hien_quan` id).
- Produces: `getWorkerCapacityForLevel(level: number): number` — Task 4/UI import được.

- [ ] **Step 1: Failing tests WorkerCapacity.test.ts**:

```ts
import { describe, expect, it } from 'vitest'
import { getWorkerCapacityForLevel } from './WorkerCapacity'

describe('getWorkerCapacityForLevel — công thức 1 + level×2 (user chốt)', () => {
  it('chưa xây (0/negative/NaN) → 0', () => {
    expect(getWorkerCapacityForLevel(0)).toBe(0)
    expect(getWorkerCapacityForLevel(-1)).toBe(0)
    expect(getWorkerCapacityForLevel(Number.NaN)).toBe(0)
  })

  it('cấp 1 → 3; cấp 9 → 19; tuyến tính', () => {
    expect(getWorkerCapacityForLevel(1)).toBe(3)
    expect(getWorkerCapacityForLevel(9)).toBe(19)
    expect(getWorkerCapacityForLevel(5)).toBe(11)
  })
})
```

- [ ] **Step 2: FAIL → implement helper → PASS**
- [ ] **Step 3: Failing test GameManager.workerCapacity.test.ts** (pattern GameManager tests hiện có — mock PlayerData):

```ts
it('build/upgrade chi_hien_quan → capacity theo 1+level×2', () => {
  // build CHQ level 1 → player.autoWorkerCapacity === 3
  // upgrade lên 2 → === 5
})

it('upgrade gathering_outpost KHÔNG đổi capacity nữa (nguồn cũ gỡ)', () => {
  // outpost level 9 → autoWorkerCapacity giữ nguyên giá trị trước đó
})
```

(Đọc GameManager tests hiện có để mock buildingManager/buildingSystem đúng pattern — có sẵn `GameManager.buildSnapshot.test.ts`/`GameManager.mvpLoop.test.ts` làm mẫu dựng manager + building.)

- [ ] **Step 4: FAIL → sửa refreshAutoWorkerCapacity + restore path → PASS**
- [ ] **Step 5: Regression** — `npx vitest run src/core/game GameManager` focused các file building-related
- [ ] **Step 6: Commit** — `feat(worker): chi_hien_quan is the sole worker capacity source (1+level×2)`

---

### Task 4: ProductionSystem — manual assignment (persist) + auto mode

**Files:**
- Modify: `game/src/core/production/ProductionTypes.ts` — `ProductionSiteState` thêm `assignedWorkers?: number`
- Modify: `game/src/core/production/ProductionSystem.ts` — `tickWorkers` + `settleWorkersOffline` nhận assignments
- Test: `game/src/core/production/ProductionSystem.workers.test.ts` (mới — đọc test workers hiện có nếu có, grep `tickWorkers` trong tests)

**Interfaces:**
- Produces:
  - `tickWorkers(nowMs, bag, registry, realmId, capacity, assignments?: Map<string, number>)` — param mới optional (backward-compat callers cũ)
  - Phân bổ: manual sites (trong assignments, có autoRestart) nhận min(assigned, còn lại); phần capacity dư → round-robin các site auto KHÔNG có assignment; sites có assignment = manual mode toàn cục, không assignment nào = auto hoàn toàn (giữ behavior cũ)
- GameManager tick call site (3255-3261) truyền `this.workerAssignments()` — helper đọc từ productionSystem states (persist qua getAllStates/restoreStates có sẵn)

- [ ] **Step 1: Failing tests** — ProductionSystem.workers.test.ts:

```ts
// Fixtures: productionSystem với 3 sites autoRestart (A, B, C) — pattern
// từ test ProductionSystem hiện có (dựng deps tối thiểu).

it('không assignments → round-robin như cũ (regression guard)', () => {
  // capacity 6, 3 sites → 2/2/2
})

it('manual: assigned A=4, B=1 → slots 4/1; C (không assign) nhận phần dư capacity-5=1', () => {
  // tickWorkers với assignments Map{A:4, B:1}
})

it('manual vượt capacity → truncate theo thứ tự Map', () => {
  // capacity 3, assignments A=5, B=5 → A=3, B=0
})

it('site non-autoRestart không nhận slot dù assigned', () => {
  // A autoRestart=false assigned 2 → 0 slots
})

it('activeWorkerSlots persist qua getAllStates → restoreStates giữ assignedWorkers', () => {
  // setState assignedWorkers 3 → restore → vẫn 3
})
```

- [ ] **Step 2: FAIL → implement → PASS** (tickWorkers signature mở rộng + logic; settleWorkersOffline nhận cùng phân bổ — tính slotsBySite từ assignments thay vì thuần round-robin)
- [ ] **Step 3: GameManager tick (3255) truyền assignments từ states** + settleOffline options thêm `assignments` (3187 block) — đọc states trước settle, truyền qua
- [ ] **Step 4: Regression** — `npx vitest run src/core/production` (offline cap tests không vỡ)
- [ ] **Step 5: Commit** — `feat(production): manual worker assignment persisted alongside auto round-robin`

---

### Task 5: UI — ProductionPanel phân bổ + CHQ panel + Linh Mạch claim + sweep spirit_spring UI

**Files:**
- Modify: `game/src/components/panels/ProductionPanel.vue` — header "Nhân công: dùng/total (CHQ cấp N)"; toggle Tự động/Manual; slider per-site bound capacity (manual mode); linh mạch claim block (từ SpiritSpringPanel move — thu hoạch thạch outpost)
- Create: `game/src/components/panels/WorkerLodgePanel.vue` — CHQ panel (cấp hiện tại, capacity hiện tại/kế, upgrade button — pattern BuildingPanel chung; functionType 'worker_lodge')
- Modify: `game/src/components/layout/FunctionOverlayPanel.vue` — bỏ SpiritSpringPanel import/mode `spirit_spring`, thêm WorkerLodgePanel mode `worker_lodge`; map name
- Modify: `game/src/stores/ui.ts` — LeftPanelMode union: bỏ `'spirit_spring'`, thêm `'worker_lodge'`
- Modify: `game/src/locales/vi.json` + `en.json` — keys panels.production (workers label mới, auto/manual, slider), panels.workerLodge mới; XÓA keys panels.spiritSpring (grep trước)
- Delete: `game/src/components/panels/SpiritSpringPanel.vue` (được user authorizes qua plan này — liệt kê rõ: đây là file panel mồ côi sau khi bỏ building; NẾU user muốn giữ file → đổi tên thành phần linh mạch trong ProductionPanel và BỎ bước xóa)
- Modify tests: `ui.test.ts`, `LeftPanel.building.test.ts`, `HomeBuildingIcons.test.ts`, `DongFuBuildingArt.test.ts`, `dongFuBuildingPipeline.test.ts` — fixtures `spirit_spring` → `chi_hien_quan`/`worker_lodge` (đọc từng file, sửa theo context)

**Interfaces:**
- Consumes: Task 3 `getWorkerCapacityForLevel`, Task 4 assignments API.
- Produces: UI state — Pinia? KHÔNG: assignments persist trong productionSiteStates (Task 4), panel mutate qua GameManager method mới `assignWorkers(siteId, count | undefined)` — undefined = về auto (xoá assignedWorkers).

- [ ] **Step 1: GameManager.assignWorkers** (+test nhỏ trong workerCapacity test file): set/xoá `assignedWorkers` trên state qua productionSystem
- [ ] **Step 2: Sửa test fixtures spirit_spring → worker_lodge/chi_hien_quan** (5 test files liệt kê trên) — chạy từng file PASS
- [ ] **Step 3: FunctionOverlayPanel + ui store union swap** — PASS ui tests
- [ ] **Step 4: ProductionPanel enhancements** (toggle + slider + linh mạch claim) — component tests theo pattern hiện có của panel (grep test file ProductionPanel)
- [ ] **Step 5: WorkerLodgePanel.vue** + vi/en keys — render test theo pattern panel khác
- [ ] **Step 6: Xóa SpiritSpringPanel.vue** (đã authorize qua plan) + grep `SpiritSpring|spirit_spring` toàn src — phải = 0 match (trừ saveVersion comment)
- [ ] **Step 7: type-check + `npx vitest run src/components src/stores`**
- [ ] **Step 8: Commit** — `feat(ui): worker assignment UI + worker lodge panel + linh mach claim (chi-hien-quan)`

---

### Task 6: Final verification

- [ ] `npm.cmd run type-check` — PASS
- [ ] `npx vitest run` full — PASS (baseline 2079+)
- [ ] `npm.cmd run build` — PASS
- [ ] `npx playwright test tests/e2e/boot-fresh.spec.ts tests/e2e/save-reload.spec.ts` — PASS (guest mới: 0 nhân công, production manual chạy; save v54: màn incompatible)
- [ ] Manual smoke: xây CHQ → capacity 3; bật auto → round-robin; manual slider → slots đúng; linh mạch claim outpost; upgrade CHQ → capacity tăng
- [ ] QA quick mode (`tutienidle-adversarial-qa`) — economy/progression risk bắt buộc report
- [ ] ROADMAP tick T4.2/T4.3 + ghi commit refs

## Execution Notes

- Tasks 1→6 tuần tự (2 phụ thuộc 1 vì version bump trước data change; 3 phụ thuộc 2; 4 phụ thuộc 3 conceptually — assignments cần capacity nguồn đúng; 5 phụ thuộc 3+4; 6 chốt).
- Balance numbers (CHQ upgradeCost) là KHỞI ĐIỂM — test khóa cấu trúc (9 bands), không khóa số tuyệt đối; đánh dấu tuning sau playtest.
- `workersPerLevel` field trên type Building: nếu type bắt buộc → optional hoá (`workersPerLevel?: number`) + xóa duy nhất use site (refreshAutoWorkerCapacity cũ). Grep `workersPerLevel` trước Task 2 để chắc không consumer khác.
- Xóa SpiritSpringPanel.vue đã được user authorize qua plan này (Task 5 Step 6) — vẫn chạy grep toàn src sau xóa để chứng minh sạch.
- Save bump là hành vi chính thức: e2e save-reload phải tạo save MỚI (v55) — spec cũ không còn hợp lệ; nếu e2e fixture save hardcode version → sửa fixture lên 55.
