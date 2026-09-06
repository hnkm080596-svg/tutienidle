import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'
import { createDefaultPlayer } from '../player/Player'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import { COMPANIONS } from '../../data/companion/Companions'
import { TRAN_PHAP_FORMATIONS } from '../../data/formation/TranPhap'
import type { TranPhapDefinition } from '../../data/formation/TranPhap'

// Formation slot deliberately DISTINCT from HERO_LANE_INDEX(4)/HERO_COLUMN(1)
// so this test can only pass if buildTurnBattle() actually reads
// DEFAULT_PARTY_FORMATION. Legacy BattleSystem.start() unconditionally
// writes HERO_LANE_INDEX/HERO_COLUMN onto the same CombatEntity right before
// buildTurnBattle() runs, so without the formation-lookup block the entity
// would still land on HERO_LANE_INDEX/HERO_COLUMN — a formation-agnostic
// buildTurnBattle() would fail the assertions below instead of coincidentally
// passing. MOCK_ROW/MOCK_COLUMN stay inside PLAYER_SIDE_REGION (rows 3-8,
// columns 0-5).
vi.mock('./PartyFormation', () => ({
  DEFAULT_PARTY_FORMATION: [{ combatantId: 'player', row: 6, column: 3 }],
}))

// Mirror of the literals baked into the vi.mock factory above — vi.mock is
// hoisted above top-level const declarations, so the factory cannot close
// over named constants; keep these in sync with the object literal above.
const MOCK_ROW = 6
const MOCK_COLUMN = 3

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 100, criticalRate: 0 }

  return {
    id: 'player', name: 'Player', type: 'player', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0, tuLucDamageTakenPercent: 0,
    currentWard: 0, timeSinceLastHitTaken: Infinity, realmIndex: 0, x: 0, row: 4, alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test', name: 'Basic', description: '', type: 'active', level: 1, maxLevel: 10,
    cooldown: 0, remainingCooldown: 0, cost: 0, target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' }, resourceType: 'none',
    unlocked: true, equipped: true, loadoutSlot: 0, loadoutSlots: [0],
  }
}

function createDummy() {
  return defineEnemy({
    id: 'formation_dummy', name: 'Formation Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 9, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager.buildTurnBattle — reads DEFAULT_PARTY_FORMATION when no formation is configured', () => {
  it('places the player at the MOCKED formation slot, not at HERO_LANE_INDEX/HERO_COLUMN — proves buildTurnBattle() is driven by DEFAULT_PARTY_FORMATION', () => {
    const gameManager = new GameManager()
    const player = createPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)
    gameManager.startBattle(player, createDummy())

    const battle = gameManager.getTurnBattle()!

    expect(battle.players).toHaveLength(1)
    expect(battle.players[0]!.id).toBe('player')
    expect(battle.players[0]!.entity.row).toBe(MOCK_ROW)
    expect(battle.players[0]!.entity.x).toBe(MOCK_COLUMN)
    // Sanity: the mocked slot really is different from the legacy default —
    // otherwise this assertion would pass for the wrong reason.
    expect(MOCK_ROW).not.toBe(HERO_LANE_INDEX)
    expect(MOCK_COLUMN).not.toBe(HERO_COLUMN)
  })
})

// Task 19 — buildTurnBattle() phải đọc player.formationLoadout THẬT (qua
// resolvePartyFormation(), Task 18) khi có, thay vì luôn fallback về
// DEFAULT_PARTY_FORMATION (mocked ở trên); đồng thời phải tạo participant
// cho companion đã gán vào 1 ô của formationLoadout.
const TEST_COMPANION_DEFINITION = {
  id: 'test_companion_for_formation',
  name: 'Formation Test Companion',
  grade: 'hoang' as const,
  baseStats: { maxHp: 100, attack: 10, speed: 100 },
  basic: {
    id: 'test_companion_for_formation_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical' as const, multiplier: 1 },
    targeting: { shape: 'single' as const },
  },
}

describe('GameManager.buildTurnBattle — resolves a real FormationLoadout, includes companions', () => {
  it('places player + a companion at their configured cells, both in turnBattle.players', () => {
    // COMPANIONS rỗng ở giai đoạn này của plan (nội dung roster ship sau) —
    // đẩy tạm 1 definition test-only vào mảng cho thời lượng test này,
    // giống cách các test khác trong codebase đăng ký fixture dùng-1-lần
    // thay vì phụ thuộc vào nội dung thật.
    ;(COMPANIONS as unknown as (typeof COMPANIONS)[number][]).push(TEST_COMPANION_DEFINITION)

    try {
      const gameManager = new GameManager()
      const playerEntity = createPlayer()
      const playerData = createDefaultPlayer()

      gameManager.registerSkillTemplates([createBasicSkill()])
      gameManager.learnSkill('basic_test')
      gameManager.skillSystem.equipToSlot('basic_test', 0)

      // formationLoadout phải set TRƯỚC setActivePlayer/startBattle —
      // GameManager.setActivePlayer() giữ THAM CHIẾU TRỰC TIẾP tới
      // PlayerData (không copy), nên buildTurnBattle() (chạy trong
      // startBattle()) đọc thấy đúng object đã mutate ở đây.
      playerData.formationLoadout = {
        formationId: 'test_formation',
        assignments: [
          { row: 0, column: 0, combatantId: 'player' },
          { row: 1, column: 1, combatantId: 'test_companion_for_formation' },
        ],
      }
      playerData.companions = [{ definitionId: 'test_companion_for_formation', level: 1, exp: 0 }]

      gameManager.setActivePlayer(playerData)
      gameManager.startBattle(playerEntity, createDummy())

      const battle = gameManager.getTurnBattle()!

      expect(battle.players).toHaveLength(2)
      expect(battle.players.map((p) => p.id)).toEqual(
        expect.arrayContaining(['player', 'test_companion_for_formation']),
      )
    } finally {
      // Dọn fixture khỏi mảng module-level dùng chung — tránh rò rỉ sang
      // test khác chạy sau trong cùng process (vitest có thể share module).
      const index = COMPANIONS.findIndex((c) => c.id === TEST_COMPANION_DEFINITION.id)
      if (index >= 0) {
        ;(COMPANIONS as unknown as (typeof COMPANIONS)[number][]).splice(index, 1)
      }
    }
  })
})

// Review Task 19 (finding Important) — TURN_BUFF_REGISTRY.get() throw nếu
// definitionId của trận pháp không resolve được (gõ sai id, hoặc buff chưa
// kịp thêm vào buffs.ts). Trước fix này, throw đó văng thẳng ra khỏi
// buildTurnBattle() và làm SẬP CẢ TRẬN ĐẤU. Test này xác nhận trận vẫn
// build được bình thường — chỉ mất đúng 1 buff, không throw — giống tinh
// thần "skip gracefully" mà companion resolution đã làm.
const TEST_FORMATION_WITH_MISSING_BUFF: TranPhapDefinition = {
  id: 'test_formation_missing_buff',
  name: 'Formation Missing Buff Test',
  cellPattern: [{ row: 0, column: 0 }],
  buff: { definitionId: 'nonexistent_buff_id_xyz' },
  description: 'test-only formation referencing a buff id that does not exist',
}

describe('GameManager.buildTurnBattle — formation buff definitionId không resolve được', () => {
  it('không throw, trận vẫn build bình thường khi TURN_BUFF_REGISTRY.get() thất bại', () => {
    // TRAN_PHAP_FORMATIONS rỗng ở giai đoạn này của plan (nội dung roster
    // ship sau) — đẩy tạm 1 definition test-only vào mảng, giống pattern
    // COMPANIONS ở test phía trên.
    ;(TRAN_PHAP_FORMATIONS as unknown as TranPhapDefinition[]).push(TEST_FORMATION_WITH_MISSING_BUFF)

    try {
      const gameManager = new GameManager()
      const playerEntity = createPlayer()
      const playerData = createDefaultPlayer()

      gameManager.registerSkillTemplates([createBasicSkill()])
      gameManager.learnSkill('basic_test')
      gameManager.skillSystem.equipToSlot('basic_test', 0)

      playerData.formationLoadout = {
        formationId: TEST_FORMATION_WITH_MISSING_BUFF.id,
        assignments: [{ row: 0, column: 0, combatantId: 'player' }],
      }

      gameManager.setActivePlayer(playerData)

      expect(() => gameManager.startBattle(playerEntity, createDummy())).not.toThrow()

      const battle = gameManager.getTurnBattle()
      expect(battle).not.toBeNull()
      expect(battle!.players).toHaveLength(1)
      expect(battle!.players[0]!.id).toBe('player')
    } finally {
      // Dọn fixture khỏi mảng module-level dùng chung — tránh rò rỉ sang
      // test khác chạy sau trong cùng process (vitest có thể share module).
      const index = TRAN_PHAP_FORMATIONS.findIndex((f) => f.id === TEST_FORMATION_WITH_MISSING_BUFF.id)
      if (index >= 0) {
        ;(TRAN_PHAP_FORMATIONS as unknown as TranPhapDefinition[]).splice(index, 1)
      }
    }
  })
})
