/**
 * Mission C Task 9 (spec C4, audit T5-44) — the SINGLE dispatch site for
 * cultivation-path combat integration. Every isKiemTuX / isPhapTuX /
 * isTheTuX branch that used to live in GameManager/GameManagerTurnBattleOps
 * resolves here into a CultivationPathRuntime; the battle orchestrator
 * consumes the interface only (architecture guard:
 * tests/architecture/battleLifecyclePathBoundary.test.ts).
 *
 * The factory bodies are the moved GameManager resolvers
 * (resolvePlayerBasicAttack / resolvePlayerSpecialUltimate /
 * resolveTheTuKit / resolveTheTuAnKit / authoredBasicSkillId /
 * assertNgoDaoKitLearned / applyPhapTuTheGains / applyPhapTuEmpowerment /
 * resolveAnElementBasicPool / buildTheTuBatTuSurvival) — relocated
 * verbatim modulo `this.` -> deps, per the plan's move-don't-rewrite rule.
 */
import type { PlayerData } from './Player'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { ProgressionNode } from '../progression/ProgressionNode'
import type { ElementType } from '../element/ElementType'
import type { CultivationPathRuntime, CultivationPathRuntimeDeps } from './CultivationPathRuntime'
import { resolveActiveWayStatDomains } from './CultivationPathSystem'

import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { aggregateTurnSkillResourceModifiers } from '../progression/NodeSystem'
import {
  toTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
} from '../game/SkillToTurnSkillConverter'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { PHAP_TU_KIT_IDS } from '../../data/skill/Skills'
import { PHAP_TU_ULTIMATE_IDS } from '../../data/skill/PhapTuUltimates'
import { PHAP_TU_EMPOWERED_ULTS } from '../../data/skill/PhapTuEmpoweredUlts'
import {
  applyAnKitToBasic,
  applyAnKitToSpecial,
} from '../../data/skill/TurnAnKitSkills'
import {
  PHAP_TU_AN_BASIC_ID,
  PHAP_TU_AN_PASSIVE_ID,
  PHAP_TU_AN_REQUIRED_SKILLS,
  PHAP_TU_AN_SPECIAL_ID,
} from '../phap-tu/PhapTuPath'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import {
  PHAP_TU_EMPOWERMENT_THE_THRESHOLD,
  PHAP_TU_THE_GAIN_BASIC,
  PHAP_TU_THE_GAIN_SPECIAL,
  applyRouteToTurnSkill,
  resolveMaxThe,
  resolveRouteProfile,
} from '../phap-tu/PhapTuRoutes'
import { isPhapTuNgoDao, isPhapTuNguHanh } from '../phap-tu/PhapTuPath'
import {
  buildTheTuAnKit,
  buildTheTuKit,
  type TheTuAnKit,
  type TheTuKit,
} from '../../data/skill/TheTuSkills'
import { collectTheTuKitModifiers } from '../the-tu/TheTuKitModifiers'
import { collectTheTuAnMechanicModifiers } from '../the-tu/TheTuAnMechanicModifiers'
import { TheTuBatTuSurvival } from '../the-tu/TheTuBatTuSurvival'
import { isTheTuHien, isTheTuUngThe } from '../the-tu/TheTuPath'
import { isKiemTuHien, isKiemTuNgu } from '../kiem-tu/KiemTuPath'
import { buildKiemPhoProvider } from '../kiem-tu/KiemPhoProvider'
import { collectKiemPhoComboModifiers } from '../kiem-tu/KiemPhoNodeModifiers'
import {
  buildNguKiemDaoProvider,
  collectKiemDaoCascadeUnlocks,
} from '../kiem-tu/NguKiemDaoProvider'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'

// ---------------------------------------------------------------------------
// Shared resolver internals (moved from GameManager)
// ---------------------------------------------------------------------------

/**
 * Review round-4 (MEDIUM) — the ngo_dao kit is a fixed three-skill
 * set granted atomically at the ritual (PHAP_TU_AN_REQUIRED_SKILLS is
 * the single authority). A save/registry missing ANY member is corrupt
 * progression state — fail loudly at battle build instead of silently
 * dropping the special button or the dao multicast. Called from both
 * battle-build resolvers so each enforces the contract independently.
 */
function assertNgoDaoKitLearned(deps: CultivationPathRuntimeDeps, player: PlayerData) {
  if (!isPhapTuNgoDao(player)) {
    return
  }

  const missing = PHAP_TU_AN_REQUIRED_SKILLS.filter(
    (skillId) => !deps.skillManager.has(skillId),
  )

  if (missing.length > 0) {
    throw new Error(
      `[GameManager] ngo_dao kit incomplete — missing learned skills: ${missing.join(', ')}`,
    )
  }
}

/**
 * Review fix (HIGH-1) — the An composite pool is the CANONICAL
 * conversion of the five authored element basics (PHAP_TU_KIT_IDS[el][0]
 * templates through getEffectiveSkill + toTurnSkillDefinition), not a
 * static duplicate table. A missing/invalid template throws here —
 * authoring errors must surface loudly at battle build, never silently
 * shrink the pick pool.
 */
function resolveAnElementBasicPool(deps: CultivationPathRuntimeDeps): TurnSkillDefinition[] {
  return ELEMENT_ORDER.map((element) => {
    const templateId = PHAP_TU_KIT_IDS[element][0]
    const template = deps.skillTemplates.get(templateId)

    if (!template) {
      throw new Error(`An kit element pool: skill template "${templateId}" is not registered`)
    }

    return toTurnSkillDefinition(template, deps.skillSystem.getEffectiveSkill(template))
  })
}

/**
 * Task 8 — attach the authored The-gain fields to a phap_tu kit
 * TurnSkillDefinition at battle build. Base values come from
 * PHAP_TU_THE_GAIN_* (basic +5 / special +15 / ultimate +0); the 'no'
 * route profile contributes theGainOnCrit; tu_the_<element> nodes add
 * per-level deltas via aggregateTurnSkillResourceModifiers — all of it
 * scoped to this authored skill id. Non-ngu_hanh ways (incl. ngo_dao —
 * its kit has no The loop) return the def unchanged.
 */
function applyPhapTuTheGains(
  deps: CultivationPathRuntimeDeps,
  def: TurnSkillDefinition,
  player: PlayerData,
  baseGainOnLandedCast: number,
): TurnSkillDefinition {
  if (!isPhapTuNguHanh(player)) {
    return def
  }

  const nodeMods = aggregateTurnSkillResourceModifiers(deps.nodeRegistry, player).get(def.id)
  const theGainOnLandedCast = baseGainOnLandedCast + (nodeMods?.theGainOnLandedCast ?? 0)
  const theGainOnCrit =
    (resolveRouteProfile(player.phapTu).critTheGain ?? 0) + (nodeMods?.theGainOnCrit ?? 0)

  return {
    ...def,
    ...(theGainOnLandedCast > 0 ? { theGainOnLandedCast } : {}),
    ...(theGainOnCrit > 0 ? { theGainOnCrit } : {}),
  }
}

/**
 * Task 10 — attach the god-ult empowerment to the equipped chain-E
 * ultimate at battle build. Gated on owning `linh_ngo_<godUltId>` (the
 * engine stays dumb — the gate lives in orchestration, A8); the route
 * profile picks the payload variant ('dot' -> detonate, 'no' -> nuke,
 * none -> nuke default).
 */
function applyPhapTuEmpowerment(
  deps: CultivationPathRuntimeDeps,
  def: TurnSkillDefinition,
  player: PlayerData,
  element: ElementType,
): TurnSkillDefinition {
  const godUltId = PHAP_TU_ULTIMATE_IDS[element]

  if ((player.nodeLevels?.[`linh_ngo_${godUltId}`] ?? 0) <= 0) {
    return def
  }

  const variant = resolveRouteProfile(player.phapTu).empoweredUlt ?? 'nuke'
  const empowered = PHAP_TU_EMPOWERED_ULTS[element]?.[variant]

  return empowered
    ? {
        ...def,
        empowerment: { theThreshold: PHAP_TU_EMPOWERMENT_THE_THRESHOLD, empowered },
      }
    : def
}

/**
 * The canonical authored-Skill -> TurnSkillDefinition basic pipeline
 * (moved from GameManager.resolvePlayerBasicAttack). `strict` paths
 * (phap_tu ways) fail loudly on a missing required basic or a converter
 * rejection — authored-data defects must surface, never silently degrade.
 */
function resolveAuthoredBasic(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
  authoredBasicId: string | undefined,
  strict: boolean,
): TurnSkillDefinition | undefined {
  const skill = authoredBasicId ? deps.skillManager.get(authoredBasicId) : undefined

  // Review round-3 (MEDIUM): a REQUIRED phap basic that isn't learned
  // is corrupt progression state (the element commit / An ritual grants
  // it atomically). Fail loudly — degrading to generic melee would
  // silently strip the path's kit.
  if (skill === undefined && authoredBasicId !== undefined && strict) {
    throw new Error(
      `[GameManager] required basic "${authoredBasicId}" is not learned for path "${player.cultivationPath}" — corrupt progression state`,
    )
  }

  if (!skill) {
    return undefined
  }

  const effective = deps.skillSystem.getEffectiveSkill(skill)
  const unsupported = collectUnsupportedSkillSemantics(skill, effective)

  if (unsupported.length > 0) {
    console.warn(
      `[GameManager] basic "${skill.id}" executes partially — ` +
        `unsupported authored semantics: ${unsupported.join(', ')}`,
    )
  }

  try {
    // Route seam 2 (post-conversion): the converter stays generic —
    // ailmentStackBonus lands on the built definition here.
    const converted = applyRouteToTurnSkill(
      toTurnSkillDefinition(skill, effective),
      deps.routeProfileProvider(skill.id),
    )

    // Task 11 — the An basic carries its composite pick (uniform
    // element_basic pool) plus `multicast` when the player owns the
    // ngo_dao_hon_don dao passive (granted at the ritual).
    const resolved = isPhapTuNgoDao(player)
      ? applyAnKitToBasic(
          converted,
          deps.skillManager.has(PHAP_TU_AN_PASSIVE_ID),
          resolveAnElementBasicPool(deps),
        )
      : converted

    return {
      ...applyPhapTuTheGains(deps, resolved, player, PHAP_TU_THE_GAIN_BASIC),
      cooldownTurns: 0,
      resourceType: 'none',
      resourceCost: undefined,
    }
  } catch (error) {
    // Review round-2 (LOW): phap paths have no static fallback — the
    // PHAP_TU_BASICS table was a second authority that drifted from
    // authored skills. A converter rejection is an authored-data
    // defect; fail loudly instead of silently running wrong gameplay.
    if (strict) {
      throw error
    }

    console.warn(
      `[GameManager] basic "${skill.id}" rejected by strict converter — falling back to static build basic:`,
      error instanceof Error ? error.message : error,
    )
    return undefined
  }
}

/**
 * The Tu Reimagined (plan Task 6) — resolve the owned branch root
 * (cuong_chien XOR tran_the, excludesNode mutex) into a participant-
 * local kit clone with collectTheTuKitModifiers baked in. No root ->
 * undefined (INV-3 fallback is the caller's job).
 */
function resolveTheTuKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuKit | undefined {
  const mods = collectTheTuKitModifiers(deps.nodeRegistry, player)

  if (deps.getNodeLevel('cuong_chien', player) > 0) {
    return buildTheTuKit('cuong_chien', mods)
  }

  if (deps.getNodeLevel('tran_the', player) > 0) {
    return buildTheTuKit('tran_the', mods)
  }

  return undefined
}

/**
 * The Tu Reimagined (plan Task 14) — the An kit is fixed at path
 * choice (spec 6.1); owned roots (ho_mon/phan_mon/tro_mon, non-mutex
 * T9) only decide which mechanic markers get planted on the built
 * basic clone's grantsBuffsAtBuild.
 */
function resolveTheTuAnKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuAnKit {
  const ownedRoots = (['ho_mon', 'phan_mon', 'tro_mon'] as const).filter(
    (root) => deps.getNodeLevel(root, player) > 0,
  )

  // Plan Task 20 — trunk economy + branch riders ride the one locked
  // channel; baked into participant-local marker/payload clones here.
  const mods = collectTheTuAnMechanicModifiers(deps.nodeRegistry, player)

  return buildTheTuAnKit(ownedRoots, mods)
}

// ---------------------------------------------------------------------------
// Per-path runtime factories
// ---------------------------------------------------------------------------

function sharedMembers(deps: CultivationPathRuntimeDeps) {
  return {
    resolveMaxThe: (player: PlayerData) => resolveMaxThe(deps.nodeRegistry, player),
    resolveStatDomains: (player: PlayerData) => resolveActiveWayStatDomains(player),
  }
}

/**
 * Mortal / pham_nhan — the slot-0 loadout occupant is the player's
 * chosen basic-tier skill (spec 2026-09-15 section 2.3: huy_quyen is
 * cast as a basic while mortal, its casts feeding the ung_the offer
 * gate). Restricted to the cast-leveled basics family — any other
 * slot-0 occupant (e.g. bat_kiem_thuat) keeps the creation-granted tram
 * as the combat basic.
 */
function createMortalRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      const equipped = deps.skillManager.getEquippedInSlot(0)
      const authoredBasicId =
        equipped && equipped.id in CAST_LEVELING_THRESHOLDS ? equipped.id : 'tram'

      return (
        resolveAuthoredBasic(deps, player, authoredBasicId, false) ??
        // M9 — content-map lookup keyed on the path id, not a literal
        // branch: builds with a static authored basic resolve here.
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate: () => undefined,
  }
}

function createKiemTuRuntime(deps: CultivationPathRuntimeDeps, ngu: boolean): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // Spec 2026-09-15 K3 — tram is a MORTAL precursor: once a path is
      // chosen it is no longer the basic. Kiem Tu basics resolve through
      // the dynamicBasic orb provider; the static authored def is the
      // inert slot filler.
      return BASIC_ATTACKS_BY_BUILD[player.cultivationPath!] ?? GENERIC_PHYSICAL_BASIC
    },
    resolveSpecialUltimate: () => undefined,
    buildDynamicBasic: ngu
      ? (player, nodes, rng) =>
          buildNguKiemDaoProvider(player, collectKiemDaoCascadeUnlocks(player, nodes), rng)
      : (player, nodes) =>
          buildKiemPhoProvider(player, collectKiemPhoComboModifiers(player, nodes)),
    emblemSlots: ngu
      ? () => ({ special: TU_KIEM_Y_EMBLEM, ultimate: KIEM_DAO_CASCADE_EMBLEM })
      : undefined,
  }
}

function createPhapTuNguHanhRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      const element = deps.getPhapTuElement()
      const authoredBasicId = element ? PHAP_TU_KIT_IDS[element]?.[0] : undefined

      return (
        resolveAuthoredBasic(deps, player, authoredBasicId, true) ??
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      const element = deps.getPhapTuElement()

      if (!element) {
        return {}
      }

      const [, specialId, ultimateId] = PHAP_TU_KIT_IDS[element]
      const specialSkill = deps.skillManager.get(specialId)
      const ultimateSkill = deps.skillManager.get(ultimateId)

      return {
        special: specialSkill
          ? applyPhapTuTheGains(
              deps,
              applyRouteToTurnSkill(
                toTurnSkillDefinition(specialSkill, deps.skillSystem.getEffectiveSkill(specialSkill)),
                deps.routeProfileProvider(specialSkill.id),
              ),
              player,
              PHAP_TU_THE_GAIN_SPECIAL,
            )
          : undefined,
        ultimate: ultimateSkill
          ? applyPhapTuEmpowerment(
              deps,
              applyPhapTuTheGains(
                deps,
                applyRouteToTurnSkill(
                  toTurnSkillDefinition(
                    ultimateSkill,
                    deps.skillSystem.getEffectiveSkill(ultimateSkill),
                  ),
                  deps.routeProfileProvider(ultimateSkill.id),
                ),
                player,
                0,
              ),
              player,
              element,
            )
          : undefined,
      }
    },
  }
}

function createPhapTuNgoDaoRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      assertNgoDaoKitLearned(deps, player)
      return (
        resolveAuthoredBasic(deps, player, PHAP_TU_AN_BASIC_ID, true) ?? GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      // Phap Tu An (Task 7) — the special is the repeat-cast skill
      // granted at the ritual; the ult slot is a passive
      // (ngo_dao_hon_don), no ultimate TurnSkillDefinition.
      assertNgoDaoKitLearned(deps, player)

      const specialSkill = deps.skillManager.get(PHAP_TU_AN_SPECIAL_ID)

      return {
        special: specialSkill
          ? applyAnKitToSpecial(
              toTurnSkillDefinition(specialSkill, deps.skillSystem.getEffectiveSkill(specialSkill)),
              resolveAnElementBasicPool(deps),
            )
          : undefined,
      }
    },
  }
}

function createTheTuHienRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // The Tu Reimagined (spec section 5, INV-3) — root-owned kit, else
      // the generic melee fallback only.
      return resolveTheTuKit(deps, player)?.basic ?? GENERIC_PHYSICAL_BASIC
    },
    resolveSpecialUltimate(player) {
      const kit = resolveTheTuKit(deps, player)
      return kit ? { special: kit.special, ultimate: kit.ultimate } : {}
    },
    buildSurviveSources(player: PlayerData, participant: TurnBattleParticipant, hasActiveBuff: (definitionId: BuffDefinitionId) => boolean): SurviveLethalSource[] {
      // The Tu Reimagined (plan Task 9, D9) — Cuong Chien only: the
      // survival source reads the participant's live ultimate slot and
      // buff pool; node-resolved duration comes off the baked kit clone.
      if (deps.getNodeLevel('cuong_chien', player) <= 0) {
        return []
      }

      return [
        new TheTuBatTuSurvival({
          ultimateSlot: () => participant.ultimate,
          hasActiveBuff,
        }),
      ]
    },
  }
}

function createTheTuUngTheRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(deps),
    resolveBasic(player) {
      // Spec section 6.1 — fixed kit granted at path choice; the built
      // clone's grantsBuffsAtBuild plants ung_the + owned-root markers.
      return resolveTheTuAnKit(deps, player).basic
    },
    resolveSpecialUltimate(player) {
      const kit = resolveTheTuAnKit(deps, player)
      return {
        special: kit.special,
        ultimate: kit.ultimate,
        reactivePayloads: kit.reactivePayloads,
        maxThe: kit.maxThe,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// The dispatch table — the ONLY place path:way identity selects behavior.
// ---------------------------------------------------------------------------

export type CultivationPathRuntimeFactory = (
  deps: CultivationPathRuntimeDeps,
) => CultivationPathRuntime

export const CULTIVATION_PATH_RUNTIME_FACTORIES: Record<string, CultivationPathRuntimeFactory> = {
  'kiem_tu:hien': (deps) => createKiemTuRuntime(deps, false),
  'kiem_tu:ngu': (deps) => createKiemTuRuntime(deps, true),
  'phap_tu:ngu_hanh': createPhapTuNguHanhRuntime,
  'phap_tu:ngo_dao': createPhapTuNgoDaoRuntime,
  'the_tu:hien': createTheTuHienRuntime,
  'the_tu:ung_the': createTheTuUngTheRuntime,
}

/**
 * Resolve the combat runtime for a player. Dispatch key is the persisted
 * `cultivationPath:cultivationWay` pair; unknown/absent pairs resolve to
 * the mortal runtime (which still honors BASIC_ATTACKS_BY_BUILD for any
 * path id that authors a static basic).
 */
export function resolveCultivationPathRuntime(
  player: PlayerData,
  deps: CultivationPathRuntimeDeps,
  factories: Record<string, CultivationPathRuntimeFactory> = CULTIVATION_PATH_RUNTIME_FACTORIES,
): CultivationPathRuntime {
  const key = player.cultivationPath
    ? `${player.cultivationPath}:${player.cultivationWay ?? ''}`
    : ''
  const factory = factories[key] ?? factories[player.cultivationPath ?? ''] ?? createMortalRuntime
  return factory(deps)
}
