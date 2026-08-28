// Ngũ Hành Châu — Bản Mệnh Pháp Bảo của Pháp Tu (doc §8). Đây là data
// MÔ TẢ (tên/mô tả milestone cho UI Phase 4) — số liệu THI HÀNH thật
// (coefficient/chu kỳ/ICD...) nằm trong core/artifact/ArtifactSystem.ts,
// không lặp lại ở đây để tránh 2 nguồn sự thật lệch nhau.
import type { ArtifactDefinition } from '../../core/artifact/Artifact'

export const NGU_HANH_CHAU_DEFINITION: ArtifactDefinition = {
  id: 'ngu_hanh_chau',
  name: 'Ngũ Hành Châu',
  cultivationPathId: 'phap_tu',
  unlockRealmId: 'foundation_establishment',
  paths: {
    attack: {
      path: 'attack',
      name: 'Ngũ Hành Liên Châu',
      milestones: [
        { level: 1, name: 'Action nền', description: 'Năm linh châu tự động phóng vào mục tiêu theo vòng xoay Ngũ Hành đã equip.' },
        {
          level: 3,
          name: 'Tụ Linh',
          description: '+15% sát thương artifact.',
        },
        {
          level: 6,
          name: 'Liên Châu',
          description: 'Thêm một hit bằng 55% hit chính, dùng hành kế trong vòng xoay.',
        },
        {
          level: 12,
          name: 'Ngũ Hành Cộng Minh',
          description: 'Hai hành khác nhau trúng cùng mục tiêu giảm 10% chu kỳ kế — tối đa một lần mỗi lượt kích hoạt. Hữu dụng nhất khi rút ngắn trận trước khi Boss enrage kịp stack.',
        },
        {
          level: 18,
          name: 'Vạn Tượng Quy Nhất',
          description: 'Lượt kích hoạt thứ năm phóng mọi hành đang equip vào mục tiêu chính; tổng sát thương có cap theo số hành.',
        },
      ],
    },
    defense: {
      path: 'defense',
      name: 'Ngũ Hành Hộ Thể',
      milestones: [
        { level: 1, name: 'Action nền (giảm)', description: 'Action nền, sát thương ×0.70 — đổi lại cho các milestone phòng thủ bên dưới.' },
        {
          level: 3,
          name: 'Châu Quang Hộ Thể',
          description: 'Cấp Hộ Thuẫn theo Power của hành vừa bắn, cap theo Khí huyết tối đa.',
        },
        {
          level: 6,
          name: 'Ngũ Khí Tuần Hoàn',
          description: 'Mỗi lượt kích hoạt cấp buff ngắn tăng Giảm Sát Thương Cuối — refresh thời lượng, không cộng dồn mức độ.',
        },
        {
          level: 12,
          name: 'Sinh Sinh Bất Tức',
          description: 'Hộ Thuẫn do artifact cấp, khi vỡ, sẽ hồi một phần sau thời gian hồi riêng — hữu dụng nhất khi trận kéo dài qua nhiều lần chuyển pha Boss.',
        },
        {
          level: 18,
          name: 'Ngũ Hành Hộ Giới',
          description: 'Lượt kích hoạt thứ năm tạo hộ giới ngắn tăng Kháng Dị Thường và Kháng Bạo Kích.',
        },
      ],
    },
    control: {
      path: 'control',
      name: 'Ngũ Hành Trấn Linh',
      milestones: [
        { level: 1, name: 'Action nền (giảm)', description: 'Action nền, sát thương ×0.80 — đổi lại cho các milestone khống chế bên dưới.' },
        {
          level: 3,
          name: 'Trệ Khí',
          description: 'Mỗi hit áp Làm Chậm ngắn lên mục tiêu.',
        },
        {
          level: 6,
          name: 'Ngũ Hành Phược',
          description: 'Ba hit artifact lên cùng mục tiêu trong một cửa sổ thời gian áp Trói Chân — có thời gian hồi riêng theo từng mục tiêu, tránh khoá cứng một con liên tục.',
        },
        {
          level: 12,
          name: 'Trấn Mạch',
          description: 'Mục tiêu đang bị Trói Chân nhận thêm giảm Tốc Đánh ngắn.',
        },
        {
          level: 18,
          name: 'Ngũ Châu Trấn Vực',
          description: 'Lượt kích hoạt thứ năm tác động vùng nhỏ quanh mục tiêu chính, áp Làm Chậm — Trói Chân chỉ xét mục tiêu chính, không lan theo vùng này.',
        },
      ],
    },
  },
}
