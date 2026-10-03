// Duong cong giam dan kieu Last Epoch - thay han cong thuc tru thang
// "might - defense" cu (de vo hieu hoan toan hoac vo dung tuy chenh
// lech, khong muot xuyen suot game). Dung cho damage type 'physical'
// (might vs defense) - Hon Nguyen (primordial) KHONG di qua day
// (bo qua Armor hoan toan theo dung yeu cau).
//
// T5.4 (2026-09-01, user-approved phuong an A): K scale theo
// realmIndex cua TARGET (ben chiu don) - K = 50 x (1 + realmIndex x 0.8).
// DNA Last Epoch giu nguyen (armor cung gia tri giam hieu luc dan theo
// tien trinh, ep farm armor moi khi len realm), nhung bac la realm
// (10 bac) thay vi per-level - khop mo hinh realm-tier cua game, khong
// phat trong cung realm (tang khong lam armor kem di).
const ARMOR_K_BASE = 50
const ARMOR_K_PER_REALM = 0.8

// Tran 75% - khong the tro nen bat tu chi bang cach stack Armor,
// dung tinh than Last Epoch that.
const ARMOR_CAP = 0.75

/**
 * Hang so K cua duong cong armor theo realm cua ben CHIU DON.
 * Pham Nhan (0): 50. Kim Dan (4): 210. Do Kiep (9): 410.
 */
export function armorKForRealm(realmIndex: number): number {
  const safeIndex = Number.isFinite(realmIndex) ? Math.max(0, realmIndex) : 0

  return ARMOR_K_BASE * (1 + safeIndex * ARMOR_K_PER_REALM)
}

/**
 * armor=10 (quai yeu, Pham Nhan) -> 10/60 ~ 16.7%. armor=150 o
 * Pham Nhan -> 150/200 = 75% (cham tran); cung armor 150 o Do Kiep
 * (K=410) -> 27% - armor cu tu giam hieu luc, dung nhip voi attack
 * scale theo realm (mainStat globalLevel - 2 truc di cung nhip).
 *
 * @param armor     chi so armor (defense) cua ben chiu don
 * @param realmIndex realmIndex cua ben chiu don (default 0 - giu
 *                  tuong thich callers cu; hay truyen tu CombatEntity)
 */
export function getArmorMitigationPercent(armor: number, realmIndex = 0): number {
  if (armor <= 0) {
    return 0
  }

  const k = armorKForRealm(realmIndex)

  return Math.min(ARMOR_CAP, armor / (armor + k))
}
