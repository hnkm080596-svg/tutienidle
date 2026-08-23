// Hằng số world-space cho sân đấu 1 chiều (chỉ trục X) — nguồn DUY
// NHẤT cho core combat (BattleSystem) lẫn view (MainScene.ts) để cả
// 2 luôn khớp scale, tránh mỗi bên tự định nghĩa 1 con số riêng.

// Player là tower CỐ ĐỊNH chính giữa sân (tower defense — không di
// chuyển suốt trận, xem BattleSystem.resolveMovement()) — quái mới là
// bên tiến vào từ phải.
export const HERO_HOME_X = 0

// Quái vào trận từ NGOÀI màn hình bên phải, tiến dần về phía hero.
export const ENEMY_SPAWN_X = 400

// Attack range visibility gate (2026-08-22) — world-X xa nhất còn NẰM
// TRONG tầm nhìn màn hình thật (dùng chung bởi BattleSystem để chặn
// tấn công quái off-screen VÀ CombatScene.ts để tính worldToScreenX,
// tránh 2 nguồn số liệu lệch nhau như HERO_HOME_X/ENEMY_SPAWN_X ở
// trên). Nhỏ hơn ENEMY_SPAWN_X để đảm bảo quái LUÔN spawn off-screen
// rồi mới đi vào tầm nhìn (spec "quái sẽ spawn offscreen và di chuyển
// từ bên phải sang").
export const SCREEN_VISIBLE_MAX_X = 350

// Hiển thị thuần % (0-100) suy ra từ attackRange world-unit — KHÔNG
// đổi đơn vị lưu trữ thật (attackRange vẫn world-unit nội bộ, xem
// StatBlock.ts/EnemyStatInput.ts), chỉ dùng cho UI hiển thị sau này
// nếu cần. 100 = tầm bắn phủ hết toàn bộ chiều rộng màn hình nhìn
// thấy được (SCREEN_VISIBLE_MAX_X).
export function attackRangeVisiblePercent(worldRange: number): number {
  return Math.min(100, Math.round((worldRange / SCREEN_VISIBLE_MAX_X) * 100))
}

// Cao độ hiển thị KIỂU CŨ (side-view ground/sky) — KHÔNG còn dùng để
// đặt vị trí hiển thị nữa (xem LaneIndex bên dưới, top-down 5-lane,
// 2026-08-22), chỉ còn tồn tại vì ~53 entry trong data/enemy/Enemies.ts/
// Tribulations.ts vẫn authored field này (ngoài phạm vi cần thiết để
// dọn — GameManager luôn GHI ĐÈ lane thật lúc spawn, xem LaneIndex).
// Enemy.ts/EnemyDefinition vẫn giữ type này cho field authored đó.
export type EnemyLane = 'underground' | 'ground' | 'air'

// Top-down 5-lane (2026-08-22) — lane giờ là HÀNG THẬT trên màn hình
// (không còn cosmetic-only như EnemyLane cũ), nhưng vẫn CHỈ ảnh hưởng
// HIỂN THỊ — targeting/pierce/bounce/aoe/homing vẫn thuần 1D theo trục
// X như trước, không phân biệt lane (xem CombatEntity.ts/BattleSystem.ts:
// mọi hàm distance/nearest-enemy chỉ đọc `.x`, không đọc `.lane`).
export type LaneIndex = 0 | 1 | 2 | 3 | 4

export const LANE_COUNT = 5

// Lane thứ 3 (tính từ 1) = index 2 (tính từ 0) — hero luôn đứng cố
// định ở đây, sát mép trái màn hình (xem CombatScene.ts).
export const HERO_LANE_INDEX: LaneIndex = 2

// Quái thường random lane MỖI LẦN spawn (Boss luôn HERO_LANE_INDEX —
// xem GameManager.ts's startBattle()/updateStageProgress()).
export function randomEnemyLaneIndex(): LaneIndex {
  return Math.floor(Math.random() * LANE_COUNT) as LaneIndex
}
