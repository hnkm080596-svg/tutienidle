// SlotState (Battlefield Slot spec, 2026-09-06) - vocabulary chung cho
// trang thai tuong tac cua 1 o chien truong, dung boi panel Tran Phap hom
// nay (combat that chua co tuong tac click/keo tren o, nhung type nam o
// day de tinh nang sau - targeting thu cong, tooltip theo o - khong phai
// tu bia lai 1 bo ten khac).
export type SlotState = 'enabled' | 'locked' | 'disabled' | 'hover' | 'occupied'
