import type { Skill } from '../../core/skill/Skill'
import { TRAN_SEQUENCE } from '../progression/KiemTuNodes'

// 9 skill Kiáº¿m Tráº­n (chiÃªu tráº­n) â€” table-driven tá»« `TRAN_SEQUENCE`
// (KiemTuNodes.ts, dÃ¹ng chung vá»›i cÃ¡c keystone tÆ°Æ¡ng á»©ng Ä‘á»ƒ trÃ¡nh Ä‘á»‹nh
// nghÄ©a láº¡i chuá»—i id/realmId/swordCount láº§n 2 â€” Task 5 review fix,
// 2026-08-28). Má»—i tráº­n unlock qua 1 keystone riÃªng (kiem_tran_luong_nghi
// â€¦ kiem_tran_vo_cuc), cadence attack_speed nhÆ° Huy Kiáº¿m/Ngá»± Kiáº¿m Thuáº­t.
// swordCount cÃ ng lá»›n thÃ¬ damage/swordIntentDamageRatio cÃ ng cao â€” "dá»±a
// vÃ o sá»‘ Kiáº¿m Ã Ä‘ang cÃ³" cÃ¹ng cÃ´ng thá»©c Kiáº¿m Khai ThiÃªn MÃ´n. CÃ´ng thá»©c:
// value = 0.5 + swordCount Ã— 0.1; swordIntentDamageRatio = 0.0002 Ã— swordCount
// (sá»‘ liá»‡u GIá»® NGUYÃŠN so vá»›i báº£n hand-written trÆ°á»›c review fix â€” refactor
// thuáº§n cáº¥u trÃºc, khÃ´ng Ä‘á»•i con sá»‘).
export const KIEM_TRAN_SKILLS: Skill[] = TRAN_SEQUENCE.map((entry) => ({
  id: entry.skillId,

  name: entry.name,

  description: entry.skillDescription ?? `Bày ${entry.name}, ${entry.swordCount} thanh phi kiếm hợp lực chém liên hoàn.`,

  type: 'active',

  level: 1,

  maxLevel: 10,

  requiredRealmId: entry.realmId,

  cooldown: 1,


  target: 'all_enemies',

  execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },

  effects: [
    {
      type: 'damage',

      // Round â€” 0.5 + swordCount*0.1 / 0.0002*swordCount trÃ´i float
      // (vd swordCount=3 â†’ 0.0006000000000000001) náº¿u khÃ´ng lÃ m trÃ²n vá»
      // Ä‘Ãºng Ä‘á»™ chÃ­nh xÃ¡c cá»§a cÃ´ng thá»©c gá»‘c; giá»¯ NGUYÃŠN sá»‘ liá»‡u hand-written
      // trÆ°á»›c review fix (khÃ´ng lá»‡ch dÃ¹ chá»‰ 1e-16).
      value: Math.round((0.5 + entry.swordCount * 0.1) * 10) / 10,

      components: [{ kind: 'element', element: 'metal', ratio: 1 }],

      swordIntentDamageRatio: Math.round(0.0002 * entry.swordCount * 10000) / 10000,

      // Task 8 (2026-08-28) â€” Kiáº¿m Tráº­n keystone (Tam TÃ i) spawn 1
      // SwordZone táº¡i target sau khi báº¯n, xem SkillEffect.grantsSwordZone.
      // CHá»ˆ Ã¡p cho kiem_tran_tam_tai â€” 8 tráº­n cÃ²n láº¡i váº«n plain damage.
      ...(entry.skillId === 'kiem_tran_tam_tai'
        ? { grantsSwordZone: true, swordZoneCharges: 3, swordZoneDamageRatio: 0.3 }
        : {}),
    },
  ],

  resourceType: 'none',

  buildTag: 'core',

  unlocked: false,

  equipped: false,
}))
