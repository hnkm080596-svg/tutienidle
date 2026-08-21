// Hằng số world-space cho sân đấu 1 chiều (chỉ trục X) — nguồn DUY
// NHẤT cho core combat (BattleSystem) lẫn view (MainScene.ts) để cả
// 2 luôn khớp scale, tránh mỗi bên tự định nghĩa 1 con số riêng.

// Player là tower CỐ ĐỊNH chính giữa sân (tower defense — không di
// chuyển suốt trận, xem BattleSystem.resolveMovement()) — quái mới là
// bên tiến vào từ phải.
export const HERO_HOME_X = 0

// Quái vào trận từ NGOÀI màn hình bên phải, tiến dần về phía hero.
export const ENEMY_SPAWN_X = 400

// Cao độ hiển thị — CHỈ ảnh hưởng vị trí Y trong MainScene.ts, combat
// (trúng đòn/sát thương/tầm bắn) vẫn thuần 1D theo trục X, không phân
// biệt lane. Tower defense: quái xuất hiện dưới đất/mặt đất/trên trời
// cho đa dạng hình ảnh, không phải 1 chiều gameplay riêng. Player
// luôn 'ground' (tower đứng trên đất).
export type EnemyLane = 'underground' | 'ground' | 'air'
