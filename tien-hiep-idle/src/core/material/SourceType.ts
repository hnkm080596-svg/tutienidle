// 4 nguồn tài nguyên theo MASTER SPEC — ECONOMY & TỨ NGHỆ v1.0, Mục II-V.
// Đây là nhãn PHÂN LOẠI (không phải ràng buộc cứng "chỉ nguồn này mới
// được rơi material này") — 1 material vẫn có thể xuất hiện ở nhiều
// drop table khác nhau (vd Xích Đồng rơi cả từ quái lẫn thám hiểm),
// field `Material.sourceType` chỉ đánh dấu nguồn CHÍNH/khái niệm nó
// thuộc về, dùng cho UI/lọc và đảm bảo mỗi "nhóm nguồn" có ít nhất 1
// material đại diện thật (đúng Mục IX — recipe cao cấp cần trộn
// nhiều sourceType).
export type SourceType = 'boss' | 'monster' | 'building' | 'exploration'
