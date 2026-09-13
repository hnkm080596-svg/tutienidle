# Phân Giải (Decompose)

**Trạng thái:** Live — tab `decompose` trong Khí Đường ([equipment.md](./equipment.md)).

Core: `core/production/DecomposeSystem.ts`. Khác **Hóa Luyện** (`EquipmentDissolve.ts` — phân trang bị → Tinh Hoa, [equipment.md](./equipment.md)).

## Cơ chế

Phân giải **Linh Khoáng** (ore `<realm>_ore_<age>`) → **Luyện Khí Tinh Hoa** (`luyen_khi_tinh_hoa`) — nguồn DUY NHẤT của tinh hoa ngoài Hóa Luyện trang bị.

- Settings người chơi (`DecomposeSettings`): `gradeFilter` (phẩm nghề | `all`), `ageFilter` (tuổi | `all`), `workers` — dùng **chung pool worker** với production (`player.autoWorkerCapacity`, cùng `WorkerAllocator`).
- Chạy theo **cycle** (không instant): `DEFAULT_CYCLE_SECONDS = 30` mỗi lượt, tick theo `nextCycleAt` — khớp kiến trúc ProductionSystem.
- Mỗi cycle: mỗi worker tiêu `ORE_PER_WORKER_PER_CYCLE = 2` khoáng khớp filter.

## Output

Tuyến tính: `base(grade) × 2^ageIndex × workers` với `base = 1 + gradeIndex × 0.5` (gradeIndex từ `PROFESSION_GRADE_ORDER` của realm ore — `PROFESSION_GRADE_BY_REALM`). Tinh hoa cộng vào MaterialBag.

## Persist

`DecomposeSaveState { settings, nextCycleAt, started }` trong `GameSave.decomposeState` — restore tiếp tục cycle đang chạy; offline settle cùng `PRODUCTION_OFFLINE_CAP_SECONDS`.

## Liên quan

- [production.md](./production.md) — worker allocator chung.
- [profession-grades.md](./profession-grades.md) — grade của ore.
- [equipment.md](./equipment.md) — Hóa Luyện trang bị (nguồn tinh hoa kia).
