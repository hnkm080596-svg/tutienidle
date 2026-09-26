/**
 * Mission C Task 9 (spec C4, audit T5-44) - the SINGLE dispatch site for
 * cultivation-path combat integration. Every isKiemTuX / isPhapTuX /
 * isTheTuX branch that used to live in GameManager/GameManagerTurnBattleOps
 * resolves here into a CultivationPathRuntime; the battle orchestrator
 * consumes the interface only (architecture guard:
 * tests/architecture/battleLifecyclePathBoundary.test.ts).
 *
 * The factory bodies are the moved GameManager resolvers
 * (resolvePlayerBasicAttack / resolvePlayerSpecialUltimate /
 * resolveTheTuKit / resolveTheTuAnKit / authoredBasicSkillId /
 * assertNgoDaoKitLearned / resolveAnElementBasicPool /
 * buildTheTuBatTuSurvival) - relocated verbatim modulo `this.` -> deps,
 * per the plan's move-don't-rewrite rule.
 */
import type { PlayerData } from './Player'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { SurviveLethalSource } from '../combat/CombatSystem'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { CultivationPathRuntime, CultivationPathRuntimeDeps } from './CultivationPathRuntime'
import { hasPathCapability, resolveActiveWayStatDomains } from './CultivationPathSystem'
import { getActiveWayDefinition } from './CultivationPathKit'

import { isMortalPrecursorSkillId, MORTAL_DEFAULT_BASIC_ID } from '../skill/MortalPrecursors'
import {
  toTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
} from '../skilldef/LegacySkillAdapter'
import { BASIC_ATTACKS_BY_BUILD, GENERIC_PHYSICAL_BASIC } from '../../data/skill/TurnBasicAttacks'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'
import {
  applyAnKitToBasic,
  applyAnKitToSpecial,
} from '../../data/skill/TurnAnKitSkills'
import {
  HIDDEN_SPELL_BASIC_ID,
  HIDDEN_SPELL_PASSIVE_ID,
  HIDDEN_SPELL_REQUIRED_SKILLS,
  HIDDEN_SPELL_SPECIAL_ID,
} from '../phap-tu/PhapTuPath'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import {
  resolveMaxThe,
  SPELL_PATH_MAX_THE,
  isHiddenSpellPathway,
} from '../phap-tu/PhapTuPath'
import { buildPhapTheVariant } from '../phap-tu/PhapTheVariants'
import {
  KIM_LIET_PENETRATION_PER_STACK,
  PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
  PHAP_TU_WINDOW_LANDED_CONSEQUENCES,
} from '../../data/skill/PhapTuSkills'
import {
  buildTheTuAnKit,
  buildTheTuKit,
  type TheTuAnKit,
  type TheTuKit,
} from '../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../the-tu/TheTuKitModifiers'
import { collectHiddenBodyMechanicModifiers } from '../the-tu/TheTuAnMechanicModifiers'
import { BodyBatTuSurvival } from '../the-tu/TheTuBatTuSurvival'
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
 * Review round-4 (MEDIUM) — the hidden_spell_pathway kit is a fixed three-skill
 * set granted atomically at the ritual (HIDDEN_SPELL_REQUIRED_SKILLS is
 * the single authority). A save/registry missing ANY member is corrupt
 * progression state — fail loudly at battle build instead of silently
 * dropping the special button or the dao multicast. Called from both
 * battle-build resolvers so each enforces the contract independently.
 */
function assertNgoDaoKitLearned(deps: CultivationPathRuntimeDeps, player: PlayerData) {
  if (!isHiddenSpellPathway(player)) {
    return
  }

  const missing = HIDDEN_SPELL_REQUIRED_SKILLS.filter(
    (skillId) => !deps.skillManager.has(skillId),
  )

  if (missing.length > 0) {
    throw new Error(
      `[GameManager] hidden_spell_pathway kit incomplete — missing learned skills: ${missing.join(', ')}`,
    )
  }
}

/**
 * Review fix (HIGH-1) — the An composite pool is the CANONICAL
 * conversion of the five authored element basics (SPELL_KIT_IDS[el][0]
 * templates through getEffectiveSkill + toTurnSkillDefinition), not a
 * static duplicate table. A missing/invalid template throws here —
 * authoring errors must surface loudly at battle build, never silently
 * shrink the pick pool.
 */
function resolveAnElementBasicPool(deps: CultivationPathRuntimeDeps): TurnSkillDefinition[] {
  return ELEMENT_ORDER.map((element) => {
    const templateId = SPELL_KIT_IDS[element][0]
    const template = deps.skillTemplates.get(templateId)

    if (!template) {
      throw new Error(`An kit element pool: skill template "${templateId}" is not registered`)
    }

    return toTurnSkillDefinition(template, deps.skillSystem.getEffectiveSkill(template))
  })
}

/**
 * The canonical authored-Skill -> TurnSkillDefinition basic pipeline
 * (moved from GameManager.resolvePlayerBasicAttack). `strict` paths
 * (spell ways) fail loudly on a missing required basic or a converter
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
    const converted = toTurnSkillDefinition(skill, effective)

    // Task 11 — the An basic carries its composite pick (uniform
    // element_basic pool) plus `multicast` when the player owns the
    // ngo_dao_hon_don dao passive (granted at the ritual).
    const resolved = isHiddenSpellPathway(player)
      ? applyAnKitToBasic(
          converted,
          deps.skillManager.has(HIDDEN_SPELL_PASSIVE_ID),
          resolveAnElementBasicPool(deps),
        )
      : converted

    return {
      ...resolved,
      cooldownTurns: 0,
      resourceType: 'none',
      resourceCost: undefined,
    }
  } catch (error) {
    // Review round-2 (LOW): phap paths have no static fallback — the
    // SPELL_BASICS table was a second authority that drifted from
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
 * local kit clone with collectBodyKitModifiers baked in. No root ->
 * undefined (INV-3 fallback is the caller's job).
 */
function resolveBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuKit | undefined {
  const mods = collectBodyKitModifiers(deps.nodeRegistry, player)

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
function resolveHiddenBodyKit(
  deps: CultivationPathRuntimeDeps,
  player: PlayerData,
): TheTuAnKit {
  const ownedRoots = (['ho_mon', 'phan_mon', 'tro_mon'] as const).filter(
    (root) => deps.getNodeLevel(root, player) > 0,
  )

  // Plan Task 20 — trunk economy + branch riders ride the one locked
  // channel; baked into participant-local marker/payload clones here.
  const mods = collectHiddenBodyMechanicModifiers(deps.nodeRegistry, player)

  return buildTheTuAnKit(ownedRoots, mods)
}

// ---------------------------------------------------------------------------
// Per-path runtime factories
// ---------------------------------------------------------------------------

function sharedMembers() {
  return {
    // Phap Tu Reimagined -- the cap authority moved off the deleted
    // node-cap aggregator: PhapTuPath.resolveMaxThe returns 5 for
    // spell_pathway, MAX_THE elsewhere.
    resolveMaxThe: (player: PlayerData) => resolveMaxThe(player),
    resolveStatDomains: (player: PlayerData) => resolveActiveWayStatDomains(player),
  }
}

/**
 * Mortal / pham_nhan — the persisted mortalBasicSkillId pick is the
 * player's chosen basic-tier skill (spec 2026-09-15 section 2.3:
 * huy_quyen is cast as a basic while mortal, its casts feeding the
 * hidden_body_pathway offer gate). Restricted to the precursor family —
 * an absent/illegal/unlearned pick resolves the tram default.
 */
function createMortalRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      // P7-M4 — the persisted pick is the mortal basic; the precursor
      // whitelist + learned membership guard it. Save v82 contract: a
      // mortal SAVE must carry the pick (preflight rejects otherwise);
      // this fallback is the defensive runtime default for in-memory /
      // crafted players, never a creation grant. NO slot read exists.
      const pick = player.mortalBasicSkillId
      const authoredBasicId =
        pick !== undefined && isMortalPrecursorSkillId(pick) && deps.skillManager.has(pick)
          ? pick
          : MORTAL_DEFAULT_BASIC_ID

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

function createSwordPathRuntime(deps: CultivationPathRuntimeDeps, hidden: boolean): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      // Spec 2026-09-15 K3 — tram is a MORTAL precursor: once a path is
      // chosen it is no longer the basic. Kiem Tu basics resolve through
      // the dynamicBasic orb provider; the static authored def is the
      // inert slot filler.
      return BASIC_ATTACKS_BY_BUILD[player.cultivationPath!] ?? GENERIC_PHYSICAL_BASIC
    },
    resolveSpecialUltimate: () => undefined,
    buildDynamicBasic: hidden
      ? (player, nodes, rng) =>
          buildNguKiemDaoProvider(player, collectKiemDaoCascadeUnlocks(player, nodes), rng)
      : (player, nodes) =>
          buildKiemPhoProvider(player, collectKiemPhoComboModifiers(player, nodes)),
    emblemSlots: hidden
      ? () => ({ special: TU_KIEM_Y_EMBLEM, ultimate: KIEM_DAO_CASCADE_EMBLEM })
      : undefined,
    // P7-M4 — display label for the provider-backed basic (Kiếm Phổ orb
    // machinery / Ngự Kiếm Đạo cascade), matching kiemBarBridge's wording.
    describeDynamicBasic: () => ({ name: hidden ? 'Ngự Kiếm Đạo' : 'Kiếm Phổ' }),
  }
}

function createSpellPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      const element = deps.getSpellPathElement()
      const authoredBasicId = element ? SPELL_KIT_IDS[element]?.[0] : undefined

      const resolved =
        resolveAuthoredBasic(deps, player, authoredBasicId, true) ??
        // P7-M4 - way-authored starter fallback: linh_bao fights as the
        // basic until the element kit supersedes (authored-read — the
        // starter comes off the committed way definition, no literal).
        resolveAuthoredBasic(
          deps,
          player,
          getActiveWayDefinition(player)?.starterBasicSkillId,
          false,
        ) ??
        (player.cultivationPath ? BASIC_ATTACKS_BY_BUILD[player.cultivationPath] : undefined) ??
        GENERIC_PHYSICAL_BASIC

      // Phap Tu Reimagined (spec D1/D2) — the basic's LANDED primary
      // grants +1 The (cap 5 battle-scoped); at 5 the empowered element
      // variant resolves (checked before cast, no consume). Hidden way
      // basics never reach this runtime (F11).
      //
      // Spec D11/D8 seam attach — the KIT basic (never the starter
      // fallback) carries its element's WINDOW landed lane (inert unless
      // the caster holds the Trang buff) and, for metal, the Kim Liet
      // per-stack pierce (spec D7/D11). Stamped BEFORE
      // buildPhapTheVariant so the empowered form inherits both.
      const isKitBasic = element !== undefined && resolved.id === authoredBasicId
      const windowLane = isKitBasic
        ? PHAP_TU_WINDOW_LANDED_CONSEQUENCES[element]
        : undefined
      const kitResolved: TurnSkillDefinition =
        windowLane !== undefined || (isKitBasic && element === 'metal')
          ? {
              ...resolved,
              ...(windowLane !== undefined && windowLane.length > 0
                ? {
                    landedConsequences: [
                      ...windowLane,
                      ...(resolved.landedConsequences ?? []),
                    ],
                  }
                : {}),
              ...(element === 'metal'
                ? {
                    penetrationFromStacks: {
                      ailmentId: 'kim_liet',
                      perStack: KIM_LIET_PENETRATION_PER_STACK,
                    },
                  }
                : {}),
            }
          : resolved

      // The +1 The gain is stamped here (not on the return wrapper) so
      // the empowered variant inherits it through {...base} — spec D2:
      // 'the empowered cast is the basic's cast', it still mints +1 The.
      const stamped: TurnSkillDefinition = { ...kitResolved, theGainOnLandedCast: 1 }

      return {
        ...stamped,
        ...(element !== undefined
          ? {
              empowerment: {
                theThreshold: SPELL_PATH_MAX_THE,
                empowered: buildPhapTheVariant(element, stamped),
              },
            }
          : {}),
      }
    },
    resolveSpecialUltimate() {
      const element = deps.getSpellPathElement()

      if (!element) {
        return {}
      }

      // Spec D8 — kits resolve to {special} only; the legacy ultimate
      // (empowerment@100 chain-E god-ult) is retired.
      const [, specialId] = SPELL_KIT_IDS[element]
      const specialSkill = deps.skillManager.get(specialId)

      return {
        special: specialSkill
          ? {
              // Spec D8/F10 — the five Trang casts pay 30% of LIVE max
              // Linh Luc (evaluated at gate/consume time, never frozen);
              // the authored records carry no flat cost.
              ...toTurnSkillDefinition(
                specialSkill,
                deps.skillSystem.getEffectiveSkill(specialSkill),
              ),
              resourceCostPercentOfMax: PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
            }
          : undefined,
      }
    },
  }
}

function createHiddenSpellPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      assertNgoDaoKitLearned(deps, player)
      return (
        resolveAuthoredBasic(deps, player, HIDDEN_SPELL_BASIC_ID, true) ?? GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      // Phap Tu An (Task 7) — the special is the repeat-cast skill
      // granted at the ritual; the ult slot is a passive
      // (ngo_dao_hon_don), no ultimate TurnSkillDefinition.
      assertNgoDaoKitLearned(deps, player)

      const specialSkill = deps.skillManager.get(HIDDEN_SPELL_SPECIAL_ID)

      return {
        special: specialSkill
          ? applyAnKitToSpecial(
              toTurnSkillDefinition(specialSkill, deps.skillSystem.getEffectiveSkill(specialSkill)),
              resolveAnElementBasicPool(deps),
            )
          : undefined,
      }
    },
    grantsElementalReactionAura(player) {
      // Canonical-seals S3 (plan sec.9.4) -- the aura gate lives HERE,
      // inside the path-authority dispatch site. P1 - the check itself is
      // now the conditional capability 'spell.reaction_aura' declared on
      // the hidden_spell_pathway way (predicate: ngo_dao_hon_don learned; skill
      // membership arrives via deps.hasSkill - SkillManager is the owner).
      // A corrupt save missing the passive gets no aura and the kit assert
      // above still fails loudly.
      return hasPathCapability(player, 'spell.reaction_aura', {
        hasSkill: (skillId) => deps.skillManager.has(skillId),
      })
    },
  }
}

function createBodyPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      // The Tu Reimagined (spec section 5, INV-3) — root-owned kit;
      // P7-M4 way-authored starter fallback (huy_quyen) sits between the
      // kit and the generic melee fallback.
      return (
        resolveBodyKit(deps, player)?.basic ??
        resolveAuthoredBasic(
          deps,
          player,
          getActiveWayDefinition(player)?.starterBasicSkillId,
          false,
        ) ??
        GENERIC_PHYSICAL_BASIC
      )
    },
    resolveSpecialUltimate(player) {
      const kit = resolveBodyKit(deps, player)
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
        new BodyBatTuSurvival({
          ultimateSlot: () => participant.ultimate,
          hasActiveBuff,
        }),
      ]
    },
  }
}

function createHiddenBodyPathwayRuntime(deps: CultivationPathRuntimeDeps): CultivationPathRuntime {
  return {
    ...sharedMembers(),
    resolveBasic(player) {
      // Spec section 6.1 — fixed kit granted at path choice; the built
      // clone's grantsBuffsAtBuild plants ung_the + owned-root markers.
      return resolveHiddenBodyKit(deps, player).basic
    },
    resolveSpecialUltimate(player) {
      const kit = resolveHiddenBodyKit(deps, player)
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
  'sword:sword_pathway': (deps) => createSwordPathRuntime(deps, false),
  'sword:hidden_sword_pathway': (deps) => createSwordPathRuntime(deps, true),
  'spell:spell_pathway': createSpellPathwayRuntime,
  'spell:hidden_spell_pathway': createHiddenSpellPathwayRuntime,
  'body:body_pathway': createBodyPathwayRuntime,
  'body:hidden_body_pathway': createHiddenBodyPathwayRuntime,
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
