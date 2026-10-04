// 4 nguon tai nguyen theo MASTER SPEC - ECONOMY & TU NGHE v1.0, Muc II-V.
// Day la nhan PHAN LOAI (khong phai rang buoc cung "chi nguon nay moi
// duoc roi material nay") - 1 material van co the xuat hien o nhieu
// drop table khac nhau (vd Xich Dong roi ca tu quai lan tham hiem),
// field `Material.sourceType` chi danh dau nguon CHINH/khai niem no
// thuoc ve, dung cho UI/loc va dam bao moi "nhom nguon" co it nhat 1
// material dai dien that (dung Muc IX - recipe cao cap can tron
// nhieu sourceType).
export type SourceType = 'boss' | 'monster' | 'building' | 'exploration'
