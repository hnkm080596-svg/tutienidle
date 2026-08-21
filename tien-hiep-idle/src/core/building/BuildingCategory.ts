// MASTER SPEC Mục V — 3 nhóm Building gốc, + 1 nhóm mới (BUILDing spec).
//   'resource'         — Farm/Mine/Lumber Mill/Quarry/Herbal Garden
//                         (sản xuất raw material trực tiếp theo thời gian).
//   'processing'        — Smelter/Sawmill/Stoneworks/Herbal Workshop/Loom
//                         (Raw Material → Refined Material, xem Phase 5
//                         ProcessingRecipe.ts).
//   'infrastructure'    — Storage/Spirit Gathering Array/Research Building.
//   'crafting_station'  — BUILDing spec: Đan Phòng/Trận Đài/Phù Viện/Khí
//                         Đường — click mở thẳng Function UI (Building.
//                         functionType), Building.levels feed modifier
//                         cho Function (time/quality/concurrent jobs,
//                         xem BuildingSystem.getCraftModifiers()) thay
//                         vì tự sản xuất/xử lý nguyên liệu như 3 nhóm trên.
export type BuildingCategory = 'resource' | 'processing' | 'infrastructure' | 'crafting_station'
