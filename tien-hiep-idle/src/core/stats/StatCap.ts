import { getRealmIndex } from '../realm/realmSystem'

// PLAN HOÀN CHỈNH mục 3 — trần của MỖI Main Stat. CỐ Ý KHÔNG dùng
// RealmData.attributeCap — field đó đã có ý nghĩa RIÊNG (trần cộng dồn
// vĩnh viễn từ Đan dược, xem PillSystem.canUse()), chỉ định nghĩa cho
// 3/10 cảnh giới — tái dùng tên/field đó cho Main Stat sẽ đụng độ.
//
// 2026-08-20 (Realm Passive & Pressure follow-up) — thay công thức x2
// mỗi đại cảnh giới cũ bằng bảng số liệu tay cho 3 cảnh giới đầu (yêu
// cầu cụ thể: Phàm Nhân 10 / Luyện Khí 30 / Trúc Cơ 100, không còn
// theo cấp số nhân sạch x2 nữa). baseStats khởi điểm mỗi Main Stat = 1
// (xem StatBlock.ts's createBaseStats()) — trần 10 ở Phàm Nhân cho
// đúng 9 điểm headroom để đầu tư trong 18 tầng.
const MAIN_STAT_CAP_BY_REALM_ID: Record<string, number> = {
  pham_nhan: 10,
  qi_refining: 30,
  foundation: 100,
}

// Cảnh giới CHƯA có số liệu tay ở trên (Kim Đan trở đi) — tiếp tục
// nhân đôi mỗi đại cảnh giới, neo vào trần Trúc Cơ (100) thay vì công
// thức 10*2^index cũ, để không bị "gãy khúc" ngay sau Trúc Cơ.
const FALLBACK_ANCHOR_REALM_INDEX = 2
const FALLBACK_ANCHOR_CAP = 100

export function getMainStatCap(realmId: string): number {
  const explicit = MAIN_STAT_CAP_BY_REALM_ID[realmId]

  if (explicit !== undefined) {
    return explicit
  }

  const realmIndex = getRealmIndex(realmId)

  return FALLBACK_ANCHOR_CAP * 2 ** Math.max(0, realmIndex - FALLBACK_ANCHOR_REALM_INDEX)
}
