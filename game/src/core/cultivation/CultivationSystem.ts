import type { PlayerData } from '../player/Player'
import {
  getRequiredCultivation,
  getCurrentRealm,
} from '../realm/realmSystem'
import { hasCultivationOverflowBank } from '../talent/TalentEffects'
import { resolveFinalCultivationGain } from './CultivationDiversion'
// Side-effect import: module-load registration of the Quan The diverter
// into CultivationDiversion (design 2026-09-23 sec.10, HIDDEN-B).
import '../realm/hidden/QuanTheDiversion'

export function addCultivation(
  player: PlayerData,
  amount: number,
) {
  // Hidden Perfection Lineage (2026-09-23, master spec sec.4.5.1): the
  // FINAL-gain diversion seam - Quan The (HIDDEN-B) and later mechanism
  // diverts run here, BEFORE the cap clamp and before any persistence
  // or banked-overflow semantics (they see the post-diversion amount).
  // The chain is total-conserving: a registered diversion owns how
  // much cultivation lands; an unregistered player passes through.
  amount = resolveFinalCultivationGain(player, amount)

  const required = getRequiredCultivation(
    player.realmId,
    player.realmLevel,
  )

  // Khong tich luy du qua muc can de dot pha - chan o "required" thay
  // vi cong thang roi de tran, tranh truong hop AFK lau tich duoc vai
  // lan "required" roi bam dot pha mot phat nhay nhieu tang. Dot pha
  // xong van tu reset cultivation = 0 nhu cu (xem breakthrough()).
  //
  // Talent v4 M2 - Hai Nap (spec S4.3): phan tran khong mat ma ngan vao
  // cultivationOvercharge; breakthrough() rot ngan quy sang tang moi.
  const total = player.cultivation + amount

  if (total > required && hasCultivationOverflowBank(player.selectedTalentIds, player.talentLevels)) {
    player.cultivationOvercharge += total - required
    player.cultivation = required
    return
  }

  player.cultivation = Math.min(total, required)
}

/**
 * Hai Nap (M2) - pour the banked overflow into the current level, capped
 * at that level's required so one breakthrough never skips a second
 * tier; leftover stays banked for the next breakthrough. Shared by the
 * minor-tier breakthrough() below and the major-realm transition in
 * TribulationOutcomeService.
 */
export function pourCultivationOvercharge(player: PlayerData): void {
  if (player.cultivationOvercharge <= 0) {
    return
  }

  const required = getRequiredCultivation(player.realmId, player.realmLevel)
  const poured = Math.min(player.cultivationOvercharge, required)
  player.cultivation = Math.min(player.cultivation + poured, required)
  player.cultivationOvercharge -= poured
}

export function canBreakthrough(player: PlayerData): boolean {
  const required = getRequiredCultivation(
    player.realmId,
    player.realmLevel,
  )

  return player.cultivation >= required
}

export function breakthrough(player: PlayerData): boolean {
  if (!canBreakthrough(player)) {
    return false
  }

  const realm = getCurrentRealm(player.realmId)

  if (player.realmLevel < realm.maxLevel) {
    player.cultivation = 0

    player.realmLevel++

    // Hai Nap (M2): the banked overflow pours into the new tier.
    pourCultivationOvercharge(player)

    // skill-insight-and-auto-combat-hud-plan.md muc 1 - dot pha tieu
    // canh gioi KHONG con cap diem progression skill nua (skillPoints
    // cu da xoa han khoi PlayerData). Cam ngo Ky nang (skillInsight)
    // gio CHI den tu chien dau, xem GameManager.grantBattleRewardIfNeeded().

    // 2026-08-20 (Realm Passive & Pressure follow-up) - doi tu ramp
    // "1-9 diem tuy tieu canh gioi" (PLAN HOAN CHINH muc 2 cu) sang
    // FLAT +1/tang, cung nhip skillPoints ngay duoi - ramp cu khien so
    // diem CONG DON moi lan dot pha trung luon voi realmLevel vua dat,
    // de hieu lam la bug (yeu cau nguoi dung: "moi tang cho 1 diem
    // thuoc tinh"). Cap CUNG luc skillPoints (cung 1 su kien dot pha),
    // nhung la 2 ho diem HOAN TOAN tach biet (xem Player.ts's
    // attributePoints).
    player.attributePoints++

    return true
  }

  // Dot Pha tong quat (2026-08-16) - MOI luot chuyen dai canh gioi gio
  // deu bat buoc di qua 1 nghi le rieng thay vi "Dot Pha" thuong: chon
  // Phap Tu/Kiem Tu cho Pham Nhan->Luyen Khi
  // (GameManager.chooseCultivationPath()), hoac Do Kiep cho moi canh
  // gioi con lai (GameManager.startTribulation(), panel vat pham yeu
  // cau - xem composables/useTribulation.ts). breakthrough() thuong
  // KHONG BAO GIO tu nhay dai canh gioi nua, bat ke dang o canh gioi
  // nao - khong con can check rieng tung realmId nhu truoc. Cultivation
  // van giu nguyen o muc required (da chan o addCultivation), cho phep
  // nguoi choi thu lai nghi le bat ky luc nao ma khong mat tu vi.
  return false
}