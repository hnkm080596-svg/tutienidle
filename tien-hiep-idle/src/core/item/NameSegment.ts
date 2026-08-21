// Tên vật phẩm ghép động (2026-08-15) — mỗi phần tên (Phẩm/Set/Địa
// Giới+Tên gốc) tô MÀU RIÊNG, cách nhau dấu "·" khi hiển thị (xem
// SlotView.vue's `nameSegments` prop). Dùng chung cho Equipment (xem
// EquipmentNaming.ts) VÀ Pill/Talisman/Formation (composePhamNameSegments
// bên dưới) — cùng 1 shape, khác số lượng segment theo loại item.
export interface NameSegment {
  text: string

  // Tên biến CSS custom property (vd '--item-rarity-hoang_pham'),
  // KHÔNG phải giá trị màu — SlotView tự bọc var(...). undefined =
  // dùng màu chữ mặc định (--text-primary).
  colorVar?: string
}
