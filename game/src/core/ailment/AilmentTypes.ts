// 'modifier' — ailment chỉ đổi stat theo thời hạn (Làm Chậm/Cuồng Bạo/
// Suy Nhược/Uy Áp/Hàn Khí/Thạch Hóa), KHÔNG chặn hành động/di chuyển
// như 'cc' (Choáng/Đóng Băng) và không tự trừ HP như 'dot'.
//
// "Alignment" (khái niệm dùng để ReactionManager quét cặp, xem
// core/element/ElementReaction.ts) KHÔNG PHẢI 1 category riêng —
// Plans/magicpathgeneral Phase 1 (2026-08-21) từng thêm category
// 'alignment' cho phép 1 ailment tồn tại thuần làm marker (0 hiệu
// ứng thật, vd Thạch Hóa lúc đó). Người dùng phản hồi 2026-08-21 (cùng
// ngày, sau khi Thạch Hóa được thêm on-hit-proc): MỌI ailment đóng
// vai trò Alignment BẮT BUỘC phải tự mang tác dụng cơ chế thật (dot/cc/
// modifier), KHÔNG được là "ailment có hình nhưng không tác dụng" —
// category 'alignment' vì vậy bị XOÁ HẲN (không còn cách nào tạo 1
// ailment rỗng nữa, ép mọi ailment mới phải chọn đúng 1 trong 3
// category có tác dụng thật bên dưới). "Alignment" giờ CHỈ còn là 1
// VAI TRÒ mà bất kỳ
// ailment nào (dot/cc/modifier) cũng có thể đảm nhiệm thêm — Bỏng vừa
// là DoT vừa là vế "Hỏa" cho Bốc Hơi, Thạch Hóa vừa là modifier
// (evasionRate) vừa là vế "Thổ" cho Dung Nham/Trói Chân/Độc Thế —
// ReactionManager quét theo AilmentId, không phân biệt category.
export type AilmentCategory = 'dot' | 'cc' | 'modifier'

// Rập khuôn BuffStackMode — 'stack' cộng thêm lớp (tăng damagePerSecond
// tổng), 'refresh' chỉ làm mới thời lượng, 'replace' thay hẳn instance
// cũ (dùng cho DoT muốn nguồn MỚI NHẤT ghi đè, không cộng dồn).
export type AilmentStackMode = 'stack' | 'refresh' | 'replace'

export type AilmentId =
  | 'bong'        // Bỏng — DoT (Hỏa)
  | 'trung_doc'   // Trúng Độc — DoT (Mộc)
  | 'chay_mau'    // Chảy Máu — DoT (Kim, xem ghi chú retag trong data/ailment/ailments.ts)
  | 'te_cong'     // Tê Cóng — DoT (Thủy)
  | 'hoai_tu'     // Hoại Tử — DoT (Thổ)
  | 'choang'      // Choáng — CC (dừng hành động, KHÔNG chặn di chuyển)
  | 'dong_bang'   // Đóng Băng — CC (dừng hoàn toàn, kể cả di chuyển)
  | 'lam_cham'    // Làm Chậm — modifier (giảm % attackSpeed + movementSpeed), giữ
                   // liên tục đủ 2s tự động biến thành Đóng Băng (Pháp Tu Thủy Tu)
  | 'han_khi'     // Hàn Khí (Chill) — modifier nhẹ, tích đủ N lần trong X giây tự
                   // động biến thành Đóng Băng (xem AilmentSystem.apply())
  | 'cuong_bao'   // Cuồng Bạo (Haste) — modifier buff tốc đánh/di chuyển
  | 'suy_nhuoc'   // Suy Nhược (Frailty) — modifier debuff phòng ngự
  | 'uy_ap'       // Uy Áp (Dread) — modifier debuff sát thương gây ra
  | 'giap_ran'    // Giáp Rạn (Pháp Tu Kim Tu) — modifier debuff metalResistance
  | 'van_kiem_vu' // Vạn Kiếm Vũ (Kiếm Tu) — DoT (Kim), bỏ qua giáp/kháng theo cảnh giới
  | 'thach_hoa'   // Thạch Hóa (Pháp Tu Thổ Tu) — modifier debuff THẬT (-evasionRate,
                   // "đá hóa thì không né được"), CỘNG THÊM 50% Choáng mỗi đòn đánh
                   // trúng trong lúc active (onHitChance, xem AilmentSystem.
                   // rollOnHitEffects()) VÀ vẫn là vế Reaction cho Dung Nham/Trói
                   // Chân/Độc Thế (xem data/element/ElementReaction.ts) — KHÔNG còn
                   // là marker rỗng, xem AilmentCategory's ghi chú ở trên.
  | 'troi_chan'   // Trói Chân (Thổ+Thủy Reaction) — CC 'root' (chặn di chuyển, KHÔNG
                   // chặn attack/cast, khác Đóng Băng)
  | 'dung_nham'   // Dung Nham (Thổ+Hỏa Reaction) — DoT, xem AilmentSystem's ghi chú
  | 'huyet_doc'   // Huyết Độc (Mộc+Kim Reaction, Plans/KimPath mục 6) — Poison+Bleed
                   // "hợp nhất" thành 1 DoT mạnh hơn, xem ElementReaction.ts's ghi chú

// 'root' (Thổ Tu, Plans/EarthPath mục VI, 2026-08-21) — CHỈ chặn di
// chuyển (xem BattleSystem.resolveMovement()), KHÔNG chặn action như
// 'stun'/'freeze' (isIncapacitated() KHÔNG tính 'root'), đúng doc
// "vẫn attack/cast được".
export type AilmentCcEffect = 'stun' | 'freeze' | 'root'
