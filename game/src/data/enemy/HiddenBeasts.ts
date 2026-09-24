import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'

// Quai an (spec dot-pha-loi-kiep sec.4.1c) - Huyet Mong KHONG thuoc
// enemyPool stage nao; chi tra tron pool spawn qua HiddenBeastSystem
// khi cua so 1000 kill mo (xem core/game/HiddenBeastSystem.ts).
// 2026-09-23: Thien Dia Chi Kieu signature line retired with the
// material (hidden-perfection-lineage sec.19); the Pham catch-up
// signature survives untouched.
export const HIDDEN_BEASTS: Enemy[] = [
  defineEnemy({
    id: 'huyet_mong',
    name: 'Huyết Mông',
    level: 10,
    realmId: 'qi_refining',
    lane: 'ground',
    archetype: 'melee',
    family: 'hidden_beast',
    statsInput: {
      maxHp: 2600,
      might: 130,
      attackSpeed: 1.1,
      criticalRate: 0.1,
      criticalDamage: 2.2,
      armor: 45,
      evasionRate: 10,
      resistances: { water: 10, fire: 10 },
      elemental: { element: 'water', power: 18 },
    },
    rewards: {
      techniqueMastery: 500,
      spiritStone: 150,
    },
    signatureDrops: [
      // M-QI-08 documented exception (spec sec.3.5): hand-placed Pham
      // catch-up bonus OUTSIDE the band authority - the band map
      // governs stage tables, not signature drops. Stays pham even
      // though huyet_mong sits in the qi_refining band.
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 12, max: 12 }, chance: 1 },
    ],
  }),
  // Hidden Perfection Lineage (design 2026-09-23 sec.9) - Co Thu, the
  // Ancient Beast of the mortal hidden-body trial. It replaces the WHOLE
  // normal battle (never a wave member): spawned only by
  // AncientBeastTrial.ts through the HiddenBattleReplacement seam.
  // undefeatable IS the semantic immortality contract (sec.9.3) - its
  // stats exist for HUD pressure/damage reads, never as a kill target.
  // Zero rewards across the board: settlement isolation (sec.9.4) - no
  // loot, no kill credit, nothing requiring an actual kill.
  defineEnemy({
    id: 'co_thu',
    name: 'Cổ Thú',
    level: 11,
    realmId: 'mortal',
    lane: 'ground',
    archetype: 'melee',
    family: 'hidden_beast',
    isBoss: true,
    undefeatable: true,
    statsInput: {
      // BALANCE: tuned to threaten ~8 rounds against a 6/6 mortal body -
      // hard hits, low armor/evasion (the beast is there to be weathered,
      // not out-raced).
      maxHp: 1500,
      might: 45,
      attackSpeed: 1.0,
      criticalRate: 0.08,
      criticalDamage: 2.0,
      armor: 30,
      evasionRate: 5,
      resistances: { fire: 15, water: 15, wood: 15, metal: 15, earth: 15 },
    },
    rewards: {
      techniqueMastery: 0,
      skillInsight: 0,
      spiritStone: 0,
    },
  }),
]

/** Template lookup by id - used by the hidden-battle launch path. */
export function getHiddenBeastById(id: string): Enemy | undefined {
  return HIDDEN_BEASTS.find((enemy) => enemy.id === id)
}
