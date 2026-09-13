// SlotState (Battlefield Slot spec, 2026-09-06) — vocabulary chung cho
// trạng thái tương tác của 1 ô chiến trường, dùng bởi panel Trận Pháp hôm
// nay (combat thật chưa có tương tác click/kéo trên ô, nhưng type nằm ở
// đây để tính năng sau — targeting thủ công, tooltip theo ô — không phải
// tự bịa lại 1 bộ tên khác).
export type SlotState = 'enabled' | 'locked' | 'disabled' | 'hover' | 'occupied'
