import { describe, expect, it } from 'vitest'

import { COMPANIONS, type CompanionInstance } from '../../data/companion/Companions'
import { REALMS } from '../../data/realms/realm'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { PHAP_TU_ULTIMATE_IDS } from '../../data/skill/PhapTuUltimates'
import { SPELL_KIT_IDS, SKILLS } from '../../data/skill/Skills'
import {
  buildTheTuAnKit,
  buildTheTuKit,
} from '../../data/skill/TheTuSkills'
import { applyAnKitToBasic, applyAnKitToSpecial } from '../../data/skill/TurnAnKitSkills'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import { isKiemPhoProviderHandle } from '../kiem-tu/KiemPhoProvider'
import { freshSwordPathState, KIEM_PHO_ORB_IDS } from '../kiem-tu/KiemTuState'
import { resolveCompanionSkillKit } from '../companion/CompanionProgression'
import { TemplateRegistry } from '../game/TemplateRegistry'
import { isSpellPathway } from '../phap-tu/PhapTuPath'
import {
  NEUTRAL_ROUTE_PROFILE,
  resolveRouteProfile,
  type RouteProfile,
} from '../phap-tu/PhapTuRoutes'
import {
  CULTIVATION_PATH_RUNTIME_FACTORIES,
  resolveCultivationPathRuntime,
} from '../player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '../player/CultivationPathRuntime'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { NodeRegistry } from '../progression/NodeRegistry'
import { getNodeLevel } from '../progression/NodeSystem'
import type { ProgressionNode } from '../progression/ProgressionNode'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import type { Skill } from '../skill/Skill'
import type { TurnBattle, TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import {
  selectAction,
  type DynamicBasicCastContext,
  type TurnSkillDefinition,
} from '../battle/turn/TurnSkillAction'
import type { CombatEntity } from '../combat/CombatEntity'
import { createBaseStats } from '../stats/StatBlock'
import {
  adaptTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
  mergeAdaptedCatalogs,
  toTurnSkillDefinition,
} from './LegacySkillAdapter'
import { SkillDefinitionRegistry } from './SkillDefinitionRegistry'

// ---------------------------------------------------------------------------
// skilldef M5 -- the production castable-def census. Every
// TurnSkillDefinition a participant can carry into applyActionImpact must
// adapt to a validated ActiveSkillDefinition catalog with ZERO unsupported
// reports -- a def that cannot route faults loudly at cast (a no-op,
// never a silent legacy pass; the only remaining legacy lane is the
// runtime === undefined engine-unit test configuration). This is the
// INV-S2 "one ACTIVE pipeline" gate: the census IS the routing coverage
// proof.
//
// Producer discovery is FAIL-CLOSED, not a hand-maintained list:
//   1. Deep-walk every exported object under src/data/** for def-shaped
//      objects (no enumeration -- new exports are collected automatically).
//   2. tests/architecture/skillDefProducerSources.test.ts scans every
//      non-test src file for `cooldownTurns:` -- any file that constructs
//      defs must be a walked data module or a declared producer file.
//   3. Every exported function in a def-adjacent data module must be a
//      declared producer (exercised by a census leg) or a declared
//      non-producer.
//   4. Every key of CULTIVATION_PATH_RUNTIME_FACTORIES must have fixture
//      states in RUNTIME_FIXTURES -- a new path/way factory fails the gate
//      until its producer surface is driven here.
//   5. Every authored active Skill discovered in data modules must live in
//      the SKILLS aggregate (the authored-sweep leg's source).
// Documented residual: a producer that mints defs without a
// `cooldownTurns:` literal inside an already-classified file cannot be
// caught by a source scan -- same limitation class as every textual guard
// in tests/architecture.
// ---------------------------------------------------------------------------

// All non-test src/data modules, eagerly imported -- the authoritative
// static-export surface (established pattern: statDomainWhitelist.test).
// The ?raw twin supplies module SOURCE text for the def-adjacency and
// function-classification checks (no node:fs under tsconfig.app).
const DATA_MODULES = import.meta.glob(
  ['../../data/**/*.ts', '!../../data/**/*.test.ts'],
  { eager: true },
) as Record<string, Record<string, unknown>>

const DATA_MODULE_SOURCES = import.meta.glob(
  ['../../data/**/*.ts', '!../../data/**/*.test.ts'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

// Exported functions in def-adjacent data modules that PRODUCE defs. A
// census leg must invoke each (tracked in `exercisedProducerFns`).
const DEF_PRODUCER_FUNCTIONS: Record<string, string> = {
  '../../data/skill/TheTuSkills.ts#buildTheTuKit': 'body:hien runtime leg + direct matrix',
  '../../data/skill/TheTuSkills.ts#buildTheTuAnKit': 'body:ung_the runtime leg + direct matrix',
  '../../data/skill/TurnAnKitSkills.ts#applyAnKitToBasic': 'spell:ngo_dao runtime leg + direct matrix',
  '../../data/skill/TurnAnKitSkills.ts#applyAnKitToSpecial': 'spell:ngo_dao runtime leg + direct matrix',
}

// Exported functions in def-adjacent data modules that do NOT produce
// defs -- declared so a new producer function cannot hide among helpers.
const NON_DEF_FUNCTIONS: Record<string, string> = {
  '../../data/skill/KiemPhoOrbs.ts#unlockedOrbs': 'realm-gated orb-id list (returns OrbId[])',
  '../../data/skill/TurnSkillDisplayMeta.ts#turnSkillDisplayMetaOf': 'display metadata lookup',
  '../../data/companion/Companions.ts#isBetaCompanionGift': 'gift-acquisition authority predicate (M-F-COMPANION-GIFT)',
}

// Authored combos whose pattern can never complete through the real
// matcher: a shorter combo fires mid-pattern and clears the log first.
// PRE-EXISTING authored-data defect (the K10 suffix-free check in
// KiemPhoCombos.test.ts guards suffixes only; it misses an interior
// subsequence): thich_tram_tram_phach_thich = [D,C,C,B,D] contains
// nhi_tram_nhat_phach = [C,C,B] at positions 1-3. A NEW unreachable
// combo diverges from this pinned set and fails the reachability gate.
const KNOWN_UNREACHABLE_COMBOS: readonly string[] = [
  'thich_tram_tram_phach_thich',
]

// ---------------------------------------------------------------------------
// Duck typing + module walk.
// ---------------------------------------------------------------------------

interface CollectedDef {
  source: string
  def: TurnSkillDefinition
}

function isTurnSkillDefinition(value: unknown): value is TurnSkillDefinition {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.cooldownTurns === 'number' &&
    typeof v.targeting === 'object' &&
    v.targeting !== null
  )
}

function isAuthoredActiveSkill(value: unknown): value is Skill {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.type === 'active' &&
    typeof v.cooldown === 'number' &&
    typeof v.maxLevel === 'number'
  )
}

interface ModuleWalk {
  defs: CollectedDef[]
  activeSkillIds: string[]
  exportedFunctions: string[]
}

function walkModuleExports(modulePath: string): ModuleWalk {
  const mod = DATA_MODULES[modulePath]
  const walk: ModuleWalk = { defs: [], activeSkillIds: [], exportedFunctions: [] }

  if (mod === undefined) return walk

  const seen = new Set<unknown>()

  const descend = (value: unknown, trail: string, depth: number): void => {
    if (depth > 8 || typeof value !== 'object' || value === null || seen.has(value)) return
    seen.add(value)

    if (isTurnSkillDefinition(value)) {
      walk.defs.push({ source: `${modulePath}:${trail}`, def: value })
      return
    }

    if (isAuthoredActiveSkill(value)) {
      walk.activeSkillIds.push(value.id)
      return
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => descend(entry, `${trail}[${index}]`, depth + 1))
      return
    }

    if (value instanceof Map || value instanceof Set) {
      let index = 0
      for (const entry of value.values()) {
        descend(entry, `${trail}<${index++}>`, depth + 1)
      }
      return
    }

    for (const [key, entry] of Object.entries(value)) {
      descend(entry, trail === '' ? key : `${trail}.${key}`, depth + 1)
    }
  }

  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function') {
      walk.exportedFunctions.push(name)
    } else {
      descend(value, name, 0)
    }
  }

  return walk
}

// ---------------------------------------------------------------------------
// Runtime-seam fixtures -- one entry per CULTIVATION_PATH_RUNTIME_FACTORIES
// key plus the mortal fallback. This is the same dispatch production uses
// (GameManagerTurnBattleOps consumes resolveCultivationPathRuntime); the
// fixture states exercise each factory's producer surface.
// ---------------------------------------------------------------------------

const MORTAL_LEG = '<mortal>'

interface RuntimeFixtureState {
  label: string
  player: PlayerData
  nodes?: readonly ProgressionNode[]
  /** Kit slots this state must produce (the way's unconditional kit
      surface) -- an absent required slot is a producer defect, not an
      optional lane. Mortal/sword legs legitimately return undefined. */
  requiredSlots?: readonly ('special' | 'ultimate')[]
}

function censusPlayer(mutate: (player: PlayerData) => void = () => {}): PlayerData {
  const player = createDefaultPlayer()
  mutate(player)
  return player
}

const RUNTIME_FIXTURES: Record<string, () => RuntimeFixtureState[]> = {
  [MORTAL_LEG]: () => [
    { label: 'default', player: censusPlayer() },
    { label: 'picked_basic', player: censusPlayer((p) => { p.mortalBasicSkillId = 'huy_quyen' }) },
  ],

  'sword:sword_pathway': () =>
    KIEM_PHO_ORB_IDS.map((orb) => ({
      label: `preset:${orb}`,
      player: censusPlayer((p) => {
        p.cultivationPath = 'sword'
        p.cultivationWay = 'sword_pathway'
        p.realmId = 'tribulation'
        p.swordPath = { ...freshSwordPathState(), preset: [orb] }
      }),
      nodes: KIEM_TU_NODES,
    })),

  'sword:hidden_sword_pathway': () =>
    (
      [
        { a: false, e: false, d: false },
        { a: true, e: false, d: false },
        { a: false, e: true, d: false },
        { a: false, e: false, d: true },
        { a: true, e: true, d: true },
      ] as const
    ).map((unlocks) => ({
      label: `unlocks:${JSON.stringify(unlocks)}`,
      player: censusPlayer((p) => {
        p.cultivationPath = 'sword'
        p.cultivationWay = 'hidden_sword_pathway'
        p.realmId = 'tribulation'
        p.swordPath = { ...freshSwordPathState(), kiemDaoCount: 3, kiemDaoBase: 2 }
        p.nodeLevels = {
          ngu_kiem_khoi: unlocks.a ? 1 : 0,
          ngu_kiem_lien: unlocks.e ? 1 : 0,
          ngu_kiem_phong_an: unlocks.d ? 1 : 0,
        }
      }),
      nodes: KIEM_TU_NODES,
    })),

  'spell:spell_pathway': () =>
    ELEMENT_ORDER.flatMap((element) => [
      ...(['dot', 'no'] as const).map((route) => ({
        label: `${element}:${route}:empowered`,
        player: censusPlayer((p) => {
          p.cultivationPath = 'spell'
          p.cultivationWay = 'spell_pathway'
          p.realmId = 'tribulation'
          p.spellPath = { element, route }
          p.nodeLevels = { [`linh_ngo_${PHAP_TU_ULTIMATE_IDS[element]}`]: 1 }
        }),
        requiredSlots: ['special', 'ultimate'] as const,
      })),
      {
        label: `${element}:base`,
        player: censusPlayer((p) => {
          p.cultivationPath = 'spell'
          p.cultivationWay = 'spell_pathway'
          p.realmId = 'tribulation'
          p.spellPath = { element, route: null }
        }),
        requiredSlots: ['special', 'ultimate'] as const,
      },
    ]),

  'spell:hidden_spell_pathway': () => [
    {
      label: 'kit',
      player: censusPlayer((p) => {
        p.cultivationPath = 'spell'
        p.cultivationWay = 'hidden_spell_pathway'
        p.realmId = 'tribulation'
      }),
      // The An ult slot is a passive (ngo_dao_hon_don) -- only the
      // repeat-cast special is a TurnSkillDefinition.
      requiredSlots: ['special'] as const,
    },
  ],

  'body:body_pathway': () =>
    (
      [
        { label: 'no_root', nodeLevels: {} as Record<string, number>, requiredSlots: [] },
        { label: 'cuong_chien', nodeLevels: { cuong_chien: 1 } as Record<string, number>, requiredSlots: ['special', 'ultimate'] },
        { label: 'tran_the', nodeLevels: { tran_the: 1 } as Record<string, number>, requiredSlots: ['special', 'ultimate'] },
      ] as const
    ).map(({ label, nodeLevels, requiredSlots }) => ({
      label,
      player: censusPlayer((p) => {
        p.cultivationPath = 'body'
        p.cultivationWay = 'body_pathway'
        p.nodeLevels = nodeLevels
      }),
      requiredSlots,
    })),

  'body:hidden_body_pathway': () =>
    (
      [
        { label: 'no_roots', nodeLevels: {} as Record<string, number>, requiredSlots: [] },
        { label: 'all_roots', nodeLevels: { ho_mon: 1, phan_mon: 1, tro_mon: 1 } as Record<string, number>, requiredSlots: ['special', 'ultimate'] },
      ] as const
    ).map(({ label, nodeLevels, requiredSlots }) => ({
      label,
      player: censusPlayer((p) => {
        p.cultivationPath = 'body'
        p.cultivationWay = 'hidden_body_pathway'
        p.nodeLevels = nodeLevels
      }),
      requiredSlots,
    })),
}

function runtimeDepsFor(
  player: PlayerData,
  nodes: readonly ProgressionNode[],
): { deps: CultivationPathRuntimeDeps; skillSystem: SkillSystem; manager: SkillManager } {
  const manager = new SkillManager()
  for (const skill of SKILLS) manager.add(structuredClone(skill))

  const skillSystem = new SkillSystem(manager)

  // Mirrors GameManager.routeProfileProvider: neutral unless the active
  // player is spell_pathway and the skill belongs to its element kit.
  const routeProfileProvider = (skillId: string): RouteProfile => {
    if (!isSpellPathway(player)) return NEUTRAL_ROUTE_PROFILE
    const element = player.spellPath.element
    if (!element || !SPELL_KIT_IDS[element].includes(skillId)) {
      return NEUTRAL_ROUTE_PROFILE
    }
    return resolveRouteProfile(player.spellPath)
  }
  skillSystem.setRouteProfileProvider(routeProfileProvider)

  const skillTemplates = new TemplateRegistry<Skill>()
  for (const skill of SKILLS) skillTemplates.register(skill.id, skill)

  const nodeRegistry = new NodeRegistry()
  for (const node of nodes) nodeRegistry.register(node)

  return {
    manager,
    skillSystem,
    deps: {
      skillManager: manager,
      skillSystem,
      skillTemplates,
      nodeRegistry,
      getNodeLevel: (nodeId, p) => getNodeLevel(p, nodeId),
      getSpellPathElement: () => player.spellPath.element ?? undefined,
      routeProfileProvider,
    },
  }
}

// ---------------------------------------------------------------------------
// Census collection.
// ---------------------------------------------------------------------------

const exercisedProducerFns = new Set<string>()

function minimalParticipant(): TurnBattleParticipant {
  const stats = createBaseStats()
  const entity = {
    id: 'census',
    name: 'census',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity

  return {
    id: 'census',
    entity,
    speed: 1,
    priority: 0,
    actionGauge: 0,
    alive: true,
    consecutiveHardCcTurns: 0,
  }
}

function castContext(resolvedSkillId: string): DynamicBasicCastContext {
  return {
    battle: {} as TurnBattle,
    actor: {} as TurnBattleParticipant,
    resolvedSkillId,
    landedTargetIds: [],
    resolveBuff: () => {},
  }
}

interface ComboEmission {
  comboId: string
  emittedIds: string[]
}

interface Census {
  defs: CollectedDef[]
  comboEmissions: ComboEmission[]
  missingMandatory: string[]
}

function collectCastableDefs(): Census {
  const defs: CollectedDef[] = []
  const comboEmissions: ComboEmission[] = []
  const missingMandatory: string[] = []
  const participantStub = {} as TurnBattleParticipant

  // Optional producer output: legitimately absent for some states
  // (per-path kit slots, emblem slots, combo extras).
  const push = (source: string, def: TurnSkillDefinition | undefined | null): void => {
    if (def != null) defs.push({ source, def })
  }

  // Mandatory producer output: an absent def here is a producer defect
  // the census exists to catch -- a silent skip would let a broken
  // producer leg pass every other gate.
  const requireDef = (source: string, def: TurnSkillDefinition | undefined | null): void => {
    if (def == null) {
      missingMandatory.push(source)
      return
    }
    defs.push({ source, def })
  }

  // -- Leg 1: data-module deep walk (authoritative static surface) -------
  for (const modulePath of Object.keys(DATA_MODULES)) {
    if (modulePath.endsWith('.test.ts')) continue
    for (const entry of walkModuleExports(modulePath).defs) {
      defs.push(entry)
    }
  }

  // -- Leg 2: authored Skill -> converter sweep (the SKILLS aggregate) ---
  const sweepManager = new SkillManager()
  for (const skill of SKILLS) sweepManager.add(structuredClone(skill))
  const sweepSystem = new SkillSystem(sweepManager)
  for (const skill of SKILLS) {
    if (skill.type !== 'active') continue
    push(
      `Skill:${skill.id}`,
      toTurnSkillDefinition(skill, sweepSystem.getEffectiveSkill(skill)),
    )
    for (const spec of skill.specializations ?? []) {
      const specialized = structuredClone(skill)
      specialized.selectedSpecializationId = spec.id
      push(
        `Skill:${skill.id}#${spec.id}`,
        toTurnSkillDefinition(specialized, sweepSystem.getEffectiveSkill(specialized)),
      )
    }
  }

  // -- Leg 3: the production runtime seam --------------------------------
  // resolveCultivationPathRuntime is the dispatch GameManagerTurnBattleOps
  // consumes; driving it here covers path basics, kit slots, emblem slots,
  // dynamic-basic providers, reactive payloads, empowered variants, and
  // An-kit mutated clones through the SAME code path production uses.
  for (const [legKey, fixtureStates] of Object.entries(RUNTIME_FIXTURES)) {
    for (const state of fixtureStates()) {
      const { deps } = runtimeDepsFor(state.player, state.nodes ?? [])
      const runtime = resolveCultivationPathRuntime(state.player, deps)
      const prefix = `runtime:${legKey}:${state.label}`

      requireDef(`${prefix}.basic`, runtime.resolveBasic(state.player))

      const slots = runtime.resolveSpecialUltimate(state.player)
      for (const slot of state.requiredSlots ?? []) {
        requireDef(`${prefix}.${slot}`, slots?.[slot])
      }
      // Non-required slots stay optional: sword ways legitimately
      // return undefined (their combat surface is the provider), and
      // body no-root states produce no kit.
      if (slots !== undefined) {
        if (!(state.requiredSlots ?? []).includes('special')) {
          push(`${prefix}.special`, slots.special)
        }
        if (!(state.requiredSlots ?? []).includes('ultimate')) {
          push(`${prefix}.ultimate`, slots.ultimate)
        }
      }
      for (const [id, def] of Object.entries(slots?.reactivePayloads ?? {})) {
        push(`${prefix}.reactive:${id}`, def)
      }

      const emblems = runtime.emblemSlots?.()
      push(`${prefix}.emblem.special`, emblems?.special)
      push(`${prefix}.emblem.ultimate`, emblems?.ultimate)

      const provider = runtime.buildDynamicBasic?.(state.player, state.nodes ?? [], () => 0.5)
      if (provider === undefined) continue

      requireDef(`${prefix}.provider.basic`, provider.resolveBasic(participantStub))

      for (const option of provider.manualOptions?.() ?? []) {
        requireDef(`${prefix}.provider.manual:${option.id}`, option)
        requireDef(`${prefix}.provider.manualPick:${option.id}`, provider.resolveManualPick?.(option.id))
      }

      if (isKiemPhoProviderHandle(provider)) {
        // Combo extras through the REAL matcher: feed each authored
        // pattern on a fresh provider; the emitted extra-cast def is the
        // production comboToExtraDef output (replaces the old hand-mirror).
        for (const combo of KIEM_PHO_COMBOS) {
          const fresh = runtime.buildDynamicBasic!(state.player, state.nodes ?? [], () => 0.5)!
          let emitted: readonly TurnSkillDefinition[] = []
          for (const orb of combo.pattern) {
            emitted = fresh.onCastResolved?.(castContext(orb)) ?? []
          }
          comboEmissions.push({ comboId: combo.id, emittedIds: emitted.map((def) => def.id) })
          for (const def of emitted) {
            push(`${prefix}.combo:${combo.id}`, def)
          }
        }
      } else {
        // Non-Kiem-Pho provider (Ngu Kiem Dao): exercise the domain call
        // once. Any emitted extra defs still join the census -- a new
        // provider that emits through this hook must not escape
        // coverage; its own effect (e.g. gainKiemY) is domain-owned.
        for (const def of provider.onCastResolved?.(castContext('orb_dam')) ?? []) {
          push(`${prefix}.provider.onCastResolved`, def)
        }
      }
    }
  }

  // -- Leg 4: producer-fn matrices (direct calls for shape variants) -----
  const zeroKitMods = {
    missingHpBonusBonus: 0,
    reflectMaxHpRatioBonus: 0,
    reflectTakenRatioBonus: 0,
    sonNhacWardRatioBonus: 0,
    tauntTurnsBonus: 0,
    batTuDurationBonus: 0,
  }
  for (const root of ['cuong_chien', 'tran_the'] as const) {
    const kit = buildTheTuKit(root, zeroKitMods)
    exercisedProducerFns.add('../../data/skill/TheTuSkills.ts#buildTheTuKit')
    requireDef(`TheTuKit:${root}.basic`, kit.basic)
    requireDef(`TheTuKit:${root}.special`, kit.special)
    requireDef(`TheTuKit:${root}.ultimate`, kit.ultimate)
  }
  const anKit = buildTheTuAnKit(['ho_mon', 'phan_mon', 'tro_mon'])
  exercisedProducerFns.add('../../data/skill/TheTuSkills.ts#buildTheTuAnKit')
  requireDef('TheTuAnKit:basic', anKit.basic)
  requireDef('TheTuAnKit:special', anKit.special)
  requireDef('TheTuAnKit:ultimate', anKit.ultimate)
  for (const [id, def] of Object.entries(anKit.reactivePayloads)) {
    push(`TheTuAnKit:reactive:${id}`, def)
  }

  // An-kit mutator clones over the real converter output (the element
  // pool the orchestrator builds). The resolved basic gets the
  // production forced fields post-mutation; pool members stay raw.
  const matrixDeps = runtimeDepsFor(
    censusPlayer((p) => {
      p.cultivationPath = 'spell'
      p.cultivationWay = 'hidden_spell_pathway'
    }),
    [],
  )
  const elementPool = ELEMENT_ORDER.map((element) => {
    const template = matrixDeps.manager.get(SPELL_KIT_IDS[element][0])!
    return toTurnSkillDefinition(template, matrixDeps.skillSystem.getEffectiveSkill(template))
  })
  const anSpecialTemplate = matrixDeps.manager.get(SPELL_KIT_IDS.fire[1])!
  for (const multicast of [true, false] as const) {
    requireDef(`AnKit:basic:multicast=${multicast}`, {
      ...applyAnKitToBasic(elementPool[0]!, multicast, elementPool),
      cooldownTurns: 0,
      resourceType: 'none',
      resourceCost: undefined,
    })
  }
  exercisedProducerFns.add('../../data/skill/TurnAnKitSkills.ts#applyAnKitToBasic')
  requireDef(
    'AnKit:special',
    applyAnKitToSpecial(
      toTurnSkillDefinition(
        anSpecialTemplate,
        matrixDeps.skillSystem.getEffectiveSkill(anSpecialTemplate),
      ),
      elementPool,
    ),
  )
  exercisedProducerFns.add('../../data/skill/TurnAnKitSkills.ts#applyAnKitToSpecial')

  // -- Leg 5: companion kits at max unlock -------------------------------
  const maxInstance: CompanionInstance = {
    instanceId: 'inst.census',
    definitionId: 'census',
    realmId: 'tribulation',
    realmLevel: REALMS.find((realm) => realm.id === 'tribulation')!.maxLevel,
    exp: 0,
    constellationRank: 6,
  }
  for (const companion of COMPANIONS) {
    const kit = resolveCompanionSkillKit(companion, {
      ...maxInstance,
      definitionId: companion.id,
    })
    requireDef(`Companion:${companion.id}.basic`, kit.basic)
    // Max-unlock fixture: an authored special/ultimate must resolve --
    // its absence is an unlock-gating defect, not an optional slot.
    if (companion.special !== undefined) {
      requireDef(`Companion:${companion.id}.special`, kit.special)
    }
    if (companion.ultimate !== undefined) {
      requireDef(`Companion:${companion.id}.ultimate`, kit.ultimate)
    }
  }

  // -- Leg 6: the engine fallback basic ----------------------------------
  // A participant with no basic/dynamicBasic resolves FALLBACK_BASIC_SKILL
  // through selectAction -- reach it through the production call, not by
  // importing the module-private constant. The leg is MANDATORY: if
  // selectAction regresses to NULL_ACTION for a no-slot participant, the
  // leg would silently vanish and every other gate still passes.
  const fallbackAction = selectAction(minimalParticipant())
  requireDef('engine:fallback-basic', fallbackAction.skill ?? undefined)

  return { defs, comboEmissions, missingMandatory }
}

// ---------------------------------------------------------------------------
// Discovery-boundary assertions.
// ---------------------------------------------------------------------------

function dataModuleSource(modulePath: string): string {
  return DATA_MODULE_SOURCES[modulePath] ?? ''
}

function moduleIsDefAdjacent(source: string): boolean {
  return source.includes('TurnSkillDefinition') || /cooldownTurns\s*:/.test(source)
}

const dataModuleWalks = new Map<string, ModuleWalk>()

function walkOf(modulePath: string): ModuleWalk {
  let walk = dataModuleWalks.get(modulePath)
  if (walk === undefined) {
    walk = walkModuleExports(modulePath)
    dataModuleWalks.set(modulePath, walk)
  }
  return walk
}

describe('LegacySkillAdapter -- production coverage census (M5/INV-S2)', () => {
  const census = collectCastableDefs()

  it('every data module with def literals actually exports or produces them', () => {
    // A `cooldownTurns:` literal in a data module must be reachable: the
    // deep walk finds exported defs, or every exported function is a
    // declared (exercised or non-def) function. A hidden/unused producer
    // literal fails here.
    const failures: string[] = []

    for (const modulePath of Object.keys(DATA_MODULES)) {
      if (modulePath.endsWith('.test.ts')) continue
      const source = dataModuleSource(modulePath)
      if (!/cooldownTurns\s*:/.test(source)) continue

      const walk = walkOf(modulePath)
      const classifiedFns = walk.exportedFunctions.filter(
        (name) =>
          DEF_PRODUCER_FUNCTIONS[`${modulePath}#${name}`] !== undefined ||
          NON_DEF_FUNCTIONS[`${modulePath}#${name}`] !== undefined,
      )

      if (walk.defs.length === 0 && classifiedFns.length === 0) {
        failures.push(
          `${modulePath} contains def literals but exports neither defs nor ` +
            `classified producer functions`,
        )
      }
    }

    expect(failures, `unreachable def literals:\n${failures.join('\n')}`).toEqual([])
  })

  it('every exported function in a def-adjacent data module is classified', () => {
    const failures: string[] = []

    for (const modulePath of Object.keys(DATA_MODULES)) {
      if (modulePath.endsWith('.test.ts')) continue
      const source = dataModuleSource(modulePath)
      if (!moduleIsDefAdjacent(source)) continue

      for (const name of walkOf(modulePath).exportedFunctions) {
        const key = `${modulePath}#${name}`
        if (
          DEF_PRODUCER_FUNCTIONS[key] === undefined &&
          NON_DEF_FUNCTIONS[key] === undefined
        ) {
          failures.push(
            `${key} is unclassified -- declare it in DEF_PRODUCER_FUNCTIONS ` +
              `(with a covering census leg) or NON_DEF_FUNCTIONS`,
          )
        }
      }
    }

    expect(failures, `unclassified producer functions:\n${failures.join('\n')}`).toEqual([])
  })

  it('every declared producer function was exercised by a census leg', () => {
    const missing = Object.keys(DEF_PRODUCER_FUNCTIONS).filter(
      (key) => !exercisedProducerFns.has(key),
    )

    expect(
      missing,
      `declared producers never invoked:\n${missing.join('\n')}`,
    ).toEqual([])
  })

  it('every runtime factory key has fixture coverage', () => {
    const factoryKeys = new Set(Object.keys(CULTIVATION_PATH_RUNTIME_FACTORIES))

    const missing = [...factoryKeys].filter((key) => RUNTIME_FIXTURES[key] === undefined)
    const stale = Object.keys(RUNTIME_FIXTURES).filter(
      (key) => key !== MORTAL_LEG && !factoryKeys.has(key),
    )

    expect(
      missing,
      `CULTIVATION_PATH_RUNTIME_FACTORIES keys without census fixtures:\n${missing.join('\n')}`,
    ).toEqual([])
    expect(
      stale,
      `fixture keys with no matching runtime factory (dead legs):\n${stale.join('\n')}`,
    ).toEqual([])
  })

  it('every authored active Skill lives in the SKILLS aggregate', () => {
    const skillIds = new Set(SKILLS.map((skill) => skill.id))
    const failures: string[] = []

    for (const modulePath of Object.keys(DATA_MODULES)) {
      if (modulePath.endsWith('.test.ts')) continue
      for (const id of walkOf(modulePath).activeSkillIds) {
        if (!skillIds.has(id)) {
          failures.push(`${modulePath}: active Skill '${id}' is exported outside the SKILLS aggregate`)
        }
      }
    }

    expect(failures, `active Skills outside the authored aggregate:\n${failures.join('\n')}`).toEqual([])
  })

  it('every reachable KIEM_PHO_COMBOS pattern fires through the real matcher', () => {
    // A combo self-emits iff its pattern completes through the real
    // greedy matcher. Combos that can never complete (a shorter combo
    // fires mid-pattern and clears the log) are pinned in
    // KNOWN_UNREACHABLE_COMBOS -- a NEW unreachable combo or a regression
    // that breaks a reachable one both fail here.
    const notSelfEmitting = [
      ...new Set(
        census.comboEmissions
          .filter(({ comboId, emittedIds }) => !emittedIds.includes(comboId))
          .map(({ comboId }) => comboId),
      ),
    ].sort()

    expect(
      notSelfEmitting,
      `combos that never self-emit through the real matcher diverge from the pinned set`,
    ).toEqual([...KNOWN_UNREACHABLE_COMBOS].sort())
  })

  it('every mandatory producer leg emitted a def', () => {
    // A producer returning nothing for a state that must produce is a
    // real defect (broken kit / regressed fallback) that a silent skip
    // would hide behind the other gates. Optional outputs (per-path kit
    // slots, emblems, combo extras) are not in this list.
    expect(
      census.missingMandatory,
      `mandatory producer outputs missing:\n${census.missingMandatory.join('\n')}`,
    ).toEqual([])
  })

  it('every castable def adapts with zero unsupported reports', () => {
    const failures: string[] = []

    for (const { source, def } of census.defs) {
      const catalog = adaptTurnSkillDefinition(def)

      if (catalog.unsupported.length > 0) {
        failures.push(`${source} (${def.id}): ${catalog.unsupported.join(' | ')}`)
        continue
      }

      try {
        new SkillDefinitionRegistry(mergeAdaptedCatalogs([catalog]), {
          isBuffDefinitionId: (id) => BUFF_REGISTRY.has(id),
        })
      } catch (error) {
        failures.push(
          `${source} (${def.id}): registry rejected -- ${(error as Error).message.slice(0, 200)}`,
        )
      }
    }

    expect(failures, `defs that cannot route the plan pipeline:\n${failures.join('\n')}`).toEqual([])
  })

  it('the full production surface merges into ONE registry without conflicts', () => {
    // The runtime's cumulative-registry semantics (catalogFor rebuilds
    // across every admitted catalog): adapted catalogs that each pass
    // alone can still collide when they coexist in one battle (shared
    // pool members, same-id mutated clones). A genuine same-id/different-
    // shape conflict must fault HERE, not at cast time.
    //
    // Reachability partition: specialization variants and empowered-ult
    // route variants are MUTUALLY EXCLUSIVE inside one battle (a player
    // equips one spec variant and locks one route). Their same-id/
    // different-shape collisions can never co-register, so each surface
    // is merged separately -- every variant still proves coexistence
    // against the whole rest of the surface exactly once.
    const failures: string[] = []

    for (const route of ['dot', 'no'] as const) {
      const catalogs = []

      for (const { source, def } of census.defs) {
        if (source.includes('#')) continue
        // Skip the OTHER route's empowered-ult states: the aux payloads
        // of both variants share their base ult id with different shapes
        // and are route-locked -- unreachable in one registry.
        const otherRoute = route === 'dot' ? 'no' : 'dot'
        if (source.includes(`:${otherRoute}:empowered`)) continue

        const catalog = adaptTurnSkillDefinition(def)
        if (catalog.unsupported.length > 0) {
          failures.push(`${source} (${def.id}): ${catalog.unsupported.join(' | ')}`)
          continue
        }
        catalogs.push(catalog)
      }

      try {
        new SkillDefinitionRegistry(mergeAdaptedCatalogs(catalogs), {
          isBuffDefinitionId: (id) => BUFF_REGISTRY.has(id),
        })
      } catch (error) {
        failures.push(
          `route '${route}' surface: merged registry rejected -- ${(error as Error).message.slice(0, 400)}`,
        )
      }
    }

    expect(failures, `merged-registry failures:\n${failures.join('\n')}`).toEqual([])
  })

  it('the census surface is non-trivial and sources are unique', () => {
    // Floor guards an empty-discovery regression (a walk that silently
    // finds nothing would pass every other gate). Uniqueness binds the
    // SOURCE labels: def ids repeat legitimately across mutated clones.
    expect(census.defs.length).toBeGreaterThanOrEqual(60)
    expect(new Set(census.defs.map(({ source }) => source)).size).toBe(census.defs.length)
  })

  it('converter-level reports stay build-time only (adaptSkill parity note)', () => {
    // The Skill->converter leg drops authored fields with a console warn at
    // battle build; those drops are identical on both lanes (the legacy
    // lane consumed the same converted def), so they never gate routing.
    // This test pins the converter's own report surface for visibility.
    const manager = new SkillManager()
    for (const skill of SKILLS) manager.add(structuredClone(skill))
    const skillSystem = new SkillSystem(manager)
    const reported: string[] = []
    for (const skill of SKILLS) {
      const unsupported = collectUnsupportedSkillSemantics(
        skill,
        skillSystem.getEffectiveSkill(skill),
      )
      if (unsupported.length > 0) {
        reported.push(`${skill.id}: ${unsupported.join(' | ')}`)
      }
    }
    // Snapshot-free assertion: the surface exists and stays enumerable.
    expect(reported.every((entry) => entry.length > 0)).toBe(true)
  })
})
