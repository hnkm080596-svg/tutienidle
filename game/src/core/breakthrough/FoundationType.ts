// Can Co (muc 5/17 spec `breakthrough`) - cac moc ket qua cua cap dot
// pha. Thiet ke hien tai (2026-08-27) moi mo moc baseline 'human'
// (Nhan Dao o moc 12 tang); cac moc an khac se duoc thiet ke sau.
// KHONG BAO GIO hien thi lam lua chon hay lo ly do resolve ra moc nao
// (muc 10 - hard rule "khong bao gio bao sai dieu kien").
export type FoundationType = 'human' | 'earth' | 'heaven' | 'great_dao'

export const FOUNDATION_LABELS: Record<FoundationType, string> = {
  human: 'Nhân Đạo',
  earth: 'Địa Đạo',
  heaven: 'Thiên Đạo',
  great_dao: 'Đại Đạo',
}
