import { defineEnemy } from '../../core/enemy/Enemy'
import type { Enemy } from '../../core/enemy/Enemy'
import type { EnemySpecialAttack } from '../../core/enemy/Enemy'
import type { CombatVfxPresetId } from '../../core/battle/CombatAction'
import type { TribulationPhase, BossEnrage } from '../../core/enemy/TribulationPhase'
import type { SignatureDrop } from '../../core/drop/DropTable'

// ============================================================
// Truc Co content pass M1 (2026-08-29) - 20 quai cho chuong 3
// (stage `foundation_floor_1..10`, xem data/stage/Stages.ts), dung
// "quy luat" Ngu Hanh Tuong Sinh Moc(1-2)->Hoa(3-4)->Tho(5-6)->
// Kim(7-8)->Thuy(9-10) va cau truc 2 loai/tang (1 thuong + 1
// boss-eligible, tang chan tien to "Hung ") cua Luyen Khi + Pham Nhan,
// nhung CONG THUC RIENG (first pass, playtest chinh):
//   beastHP(T)   = round(450 * 1.15^(T-1))
//   beastATK(T)  = round(42  * 1.15^(T-1))
//   armor        = 18 + 2T
// Loai boss-eligible (2nd loai moi hanh, luon la bossEnemyId cua
// Stage) = x1.6 HP / x1.4 ATK / x1.3 armor, CUNG T - van
// PRE-multiplier (applyBossMultiplier tu nhan them x7/x2.0 luc spawn
// boss that, khong tu cong don o day). attackSpeed author theo thang
// moi (0.8-2.5 don/giay, xem EnemyStatInput.normalizeEnemyAttackSpeed).
// Khong material moi (tranh material chet khong ai tieu) - chi roi
// Thap Nien Linh Khoang (qi_refining_ore_decade, sink that qua
// Cuong Hoa/Tay Luyen + quest collect).
// ============================================================

// Boss tang 10 (`foundation_floor_10`, Man 3.10) - 2 phase theo moc HP
// + enrage DPS check, dung spec M1 muc 4.1 ("boss Truc Co dau tien
// dung co che phase/enrage lam hinh mau"). Primitive tai dung chung
// voi quai Kiep (xem core/enemy/TribulationPhase.ts - BattleSystem
// updateTribulationPhases/updateEnrage generic cho moi Enemy khai field).
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
  // When true, `resistance` applies to all five elements instead of only
  // the beast's own element (stage-boss elemental fairness).
  uniformResistance?: boolean
  tribulationPhases?: TribulationPhase[]
  enrage?: BossEnrage
  // Phase A2 (2026-09-07) - turn-based enrage trigger, threaded through
  // to defineEnemy() unchanged. Separate from the legacy `enrage` above.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
  specialAttacks?: EnemySpecialAttack[]
  // Monster attack VFX sweep (2026-10-04) - basic attack's authored VFX
  // identity; threaded to defineEnemy() unchanged.
  attackPresetId?: CombatVfxPresetId
  // Per-enemy named drops (Task 6: floor-10 boss Chieu Hien Lenh) -
  // threaded to defineEnemy() unchanged, resolved by resolveDrops.
  signatureDrops?: SignatureDrop[]
  // BETA SCOPE LOCK v2 Phase-5 - "ho quai" label forwarded to
  // defineEnemy (the family drop-table layer reads it; the foundation
  // tier previously never passed it, so only beasts whose family table
  // needs them declare one).
  family?: string
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
    attackPresetId: params.attackPresetId,
    signatureDrops: params.signatureDrops,
    family: params.family,
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
      resistances: params.uniformResistance
        ? {
            wood: params.resistance,
            fire: params.resistance,
            earth: params.resistance,
            metal: params.resistance,
            water: params.resistance,
          }
        : { [params.element]: params.resistance },
      elemental: { element: params.element, power: params.power },
    },
    rewards: {
      techniqueMastery,
      spiritStone: stone,
    },
  })
}

export const FOUNDATION_ENEMIES: Enemy[] = [
  // --- Tang 1-2 (Moc, hau son rung gia) ---
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

  // --- Tang 3-4 (Hoa, hoa dia hau son) ---
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
    attackPresetId: 'fire_burst',
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
    // BETA SCOPE LOCK v2 Phase-5 - roster species carrying the
    // re-sourced base_gioi family drop (was metal_beetle's pool).
    family: 'sand_scorpion',
    attackPresetId: 'claw',
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
    // Same species family as the roster normal (data truth; the ferocious
    // variant is off-roster in beta so the pool never fires here).
    family: 'sand_scorpion',
  }),

  // --- Tang 5-6 (Tho, thach coc hau son) ---
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
    attackPresetId: 'boss_ground_slam',
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

  // --- Tang 7-8 (Kim, thiet mang lenh) ---
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

  // --- Tang 9-10 (Thuy, han thach dam - chang cuoi Truc Co) ---
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
  defineEnemy({
    id: 'foundation_ferocious_flood_dragon_whelp',
    name: 'Hung Giao Sủng',
    level: 10,
    realmId: 'foundation_establishment',
    lane: 'ground',
    archetype: 'caster',
    tribulationPhases: FLOOD_DRAGON_PHASES,
    enrage: FLOOD_DRAGON_ENRAGE,
    // Phase A2 (2026-09-07) - turn-based twin of the legacy `enrage`
    // above (same 60-turn magnitude); kept alongside until roadmap C1
    // removes the legacy engine. Buff resolves via BUFF_REGISTRY.
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'foundation_dragon_enrage' },
    // Combat Balance Pass (2026-08-29, plan sec3.6) - boss mau co action
    // dac biet data-driven: moi don thu 4 la "Nuot Song" - don nuoc nang
    // (x2.5 damage) voi preset rieng, windup caster chuan. So minh hoa,
    // playtest chinh. Boss KHAC chua khai - tiep tuc basic attack cung.
    // Phase A3 Task 5 - turn engine now READS this field (see
    // TurnBattleSystem's specialAttackCounter), so this existing example
    // is live in turn-based combat as of A3.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'water_surge' }],
    // Dragon whelp rends with its claws between the authored water
    // special casts.
    attackPresetId: 'claw',
    statsInput: {
      // Beta P8 (2026-09-30) - literal stats replace the shared
      // foundationBeast formula for the act-3 boss only. The formula
      // (t10 boss-eligible: 2532 hp / 207 might) put the floor-10 boss
      // variant at ~17.7k/414 - far past every beta element kit's legal
      // output (~300-350/cast, ~600hp at foundation:10 geared). Retuned
      // so the variant lands ~3850/70: a ~13-cast duel the strong
      // element build wins narrowly, ~1.2x the act-2 boss variant.
      maxHp: 550,
      might: 35,
      attackSpeed: 1.2,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: 34,
      evasionRate: 20,
      // Uniform across the five elements (stage-boss fairness).
      resistances: { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 },
      elemental: { element: 'water', power: 14 },
    },
    rewards: {
      techniqueMastery: 100,
      spiritStone: 28,
    },
    signatureDrops: [
      // Companion gacha (Task 6) - chapter-3 floor-10 boss drops 3x
      // Chieu Hien Lenh; boss-only via requiresModifier.
      { kind: 'material', itemId: 'chieu_hien_lenh', amount: { min: 3, max: 3 }, chance: 1, requiresModifier: 'boss' },
    ],
  }),

  // --- Roster remap (2026-10-04): moi canh gioi chi mot loai quai.
  // Truc Co = ho Linh Lang: normal + tinh anh (tinh_anh tag roll luc
  // spawn, khong phai id rieng) + Linh Lang Vuong boss tang 10. ---
  foundationBeast({
    id: 'foundation_spirit_wolf',
    name: 'Linh Lang',
    t: 4,
    lane: 'ground',
    archetype: 'melee',
    bossEligible: false,
    element: 'wood',
    power: 12,
    resistance: 12,
    family: 'wolf',
    attackPresetId: 'bite',
  }),
  defineEnemy({
    id: 'foundation_ferocious_spirit_wolf',
    name: 'Linh Lang Vương',
    level: 10,
    realmId: 'foundation_establishment',
    lane: 'ground',
    archetype: 'melee',
    family: 'wolf',
    attackPresetId: 'bite',
    // Bite flurry finisher every 4th own action - same cadence the
    // chapter-3 boss slot carried before (whelp water_surge). Batch-2
    // VFX (2026-10-04): renders the authored multi-bite - Minh's mapping.
    specialAttacks: [{ everyNth: 4, damageMultiplier: 2.5, presetId: 'bite_multi' }],
    // Turn-based enrage trigger; buff resolves through BUFF_REGISTRY.
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'foundation_wolf_king_enrage' },
    statsInput: {
      // Boss-tier literal (same shell the flood-dragon whelp carried):
      // createBossVariant x7 hp / x2 might / x1.2 armor lands the duel
      // in the ~13-cast window a strong foundation kit wins narrowly.
      maxHp: 550,
      might: 35,
      attackSpeed: 1.2,
      criticalRate: 0.08,
      criticalDamage: 2,
      armor: 34,
      evasionRate: 20,
      // Uniform across the five elements (stage-boss fairness).
      resistances: { wood: 20, fire: 20, earth: 20, metal: 20, water: 20 },
      elemental: { element: 'wood', power: 14 },
    },
    rewards: {
      techniqueMastery: 100,
      spiritStone: 28,
    },
    signatureDrops: [
      // Chieu Hien Lenh keeps its only beta source - same guaranteed
      // boss drop the whelp used to carry.
      { kind: 'material', itemId: 'chieu_hien_lenh', amount: { min: 3, max: 3 }, chance: 1, requiresModifier: 'boss' },
    ],
  }),
]
