import { describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer, resolvePlayerFinalStats, resolvePlayerStatAssembly, type PlayerData } from '../player/Player'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { createPhapTuState } from '../phap-tu/PhapTuState'
import type { StatModifier } from '../stats/StatCalculator'
import { resolveAttributeTotals, calculateStats } from '../stats/StatCalculator'
import { collectActiveWayStatModifiers, resolvePathCapabilities } from '../player/CultivationPathSystem'
import { resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { COMPANIONS } from '../../data/companion/Companions'
import { GameManager } from './GameManager'
import { resolveCombatBuild, type CombatBuildDeps } from './CombatBuild'
import type { CultivationPathRuntime } from '../player/CultivationPathRuntime'
import { resolveCultivationPathRuntime } from '../player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '../player/CultivationPathRuntime'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { NodeRegistry } from '../progression/NodeRegistry'
import { TemplateRegistry } from './TemplateRegistry'
import type { Skill } from '../skill/Skill'
import { NEUTRAL_ROUTE_PROFILE } from '../phap-tu/PhapTuRoutes'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_AN_REQUIRED_SKILLS } from '../phap-tu/PhapTuPath'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CompanionInstance } from '../../data/companion/Companions'
import type { PathCapability } from '../player/CultivationPathKit'
import { VAN_PHAP_THAN_HOA_ID } from '../../data/buff/ReactionStatusBuffs'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { SurviveLethalSource } from '../combat/CombatSystem'

// P2 (canonical build composition) - the resolver contract tests: one
// composition authority for the player-side battle assembly, pure and
// deterministic, with the raw-entity override path preserved verbatim.

function makeDeps(overrides: Partial<CombatBuildDeps> = {}): CombatBuildDeps {
  return {
    getBattleBaseChannels: () => [],
    resolveCapabilities: (player) => resolvePathCapabilities(player, { hasSkill: () => false }),
    getSkillLevels: () => ({}),
    getProgressionNodes: () => [],
    getCompanionDefinition: (id) => COMPANIONS.find((candidate) => candidate.id === id),
    getLiveBattleModifiers: () => [],
    getActivePlayer: () => undefined,
    ...overrides,
  }
}

function makeRuntime(overrides: Partial<CultivationPathRuntime> = {}): CultivationPathRuntime {
  return {
    resolveBasic: () => GENERIC_PHYSICAL_BASIC,
    resolveSpecialUltimate: () => undefined,
    resolveMaxThe: () => 10,
    resolveStatDomains: () => undefined,
    ...overrides,
  }
}

function makePlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const player = createDefaultPlayer()
  Object.assign(player, overrides)
  return player
}

describe('resolvePlayerStatAssembly (Player.ts extraction)', () => {
  it('returns stats identical to resolvePlayerFinalStats for the same inputs', () => {
    const player = makePlayer()
    player.cultivationPath = 'phap_tu'
    player.cultivationWay = 'ngu_hanh'
    player.phapTu = createPhapTuState()
    player.baseStats.attunement = 8
    const external: StatModifier[] = [
      { id: 'test:ext', sourceId: 'test', sourceType: 'buff', stat: 'might', flat: 5 },
    ]

    const assembly = resolvePlayerStatAssembly(player, external)

    expect(assembly.stats).toEqual(resolvePlayerFinalStats(player, external))
    const totals = resolveAttributeTotals(player.baseStats, [...player.modifiers, ...external])
    expect(assembly.wayFacetModifiers).toEqual(collectActiveWayStatModifiers(player, totals))
  })

  it('resolvePlayerFinalStats delegates to the assembly (same formula owner)', () => {
    const player = makePlayer()
    const external: StatModifier[] = [
      { id: 'test:ext2', sourceId: 'test', sourceType: 'buff', stat: 'speed', flat: 3 },
    ]

    expect(resolvePlayerFinalStats(player, external)).toEqual(
      calculateStats(player.baseStats, [...player.modifiers, ...external, ...resolvePlayerStatAssembly(player, external).wayFacetModifiers]),
    )
  })
})

describe('getBattleBaseChannels', () => {
  it('flattened channels equal getBattleBaseModifiers, same order', () => {
    const manager = new GameManager()
    const player = makePlayer()
    manager.setActivePlayer(player)

    const channels = manager.effectOps.getBattleBaseChannels(player)
    const flat = channels.flatMap((channel) => channel.modifiers)

    expect(flat).toEqual(manager.effectOps.getBattleBaseModifiers(player))
    expect(channels.every((channel) => channel.partition === 'static')).toBe(true)
    expect(channels.map((channel) => channel.channel)).toEqual([
      'technique_tier',
      'cultivation_path',
      'phap_tu_route',
      'node_levels',
      'technique_combat',
    ])
  })
})

describe('resolveCombatBuild — skeleton (M1)', () => {
  it('mortal player: identity undefined, empty capabilities, minted player entity', () => {
    const player = makePlayer()
    const runtime = makeRuntime()
    const build = resolveCombatBuild(player, runtime, makeDeps())

    expect(build.identity).toBeUndefined()
    expect(build.capabilities.size).toBe(0)
    expect(build.stats).toBeDefined()
    expect(build.entity?.id).toBe('player')
    expect(build.entity?.stats).toEqual(build.stats)
    expect(build.kit.basic).toBe(GENERIC_PHYSICAL_BASIC)
    expect(build.formation).toEqual(resolvePartyFormation(player))
    expect(build.companions).toEqual([])
    expect(build.entryBuffs).toEqual([])
    expect(build.survive.talentIds).toEqual(player.selectedTalentIds)
  })

  it('way player: identity = committed pair, capabilities resolve through the dep', () => {
    const player = makePlayer()
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'
    player.kiemTu = freshKiemTuState()
    const build = resolveCombatBuild(player, makeRuntime(), makeDeps())

    expect(build.identity).toEqual({ path: 'kiem_tu', way: 'hien' })
    expect(build.capabilities.has('kiem_tu.kiem_pho')).toBe(true)
  })

  it('modifierChannels carry player_bag + battle-base channels + way_facet with attribution intact', () => {
    const player = makePlayer()
    player.modifiers.push({
      id: 'test:bag', sourceId: 'item', sourceType: 'equipment', stat: 'might', flat: 2,
    })
    const bagChannel: StatModifier = {
      id: 'test:tier', sourceId: 'tech', sourceType: 'technique', stat: 'speed', flat: 1,
    }
    const deps = makeDeps({
      getBattleBaseChannels: () => [
        { channel: 'technique_tier', partition: 'static', modifiers: [bagChannel] },
      ],
    })

    const build = resolveCombatBuild(player, makeRuntime(), deps)

    const channels = build.modifierChannels.map((channel) => channel.channel)
    expect(channels).toEqual(['player_bag', 'technique_tier', 'way_facet'])
    expect(build.modifierChannels[0]?.modifiers[0]?.sourceType).toBe('equipment')
  })

  it('every resolved channel modifier retains id/sourceId/sourceType (attribution)', () => {
    const manager = new GameManager()
    const player = makePlayer()
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'
    player.kiemTu = freshKiemTuState()
    player.modifiers.push({
      id: 'test:bag', sourceId: 'item', sourceType: 'equipment', stat: 'might', flat: 2,
    })
    manager.setActivePlayer(player)

    const deps = makeDeps({
      getBattleBaseChannels: (p) => manager.effectOps.getBattleBaseChannels(p),
    })
    const build = resolveCombatBuild(player, makeRuntime(), deps)

    const all = build.modifierChannels.flatMap((channel) => channel.modifiers)
    expect(all.length).toBeGreaterThan(0)
    for (const modifier of all) {
      expect(modifier.id).toBeTruthy()
      expect(modifier.sourceId).toBeTruthy()
      expect(modifier.sourceType).toBeTruthy()
    }
  })

  it('partition integrity: live-partition modifiers never appear in modifierChannels', () => {
    const player = makePlayer()
    const live: StatModifier = {
      id: 'live:sentinel', sourceId: 'battle', sourceType: 'buff', stat: 'might', flat: 99,
    }
    const deps = makeDeps({
      getLiveBattleModifiers: () => [live],
      getActivePlayer: () => player,
    })

    const build = resolveCombatBuild(player, makeRuntime(), deps)

    const channelIds = build.modifierChannels.flatMap((channel) =>
      channel.modifiers.map((modifier) => modifier.id),
    )
    expect(channelIds).not.toContain('live:sentinel')
    // ...while still flowing through the live provider for the player entity.
    expect(build.liveModifiers(build.entity!)).toEqual([live])
  })

  it('source === undefined + override: raw entity is the primary, untouched', () => {
    const raw: CombatEntity = {
      id: 'raw_test_player',
      name: 'Raw',
      type: 'player',
      baseStats: createDefaultPlayer().baseStats as never,
      stats: createDefaultPlayer().baseStats as never,
      currentHp: 100,
      maxHp: 100,
      currentMp: 0,
      currentWard: 0,
      turnsSinceLastHitLanded: Infinity,
      realmIndex: 0,
      x: 0,
      row: 2,
      alive: true,
      maxThe: 42,
    }

    const build = resolveCombatBuild(undefined, undefined, makeDeps(), raw)

    expect(build.entity).toBe(raw)
    expect(build.entity?.maxThe).toBe(42)
    expect(build.stats).toBeUndefined()
    expect(build.kit.basic).toBe(GENERIC_PHYSICAL_BASIC)
    expect(build.formation).toEqual(DEFAULT_PARTY_FORMATION)
    expect(build.companions).toEqual([])
    expect(build.entryBuffs).toEqual([])
  })

  it('source === undefined + no override: entity is undefined', () => {
    const build = resolveCombatBuild(undefined, undefined, makeDeps())

    expect(build.entity).toBeUndefined()
    expect(build.stats).toBeUndefined()
  })

  it('liveModifiers keeps the literal player gate + live getActivePlayer read', () => {
    const active = makePlayer()
    const mods: StatModifier[] = [
      { id: 'test:live', sourceId: 'buff', sourceType: 'buff', stat: 'might', flat: 9 },
    ]
    const getLive = vi.fn(() => mods)
    const deps = makeDeps({
      getActivePlayer: () => active,
      getLiveBattleModifiers: getLive,
    })
    const build = resolveCombatBuild(active, makeRuntime(), deps)

    const playerEntity = { id: 'player' } as CombatEntity
    const rawEntity = { id: 'raw_x' } as CombatEntity

    expect(build.liveModifiers(playerEntity)).toBe(mods)
    expect(build.liveModifiers(rawEntity)).toEqual([])
    expect(getLive).toHaveBeenCalledWith(active)
  })
})

// --- M2 - kit composition ------------------------------------------------

function makeRuntimeDeps(): CultivationPathRuntimeDeps {
  const skillManager = new SkillManager()
  const skillTemplates = new TemplateRegistry<Skill>()
  // Real templates so authored-kit resolvers (ngo_dao element pool) can
  // convert them; the An ritual grant is simulated by adding the three
  // required skills to the manager.
  for (const skill of SKILLS) {
    skillTemplates.register(skill.id, skill)
  }
  for (const skillId of PHAP_TU_AN_REQUIRED_SKILLS) {
    const skill = SKILLS.find((candidate) => candidate.id === skillId)
    if (skill) {
      skillManager.add(skill)
    }
  }
  return {
    skillManager,
    skillSystem: new SkillSystem(skillManager),
    skillTemplates,
    nodeRegistry: new NodeRegistry(),
    getNodeLevel: () => 0,
    getPhapTuElement: () => undefined,
    routeProfileProvider: () => NEUTRAL_ROUTE_PROFILE,
  }
}

function rawEntity(id = 'raw_test_player', maxThe?: number): CombatEntity {
  const stats = calculateStats(createDefaultPlayer().baseStats, [])
  return {
    id,
    name: 'Raw',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    maxThe,
  }
}

function fakeSkill(id: string, grants?: BuffDefinition[]): TurnSkillDefinition {
  return { id, name: id, grantsBuffsAtBuild: grants } as unknown as TurnSkillDefinition
}

function fakeBuffDef(id: string): BuffDefinition {
  return { id: id as BuffDefinitionId } as BuffDefinition
}

describe('resolveCombatBuild — kit composition (M2)', () => {
  it('kit fields equal the runtime outputs for every authored way', () => {
    const runtimeDeps = makeRuntimeDeps()
    const pairs: Array<[PlayerData['cultivationPath'], PlayerData['cultivationWay']]> = [
      ['kiem_tu', 'hien'],
      ['kiem_tu', 'ngu'],
      ['phap_tu', 'ngu_hanh'],
      ['phap_tu', 'ngo_dao'],
      ['the_tu', 'hien'],
      ['the_tu', 'ung_the'],
    ]

    for (const [path, way] of pairs) {
      const player = makePlayer()
      player.cultivationPath = path
      player.cultivationWay = way
      if (path === 'kiem_tu') player.kiemTu = freshKiemTuState()
      if (path === 'phap_tu') player.phapTu = createPhapTuState()

      const runtime = resolveCultivationPathRuntime(player, runtimeDeps)
      const build = resolveCombatBuild(player, runtime, makeDeps())
      const specialUltimate = runtime.resolveSpecialUltimate(player)

      expect(build.kit.basic).toEqual(runtime.resolveBasic(player))
      expect(build.kit.special).toEqual(specialUltimate?.special)
      expect(build.kit.ultimate).toEqual(specialUltimate?.ultimate)
      expect(build.kit.reactivePayloads).toEqual(specialUltimate?.reactivePayloads)
      expect(build.kit.statDomains).toEqual(runtime.resolveStatDomains(player))
      expect(build.kit.emblem).toEqual(runtime.emblemSlots?.())
    }
  })

  it('maxThe: minted entity = specialUltimate?.maxThe ?? resolveMaxThe(source)', () => {
    const player = makePlayer()
    const resolveMaxThe = vi.fn(() => 10)
    const runtime = makeRuntime({
      resolveMaxThe,
      resolveSpecialUltimate: () => ({ maxThe: 42 }),
    })
    const build = resolveCombatBuild(player, runtime, makeDeps())
    expect(build.entity?.maxThe).toBe(42)

    const runtimeNoKit = makeRuntime({ resolveMaxThe })
    const build2 = resolveCombatBuild(player, runtimeNoKit, makeDeps())
    expect(build2.entity?.maxThe).toBe(10)
    expect(resolveMaxThe).toHaveBeenCalledWith(player)
  })

  it('maxThe: raw override = specialUltimate?.maxThe ?? override.maxThe — resolveMaxThe never runs', () => {
    const player = makePlayer()
    const resolveMaxThe = vi.fn(() => 10)
    const runtime = makeRuntime({ resolveMaxThe })
    const raw = rawEntity('raw_test_player', 42)

    const build = resolveCombatBuild(player, runtime, makeDeps(), raw)
    expect(build.entity).toBe(raw)
    expect(build.entity?.maxThe).toBe(42)
    expect(resolveMaxThe).not.toHaveBeenCalled()

    // Kit-carried cap still stamps the raw entity (adapter parity).
    const runtimeWithCap = makeRuntime({
      resolveMaxThe,
      resolveSpecialUltimate: () => ({ maxThe: 99 }),
    })
    const build2 = resolveCombatBuild(player, runtimeWithCap, makeDeps(), raw)
    expect(build2.entity?.maxThe).toBe(99)
    expect(resolveMaxThe).not.toHaveBeenCalled()
  })

  it('buildDynamicBasic closes over the node snapshot — no registry read post-resolve', () => {
    const player = makePlayer()
    const snapshot: ProgressionNode[] = []
    const seen: Array<readonly ProgressionNode[]> = []
    const runtime = makeRuntime({
      buildDynamicBasic: (_p, nodes) => {
        seen.push(nodes)
        return undefined
      },
    })
    let registry: readonly ProgressionNode[] = snapshot
    const deps = makeDeps({ getProgressionNodes: () => registry })

    const build = resolveCombatBuild(player, runtime, deps)
    registry = [{} as ProgressionNode] // post-resolve mutation of the dep

    build.kit.buildDynamicBasic?.(() => 0.5)
    expect(seen[0]).toBe(snapshot)
  })

  it('kit-clone entry buffs read the EFFECTIVE post-emblem slots', () => {
    const player = makePlayer()
    const kitBuff = fakeBuffDef('kit_clone_buff')
    const emblemBuff = fakeBuffDef('emblem_clone_buff')
    const runtime = makeRuntime({
      resolveSpecialUltimate: () => ({
        special: fakeSkill('kit_special', [kitBuff]),
        ultimate: fakeSkill('kit_ultimate', [kitBuff]),
      }),
      emblemSlots: () => ({ special: fakeSkill('emblem_special', [emblemBuff]) }),
    })

    const build = resolveCombatBuild(player, runtime, makeDeps())

    // emblem.special replaced kit.special -> only the emblem's grant appears
    // for that slot; kit.ultimate still contributes its own clone.
    const ids = build.entryBuffs.map((entry) => entry.definitionId)
    expect(ids).toEqual(['emblem_clone_buff', 'kit_clone_buff'])
    for (const entry of build.entryBuffs) {
      expect(entry.sourceId).toBe('player')
      expect(entry.targetId).toBe('player')
    }
  })

  it('kit-clone buffs bind to the raw override id on the raw path', () => {
    const player = makePlayer()
    const runtime = makeRuntime({
      resolveSpecialUltimate: () => ({ ultimate: fakeSkill('kit_ult', [fakeBuffDef('kit_clone_buff')]) }),
    })
    const raw = rawEntity('raw_test_player')

    const build = resolveCombatBuild(player, runtime, makeDeps(), raw)

    expect(build.entryBuffs[0]).toEqual({
      definitionId: 'kit_clone_buff',
      sourceId: 'raw_test_player',
      targetId: 'raw_test_player',
    })
  })
})

// --- M3 - formation, companions, entry buffs, survive --------------------

function makeCompanionInstance(definitionId: string, instanceId = 'inst_1'): CompanionInstance {
  return {
    instanceId,
    definitionId,
    realmId: 'mortal',
    realmLevel: 12,
    exp: 0,
    constellationRank: 0,
  }
}

describe('resolveCombatBuild — formation/companions/entry buffs/survive (M3)', () => {
  it('companions resolve entity + kit + position from the formation slot', () => {
    const player = makePlayer()
    player.companions = [makeCompanionInstance('ho_ly_tinh')]
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'ho_ly_tinh' },
      ],
    }

    const build = resolveCombatBuild(player, makeRuntime(), makeDeps())

    expect(build.companions).toHaveLength(1)
    const companion = build.companions[0]!
    expect(companion.entity.id).toBe('ho_ly_tinh')
    expect(companion.basic.id).toBe('ho_ly_tinh_basic')
    expect(companion.entity.alive).toBe(true)
    // The formation slot's absolute position is applied to the entity.
    const slot = build.formation.find((entry) => entry.combatantId === 'ho_ly_tinh')
    expect(companion.entity.row).toBe(slot?.row)
    expect(companion.entity.x).toBe(slot?.column)
  })

  it('companions skip silently on missing definition or missing formation slot', () => {
    const player = makePlayer()
    player.companions = [
      makeCompanionInstance('no_such_companion', 'inst_missing_def'),
      makeCompanionInstance('ho_ly_tinh', 'inst_missing_slot'),
    ]
    // No formationLoadout -> DEFAULT_PARTY_FORMATION has only the player slot.
    const build = resolveCombatBuild(player, makeRuntime(), makeDeps())
    expect(build.companions).toEqual([])
  })

  it('formation buff declares one self-sourced entry per allied entity', () => {
    const player = makePlayer()
    player.companions = [makeCompanionInstance('ho_ly_tinh')]
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'ho_ly_tinh' },
      ],
    }

    const build = resolveCombatBuild(player, makeRuntime(), makeDeps())

    const formationBuffs = build.entryBuffs.filter(
      (entry) => entry.definitionId === 'tran_phap_luong_nghi_buff',
    )
    expect(formationBuffs).toEqual([
      {
        definitionId: 'tran_phap_luong_nghi_buff',
        sourceId: 'player',
        targetId: 'player',
        gracefulSkip: true,
      },
      {
        definitionId: 'tran_phap_luong_nghi_buff',
        sourceId: 'ho_ly_tinh',
        targetId: 'ho_ly_tinh',
        gracefulSkip: true,
      },
    ])
  })

  it('reaction aura declares van_phap_than_hoa per ally, source = primary entity id', () => {
    const player = makePlayer()
    player.companions = [makeCompanionInstance('ho_ly_tinh')]
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'ho_ly_tinh' },
      ],
    }
    const deps = makeDeps({
      resolveCapabilities: () => new Set<PathCapability>(['phap_tu.reaction_aura']),
    })

    const build = resolveCombatBuild(player, makeRuntime(), deps)

    const auraEntries = build.entryBuffs.filter(
      (entry) => entry.definitionId === VAN_PHAP_THAN_HOA_ID,
    )
    expect(auraEntries).toEqual([
      { definitionId: VAN_PHAP_THAN_HOA_ID, sourceId: 'player', targetId: 'player' },
      { definitionId: VAN_PHAP_THAN_HOA_ID, sourceId: 'player', targetId: 'ho_ly_tinh' },
    ])
  })

  it('entryBuffs order: formation x allies, aura x allies, clones (player then companions)', () => {
    const player = makePlayer()
    player.companions = [makeCompanionInstance('ho_ly_tinh')]
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'ho_ly_tinh' },
      ],
    }
    const runtime = makeRuntime({
      resolveSpecialUltimate: () => ({ ultimate: fakeSkill('kit_ult', [fakeBuffDef('player_clone')]) }),
    })
    const deps = makeDeps({
      resolveCapabilities: () => new Set<PathCapability>(['phap_tu.reaction_aura']),
    })

    const build = resolveCombatBuild(player, runtime, deps)
    const ids = build.entryBuffs.map((entry) => `${entry.definitionId}:${entry.targetId}`)

    expect(ids).toEqual([
      'tran_phap_luong_nghi_buff:player',
      'tran_phap_luong_nghi_buff:ho_ly_tinh',
      `${VAN_PHAP_THAN_HOA_ID}:player`,
      `${VAN_PHAP_THAN_HOA_ID}:ho_ly_tinh`,
      'player_clone:player',
    ])
  })

  it('survive.extraSources binds runtime.buildSurviveSources to (source, participant, hasBuff)', () => {
    const player = makePlayer()
    const sentinel = [{} as SurviveLethalSource]
    const buildSurviveSources = vi.fn(() => sentinel)
    const runtime = makeRuntime({ buildSurviveSources })

    const build = resolveCombatBuild(player, runtime, makeDeps())
    const participant = {} as TurnBattleParticipant
    const hasBuff = () => true

    expect(build.survive.talentIds).toBe(player.selectedTalentIds)
    expect(build.survive.extraSources?.(participant, hasBuff)).toBe(sentinel)
    expect(buildSurviveSources).toHaveBeenCalledWith(player, participant, hasBuff)
  })

  it('determinism: identical inputs produce deep-equal data fields', () => {
    const player = makePlayer()
    player.companions = [makeCompanionInstance('ho_ly_tinh')]
    player.formationLoadout = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 1, column: 1, combatantId: 'ho_ly_tinh' },
      ],
    }
    const deps = makeDeps()

    const a = resolveCombatBuild(player, makeRuntime(), deps)
    const b = resolveCombatBuild(player, makeRuntime(), deps)

    expect(a.stats).toEqual(b.stats)
    expect(a.modifierChannels).toEqual(b.modifierChannels)
    expect(a.formation).toEqual(b.formation)
    expect(a.entryBuffs).toEqual(b.entryBuffs)
    expect(a.kit.basic).toEqual(b.kit.basic)
    // Entities are freshly minted per resolve - equal fields, not identity.
    expect(a.entity).not.toBe(b.entity)
    expect(a.entity).toEqual(b.entity)
    expect(a.companions.map((c) => c.entity)).toEqual(b.companions.map((c) => c.entity))
  })

  it('fail-closed pair: a corrupt way resolves mortal semantics (identity undefined)', () => {
    const player = makePlayer()
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'ngo_dao' as never // a way kiem_tu does not own

    const build = resolveCombatBuild(player, makeRuntime(), makeDeps())

    expect(build.identity).toBeUndefined()
    expect(build.capabilities.size).toBe(0)
  })
})
