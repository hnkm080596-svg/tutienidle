// MASTER SPEC Muc V - 3 nhom Building goc, + 1 nhom moi (BUILDing spec).
//   'resource'         - Farm/Mine/Lumber Mill/Quarry/Herbal Garden
//                         (san xuat raw material truc tiep theo thoi gian).
//   'processing'        - Smelter/Sawmill/Stoneworks/Herbal Workshop/Loom
//                         (Raw Material -> Refined Material, xem Phase 5
//                         ProcessingRecipe.ts).
//   'infrastructure'    - Storage/Spirit Gathering Array/Research Building.
//   'crafting_station'  - BUILDing spec: Dan Phong/Tran Dai/Phu Vien/Khi
//                         Duong - click mo thang Function UI (Building.
//                         functionType), Building.levels feed modifier
//                         cho Function (time/quality/concurrent jobs,
//                         xem BuildingSystem.getCraftModifiers()) thay
//                         vi tu san xuat/xu ly nguyen lieu nhu 3 nhom tren.
export type BuildingCategory = 'resource' | 'processing' | 'infrastructure' | 'crafting_station'
