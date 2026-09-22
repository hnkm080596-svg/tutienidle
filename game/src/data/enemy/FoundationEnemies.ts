import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'
import type { EnemySpecialAttack } from '../../core/enemy/Enemy'
import type { TribulationPhase, BossEnrage } from '../../core/enemy/TribulationPhase'
import type { SignatureDrop } from '../../core/drop/DropTable'

// ============================================================
// Trúc Cơ content pass M1 (2026-08-29) — 20 quái cho chương 3
// (stage `foundation_floor_1..10`, xem data/stage/Stages.ts), đúng
// "quy luật" Ngũ Hành Tương Sinh Mộc(1-2)->Hỏa(3-4)->Thổ(5-6)->
// Kim(7-8)->Thủy(9-10) và cấu trúc 2 loài/tầng (1 thường + 1
// boss-eligible, tầng chẵn tiền tố "Hung ") của Luyện Khí + Phàm Nhân,
// nhưng CÔNG THỨC RIÊNG (first pass, playtest chỉnh):
//   beastHP(T)   = round(450 * 1.15^(T-1))
//   beastATK(T)  = round(42  * 1.15^(T-1))
//   armor        = 18 + 2T
// Loài boss-eligible (2nd loài mỗi hành, luôn là bossEnemyId của
// Stage) = ×1.6 HP / ×1.4 ATK / ×1.3 armor, CÙNG T — vẫn
// PRE-multiplier (applyBossMultiplier tự nhân thêm ×7/×2.0 lúc spawn
// boss thật, không tự cộng dồn ở đây). attackSpeed author theo thang
// mới (0.8-2.5 đòn/giây, xem EnemyStatInput.normalizeEnemyAttackSpeed).
// Không material mới (tránh material chết không ai tiêu) — chỉ rơi
// Thập Niên Linh Khoáng (qi_refining_ore_decade, sink thật qua
// Cường Hóa/Tẩy Luyện + quest collect).
// ============================================================

// Boss tầng 10 (`foundation_floor_10`, Màn 3.10) — 2 phase theo mốc HP
// + enrage DPS check, đúng spec M1 mục 4.1 ("boss Trúc Cơ đầu tiên
// dùng cơ chế phase/enrage làm hình mẫu"). Primitive tái dùng chung
// với quái Kiếp (xem core/enemy/TribulationPhase.ts — BattleSystem
// updateTribulationPhases/updateEnrage generic cho mọi Enemy khai field).
const FLOOD_DRAGON_PHASES: TribulationPhase[] = [
  {
    hpThresholdPercent: 0.5,
    buff: {
      id: 'foundation_dragon_phase1',
      name: 'Giao Sủng Cuồng Nộ',
      description: 'Giao Sủng bộc phát sát khí khi mất nửa máu.',
      kind: 'buff',
      instanceScope: 'per_source',
      stacking: {
        maxStacks: 1,
        onReapplyStacks: 'replace',
        onReapplyDuration: 'refresh',
        replaceInstanceOnReapply: true,
      },
      lifetime: { clock: 'permanent', scaling: 'fixed' },
      statModifiers: [
        { stat: 'might', percent: 0.3 },
        { stat: 'speed', percent: 0.1 },
      ],
      dispellable: false,
    },
    message: 'Giao Sủng cuồng nộ — lôi kích bùng nổ!',
  },
  {
    hpThresholdPercent: 0.25,
    buff: {
      id: 'foundation_dragon_phase2',
      name: 'Giao Sủng Tuyệt Mệnh',
      description: 'Giao Sủng liều mạng tăng sát thương.',
      kind: 'buff',
      instanceScope: 'per_source',
      stacking: {
        maxStacks: 1,
        onReapplyStacks: 'replace',
        onReapplyDuration: 'refresh',
        replaceInstanceOnReapply: true,
      },
      lifetime: { clock: 'permanent', scaling: 'fixed' },
      statModifiers: [
        { stat: 'might', percent: 0.25 },
        { stat: 'criticalRate', percent: 0.15 },
      ],
      dispellable: false,
    },
    message: 'Giao Sủng tuyệt mệnh phản công!',
  },
]

const FLOOD_DRAGON_ENRAGE: BossEnrage = {
  afterSeconds: 60,
  buff: {
    id: 'foundation_dragon_enrage',
    name: 'Đại Vương Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Giao Sủng điên cuồng.',
    kind: 'buff',
    instanceScope: 'per_source',
    stacking: {
      maxStacks: 1,
      onReapplyStacks: 'replace',
      onReapplyDuration: 'refresh',
      replaceInstanceOnReapply: true,
    },
    lifetime: { clock: 'permanent', scaling: 'fixed' },
    statModifiers: [
      { stat: 'might', percent: 0.5 },
      { stat: 'speed', percent: 0.2 },
    ],
    dispellable: false,
  },
}

function foundationBeast(params: {
  id: string
  name: string
  t: number
  lane: 'ground' | 'air'
  archetype?: 'melee' | 'ranged' | 'caster'
  bossEligible: boolean
  element: 'wood' | 'fire' | 'earth' | 'metal' | 'water'
  power: number
  resistance: number
  tribulationPhases?: TribulationPhase[]
  enrage?: BossEnrage
  // Phase A2 (2026-09-07) — turn-based enrage trigger, threaded through
  // to defineEnemy() unchanged. Separate from the legacy `enrage` above.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
  specialAttacks?: EnemySpecialAttack[]
  // Per-enemy named drops (Task 6: floor-10 boss Chieu Hien Lenh) -
  // threaded to defineEnemy() unchanged, resolved by resolveDrops.
  signatureDrops?: SignatureDrop[]
}) {
  const hp = Math.round(450 * 1.15 ** (params.t - 1))
  const atk = Math.round(42 * 1.15 ** (params.t - 1))
  const armor = 18 + 2 * params.t

  // Stats keep the bossEligible bump; reward multipliers are gone - the
  // drop system (resolveDrops + BOSS/TINH_ANH modifiers, cap x4) owns
  // kill currency now. Leaving insight/stone here would smuggle the old
  // x2.5/x12.5 and x6/x15 coefficients past the economy guard.
  const mult = params.bossEligible
    ? { hp: 1.6, atk: 1.4, armor: 1.3 }
    : { hp: 1, atk: 1, armor: 1 }

  const techniqueMastery = 40 + 6 * params.t
  const stone = 8 + 2 * params.t

  return defineEnemy({
    id: params.id,
    name: params.name,
    level: params.t,
    realmId: 'foundation_establishment',
    lane: params.lane,
    archetype: params.archetype,
    tribulationPhases: params.tribulationPhases,
    enrage: params.enrage,
    bossTrigger: params.bossTrigger,
    specialAttacks: params.specialAttacks,
    signatureDrops: params.signatureDrops,
    statsInput: {
      maxHp: Math.round(hp * mult.hp),
      might: Math.round(atk * mult.atk),
      // Speed band ruling (2026-09-13): highest realm sits at the top of
      // the band, 1.2 (~1.2x player base 100) - speed grows only a small
      // fraction vs HP/ATK, not x2/x3 like legacy data (see Enemies.test).
      attackSpeed: 1.2,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: Math.round(armor * mult.armor),
      evasionRate: 20,
      resistances: { [params.element]: params.resistance },
      elemental: { element: params.element, power: params.power },
    },
    rewards: {
      techniqueMastery,
      spiritStone: stone,
    },
  })
}

export const FOUNDATION_ENEMIES: Enemy[] = [
  // --- Tầng 1-2 (Mộc, hậu sơn rừng già) ---
  foundationBeast({
    id: 'foundation_wood_ape',
    name: 'Viêm Giáp Viên',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 10,
    resistance: 10,
  }),
  foundationBeast({
    id: 'foundation_stone_fungus',
    name: 'Địa Tinh Giám',
    t: 1,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: true,
    element: 'wood',
    power: 10,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_wood_ape',
    name: 'Hung Viêm Giáp Viên',
    t: 2,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 10,
    resistance: 10,
  }),
  foundationBeast({
    id: 'foundation_ferocious_stone_fungus',
    name: 'Hung Địa Tinh Giám',
    t: 2,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: true,
    element: 'wood',
    power: 10,
    resistance: 12,
  }),

  // --- Tầng 3-4 (Hỏa, hỏa địa hậu sơn) ---
  foundationBeast({
    id: 'foundation_lava_hound',
    name: 'Dực Hỏa Khuyển',
    t: 3,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'fire',
    power: 11,
    resistance: 11,
  }),
  foundationBeast({
    id: 'foundation_sand_scorpion',
    name: 'Sa Hắc',
    t: 3,
    lane: 'ground',
    archetype: 'ranged',
    bossEligible: true,
    element: 'fire',
    power: 11,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_ferocious_lava_hound',
    name: 'Hung Dực Hỏa Khuyển',
    t: 4,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'fire',
    power: 11,
    resistance: 11,
  }),
  foundationBeast({
    id: 'foundation_ferocious_sand_scorpion',
    name: 'Hung Sa Hắc',
    t: 4,
    lane: 'ground',
    archetype: 'ranged',
    bossEligible: true,
    element: 'fire',
    power: 11,
    resistance: 14,
  }),

  // --- Tầng 5-6 (Thổ, thạch cốc hậu sơn) ---
  foundationBeast({
    id: 'foundation_rock_tortoise',
    name: 'Thạch Giáp Quy',
    t: 5,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'earth',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_mud_golem',
    name: 'Nê Cự Nhân',
    t: 5,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'earth',
    power: 12,
    resistance: 16,
  }),
  foundationBeast({
    id: 'foundation_ferocious_rock_tortoise',
    name: 'Hung Thạch Giáp Quy',
    t: 6,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'earth',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_mud_golem',
    name: 'Hung Nê Cự Nhân',
    t: 6,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'earth',
    power: 12,
    resistance: 16,
  }),

  // --- Tầng 7-8 (Kim, thiết mãng lệnh) ---
  foundationBeast({
    id: 'foundation_metal_beetle_swarm',
    name: 'Kim Giáp Trùng Quần',
    t: 7,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'metal',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_blade_hawk_king',
    name: 'Đoạn Nhận Ưng Vương',
    t: 7,
    lane: 'air',
    archetype: 'ranged',
    bossEligible: true,
    element: 'metal',
    power: 12,
    resistance: 16,
  }),
  foundationBeast({
    id: 'foundation_ferocious_metal_beetle_swarm',
    name: 'Hung Kim Giáp Trùng Quần',
    t: 8,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'metal',
    power: 12,
    resistance: 12,
  }),
  foundationBeast({
    id: 'foundation_ferocious_blade_hawk_king',
    name: 'Hung Đoạn Nhận Ưng Vương',
    t: 8,
    lane: 'air',
    archetype: 'ranged',
    bossEligible: true,
    element: 'metal',
    power: 12,
    resistance: 16,
  }),

  // --- Tầng 9-10 (Thủy, hàn thạch đàm — chặng cuối Trúc Cơ) ---
  foundationBeast({
    id: 'foundation_mist_shark',
    name: 'Vụ Cáp',
    t: 9,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'water',
    power: 14,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_flood_dragon_whelp',
    name: 'Giao Sủng',
    t: 9,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'water',
    power: 14,
    resistance: 20,
  }),
  foundationBeast({
    id: 'foundation_ferocious_mist_shark',
    name: 'Hung Vụ Cáp',
    t: 10,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'water',
    power: 14,
    resistance: 14,
  }),
  foundationBeast({
    id: 'foundation_ferocious_flood_dragon_whelp',
    name: 'Hung Giao Sủng',
    t: 10,
    lane: 'ground',
    archetype: 'caster',
    bossEligible: true,
    element: 'water',
    power: 14,
    resistance: 20,
    tribulationPhases: FLOOD_DRAGON_PHASES,
    enrage: FLOOD_DRAGON_ENRAGE,
    // Phase A2 (2026-09-07) — turn-based twin of the legacy `enrage`
    // above (same 60-turn magnitude); kept alongside until roadmap C1
    // removes the legacy engine. Buff resolves via BUFF_REGISTRY.
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'foundation_dragon_enrage' },
    // Combat Balance Pass (2026-08-29, plan §3.6) — boss mẫu có action
    // đặc biệt data-driven: mỗi đòn thứ 4 là "Nuốt Sóng" — đòn nước nặng
    // (×2.5 damage) với preset riêng, windup caster chuẩn. Số minh hoạ,
    // playtest chỉnh. Boss KHÁC chưa khai — tiếp tục basic attack cứng.
    // Phase A3 Task 5 — turn engine now READS this field (see
    // TurnBattleSystem's specialAttackCounter), so this existing example
    // is live in turn-based combat as of A3.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],
    signatureDrops: [
      // Companion gacha (Task 6) - chapter-3 floor-10 boss drops 3x
      // Chieu Hien Lenh; boss-only via requiresModifier.
      { kind: 'material', itemId: 'chieu_hien_lenh', amount: { min: 3, max: 3 }, chance: 1, requiresModifier: 'boss' },
    ],
  }),
]
