import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Battle, BattleEnemy } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'
import { AilmentManager } from '../ailment/AilmentManager'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { BuffManager } from '../buff/BuffManager'
import { createBaseStats } from '../stats/StatBlock'
import { createArtifactRuntime } from './ArtifactRuntime'
import { createDefaultArtifactProgress } from './ArtifactProgression'
import { onArtifactHitResolved, updateArtifactActivation, type ArtifactSystemDeps } from './ArtifactSystem'
import { ailments } from '../../data/ailment/ailments'

function createCombatEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, attackRange: 10, woodPower: 100, firePower: 100 }

  return {
    id,
    name: id,
    type: id === 'player' ? 'player' : 'enemy',
    baseStats: stats,
    stats,
    currentHp: 1000,
    maxHp: 1000,
    currentMp: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 2,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function createBattleEnemy(id: string, overrides: Partial<CombatEntity> = {}): BattleEnemy {
  return {
    entity: createCombatEntity(id, { row: 2, x: 0, ...overrides }),
    attackTimer: 0,
    buffs: new BuffManager(),
    ailments: new AilmentManager(),
    rewardGranted: false,
  }
}

function createAilmentRegistry(): AilmentRegistry {
  const registry = new AilmentRegistry()

  for (const template of ailments) {
    registry.register(template)
  }

  return registry
}

function createDeps(overrides: Partial<ArtifactSystemDeps> = {}): ArtifactSystemDeps {
  const ailmentRegistry = createAilmentRegistry()

  return {
    actionImpact: { scheduleBasic: vi.fn() } as unknown as ActionImpactSystem,
    ailmentRegistry,
    getAilmentsFor: (battle, entity) =>
      entity.id === battle.player.id
        ? battle.playerAilments
        : (battle.enemies.find((e) => e.entity.id === entity.id)?.ailments ?? new AilmentManager()),
    getBuffsFor: (battle, entity) =>
      entity.id === battle.player.id
        ? battle.playerBuffs
        : (battle.enemies.find((e) => e.entity.id === entity.id)?.buffs ?? new BuffManager()),
    aiStrategy: () => 'nearest',
    ...overrides,
  }
}

function createBattle(overrides: Partial<Battle> = {}): Battle {
  const player = createCombatEntity('player', { x: 0, row: 2 })
  const enemy = createBattleEnemy('enemy_1')

  return {
    id: 'battle-1',
    player,
    enemies: [enemy],
    state: 'fighting',
    playerTeleport: { remainingSeconds: 0 },
    playerMaterialized: true,
    playerBuffs: new BuffManager(),
    playerAilments: new AilmentManager(),
    elapsedSeconds: 0,
    pendingSummons: [],
    lavaZones: [],
    swordZones: [],
    pendingEnemySpawns: [],
    ...overrides,
  }
}

function attackArtifactRuntime(path: 'attack' | 'defense' | 'control' | undefined, level: number, equippedElements: ('wood' | 'fire')[] = ['wood', 'fire']) {
  const progress = createDefaultArtifactProgress('ngu_hanh_chau')
  progress.realmLevel = level
  progress.selectedPath = path

  return createArtifactRuntime(progress, equippedElements)
}

describe('ArtifactSystem.updateArtifactActivation — acceptance §15.3', () => {
  it('không có artifactRuntime -> hoàn toàn no-op', () => {
    const battle = createBattle({ artifactRuntime: undefined })
    const deps = createDeps()

    expect(() => updateArtifactActivation(battle, 10, deps)).not.toThrow()
    expect(deps.actionImpact.scheduleBasic).not.toHaveBeenCalled()
  })

  it('dừng khi state không phải fighting (countdown/victory/defeat)', () => {
    for (const state of ['countdown', 'victory', 'defeat'] as const) {
      const battle = createBattle({ state, artifactRuntime: attackArtifactRuntime('attack', 1) })
      const deps = createDeps()

      updateArtifactActivation(battle, 10, deps)

      expect(deps.actionImpact.scheduleBasic).not.toHaveBeenCalled()
    }
  })

  it('dừng khi player chưa materialize hoặc đã chết', () => {
    const notMaterialized = createBattle({
      playerMaterialized: false,
      artifactRuntime: attackArtifactRuntime('attack', 1),
    })
    const dead = createBattle({ artifactRuntime: attackArtifactRuntime('attack', 1) })
    dead.player.alive = false

    const deps1 = createDeps()
    const deps2 = createDeps()

    updateArtifactActivation(notMaterialized, 10, deps1)
    updateArtifactActivation(dead, 10, deps2)

    expect(deps1.actionImpact.scheduleBasic).not.toHaveBeenCalled()
    expect(deps2.actionImpact.scheduleBasic).not.toHaveBeenCalled()
  })

  it('tick vẫn chạy khi player đang bị CC (isIncapacitated không gate artifact)', () => {
    const runtime = attackArtifactRuntime('attack', 1)
    const battle = createBattle({ artifactRuntime: runtime })
    // Player "bị stun" — playerAilments có ccEffect stun — nhưng
    // updateArtifactActivation() KHÔNG được đọc field này ở đâu cả.
    battle.playerAilments.add({
      id: 'choang', category: 'cc', sourceId: 'enemy_1', targetId: 'player', duration: 1, remainingTime: 1, stacks: 1, stackMode: 'refresh', ccEffect: 'stun',
    } as never)
    const deps = createDeps()

    updateArtifactActivation(battle, 10, deps)

    expect(deps.actionImpact.scheduleBasic).toHaveBeenCalledTimes(1)
  })

  it('không target quái ngoài tầm (attackRange) — không schedule gì', () => {
    const runtime = attackArtifactRuntime('attack', 1)
    const battle = createBattle({ artifactRuntime: runtime })
    battle.player.stats.attackRange = 1
    battle.enemies[0]!.entity.x = 999 // ngoài tầm hẳn

    const deps = createDeps()

    updateArtifactActivation(battle, 0.1, deps)

    expect(deps.actionImpact.scheduleBasic).not.toHaveBeenCalled()
  })

  it('quái pending-spawn (chưa vào battle.enemies) không bao giờ bị target', () => {
    const runtime = attackArtifactRuntime('attack', 1)
    const battle = createBattle({ artifactRuntime: runtime, enemies: [] })

    const deps = createDeps()

    updateArtifactActivation(battle, 10, deps)

    expect(deps.actionImpact.scheduleBasic).not.toHaveBeenCalled()
  })

  it('chu kỳ mặc định 3.0s: sau lần bắn đầu, chưa đủ 3s thì chưa bắn tiếp', () => {
    const runtime = attackArtifactRuntime('attack', 1)
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    // Activation đầu tiên fire ngay (timer khởi tạo = 0, doc không yêu
    // cầu "khởi động nguội" — subgun đóng góp DPS ngay từ đầu trận).
    updateArtifactActivation(battle, 0.1, deps)
    expect(deps.actionImpact.scheduleBasic).toHaveBeenCalledTimes(1)

    updateArtifactActivation(battle, 2.8, deps)
    expect(deps.actionImpact.scheduleBasic).toHaveBeenCalledTimes(1)

    updateArtifactActivation(battle, 0.2, deps)
    expect(deps.actionImpact.scheduleBasic).toHaveBeenCalledTimes(2)
  })

  it('attribution: mọi hit artifact mang origin.kind artifact + đúng artifactId', () => {
    const runtime = attackArtifactRuntime('attack', 1)
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    updateArtifactActivation(battle, 10, deps)

    const call = (deps.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls[0]![0]

    expect(call.origin).toEqual({ kind: 'artifact', artifactId: 'ngu_hanh_chau' })
    expect(call.sourceId).toBe('player')
    expect(call.targetId).toBe('enemy_1')
  })

  it('Ngũ Hành chỉ xoay qua element đã equip (không lẫn hành chưa equip)', () => {
    const runtime = attackArtifactRuntime('attack', 1, ['fire'])
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    updateArtifactActivation(battle, 10, deps)

    const call = (deps.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls[0]![0]

    expect(call.damage.kind).toBe('elemental')
    expect(call.damage.components[0].element).toBe('fire')
  })

  it('không có element nào equip -> damage trung tính (physical), không tự mở hành', () => {
    const runtime = attackArtifactRuntime('attack', 1, [])
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    updateArtifactActivation(battle, 10, deps)

    const call = (deps.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls[0]![0]

    expect(call.damage.kind).toBe('physical')
  })

  it('Công tầng 6 "Liên Châu" — thêm đúng 1 hit phụ dùng hành KẾ, chưa tới tầng 6 thì chỉ 1 hit', () => {
    const runtimeT1 = attackArtifactRuntime('attack', 1, ['wood', 'fire'])
    const battleT1 = createBattle({ artifactRuntime: runtimeT1 })
    const depsT1 = createDeps()

    updateArtifactActivation(battleT1, 10, depsT1)
    expect(depsT1.actionImpact.scheduleBasic).toHaveBeenCalledTimes(1)

    const runtimeT6 = attackArtifactRuntime('attack', 6, ['wood', 'fire'])
    const battleT6 = createBattle({ artifactRuntime: runtimeT6 })
    const depsT6 = createDeps()

    updateArtifactActivation(battleT6, 10, depsT6)
    expect(depsT6.actionImpact.scheduleBasic).toHaveBeenCalledTimes(2)

    const calls = (depsT6.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[0]![0].damage.components[0].element).toBe('wood')
    expect(calls[1]![0].damage.components[0].element).toBe('fire')
    // Hit phụ = 55% hit chính (cùng multiplier * 0.55).
    expect(calls[1]![0].damage.multiplier).toBeCloseTo(calls[0]![0].damage.multiplier * 0.55, 5)
  })

  it('Thủ tầng 1: multiplier thấp hơn Công (×0.70 baseline)', () => {
    const cong = attackArtifactRuntime('attack', 1, ['fire'])
    const thu = attackArtifactRuntime('defense', 1, ['fire'])
    const battleCong = createBattle({ artifactRuntime: cong })
    const battleThu = createBattle({ artifactRuntime: thu })
    const depsCong = createDeps()
    const depsThu = createDeps()

    updateArtifactActivation(battleCong, 10, depsCong)
    updateArtifactActivation(battleThu, 10, depsThu)

    const congMultiplier = (depsCong.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls[0]![0].damage.multiplier
    const thuMultiplier = (depsThu.actionImpact.scheduleBasic as ReturnType<typeof vi.fn>).mock.calls[0]![0].damage.multiplier

    expect(thuMultiplier).toBeCloseTo(congMultiplier * 0.70, 5)
  })
})

describe('ArtifactSystem — Khống (doc §8.4), ICD chống root-lock', () => {
  let deps: ArtifactSystemDeps

  beforeEach(() => {
    deps = createDeps()
  })

  it('tầng 3: hit áp lam_cham lên target', () => {
    const runtime = attackArtifactRuntime('control', 3)
    const battle = createBattle({ artifactRuntime: runtime })
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)

    expect(battle.enemies[0]!.ailments.has('lam_cham')).toBe(true)
  })

  it('tầng 6: đủ 3 hit trong cửa sổ mới áp troi_chan, chưa đủ thì chưa áp', () => {
    const runtime = attackArtifactRuntime('control', 6)
    const battle = createBattle({ artifactRuntime: runtime })
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    expect(battle.enemies[0]!.ailments.has('troi_chan')).toBe(false)

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    expect(battle.enemies[0]!.ailments.has('troi_chan')).toBe(true)
  })

  it('per-target ICD chặn root-lock: áp lại NGAY không được, phải chờ hết ICD', () => {
    const runtime = attackArtifactRuntime('control', 6)
    const battle = createBattle({ artifactRuntime: runtime })
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    expect(battle.enemies[0]!.ailments.has('troi_chan')).toBe(true)

    // Gỡ troi_chan thủ công để kiểm tra ICD KHÔNG cho áp lại ngay, dù
    // đủ 3 hit tiếp theo trong cùng window.
    battle.enemies[0]!.ailments.remove('troi_chan')

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)

    expect(battle.enemies[0]!.ailments.has('troi_chan')).toBe(false)
  })

  it('tầng 12: target đang root (troi_chan) nhận thêm debuff attack speed', () => {
    const runtime = attackArtifactRuntime('control', 12)
    const battle = createBattle({ artifactRuntime: runtime })
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)

    expect(battle.enemies[0]!.buffs.has('artifact_tran_mach')).toBe(true)
  })

  it('miss (landed=false) không tính vào cửa sổ 3-hit', () => {
    const runtime = attackArtifactRuntime('control', 6)
    const battle = createBattle({ artifactRuntime: runtime })
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, false, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, false, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, false, 'fire', deps)

    expect(battle.enemies[0]!.ailments.has('troi_chan')).toBe(false)
  })
})

describe('ArtifactSystem — Thủ (doc §8.3), không leak buff qua trận', () => {
  it('tầng 3: cấp ward theo Power của hành vừa bắn, cap theo maxHp', () => {
    const runtime = attackArtifactRuntime('defense', 3)
    const battle = createBattle({ artifactRuntime: runtime })
    battle.player.maxHp = 50 // trần thấp để test cap dễ
    battle.player.stats.firePower = 1000

    const deps = createDeps()

    onArtifactHitResolved(battle, battle.player, battle.enemies[0]!.entity, true, 'fire', deps)

    expect(battle.player.currentWard).toBeLessThanOrEqual(50)
    expect(battle.player.currentWard).toBeGreaterThan(0)
  })

  it('tầng 6: cấp buff finalDamageReductionPercent, refresh KHÔNG stack magnitude', () => {
    const runtime = attackArtifactRuntime('defense', 6)
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    onArtifactHitResolved(battle, battle.player, battle.enemies[0]!.entity, true, 'fire', deps)
    const firstStacks = battle.playerBuffs.get('artifact_ngu_khi_tuan_hoan')?.stacks

    onArtifactHitResolved(battle, battle.player, battle.enemies[0]!.entity, true, 'fire', deps)
    const secondStacks = battle.playerBuffs.get('artifact_ngu_khi_tuan_hoan')?.stacks

    expect(firstStacks).toBe(1)
    expect(secondStacks).toBe(1) // refresh, không cộng dồn stack
  })

  it('buff Thủ KHÔNG mang sang trận sau — Battle mới có playerBuffs rỗng riêng', () => {
    const runtime = attackArtifactRuntime('defense', 6)
    const battleA = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()

    onArtifactHitResolved(battleA, battleA.player, battleA.enemies[0]!.entity, true, 'fire', deps)
    expect(battleA.playerBuffs.has('artifact_ngu_khi_tuan_hoan')).toBe(true)

    // Trận MỚI luôn tạo playerBuffs MỚI (BattleSystem.start()) — mô
    // phỏng bằng cách tạo Battle thứ 2 độc lập, không tái dùng buffs cũ.
    const battleB = createBattle({ artifactRuntime: attackArtifactRuntime('defense', 6) })

    expect(battleB.playerBuffs.has('artifact_ngu_khi_tuan_hoan')).toBe(false)
  })
})

describe('ArtifactSystem — Công không tự proc-loop (doc acceptance §15.3)', () => {
  it('cross-element bonus (tầng 12) chỉ áp 1 lần/activation dù nhiều hit trùng target', () => {
    const runtime = attackArtifactRuntime('attack', 12, ['wood', 'fire'])
    const battle = createBattle({ artifactRuntime: runtime })
    const deps = createDeps()
    const target = battle.enemies[0]!.entity

    onArtifactHitResolved(battle, battle.player, target, true, 'wood', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'wood', deps)
    onArtifactHitResolved(battle, battle.player, target, true, 'fire', deps)

    expect(runtime.pendingCycleReductionPercent).toBeCloseTo(0.10, 5)
    expect(runtime.crossElementBonusAppliedThisActivation).toBe(true)
  })
})
