// @vitest-environment jsdom
// QA FIXPOINT probe (blind adversarial audit, consumer seams only,
// commit ea406a1f) - capability-driven EMISSION channels downstream of
// the dormant way record. Prior rounds pinned the combat-build gate
// (wayAdmitted) and the latent survive.extraSources bind; this file
// attacks the SIBLING channels that read the same persisted pair
// (cultivationPath, cultivationWay) through the UNGATED capability
// resolvers (resolvePathCapabilities / hasStaticPathCapability /
// hasPathCapability - none consults isBetaWay) and mint scope-hidden
// HUD/branding surfaces on a carried save:
//
//   * kiemBarBridge - 'The' / 'Kiem Pho' / 'Kiem Y' bar snapshots polled
//     per frame by CombatScene.pollKiemBar on a carried body/sword way;
//   * theBarBridge - the Ung The HUD snapshot (thamTargetId /
//     quanTheActive / reactionDebt / quaThe) polled per frame by
//     CombatScene.pollTheBar on a carried body way;
//   * TurnCombatSkillBar.isAnPath - gameManager.hasPathCapability(
//     'spell.reaction_aura') renders the hidden_spell aura emblem while
//     the aura entryBuff itself is wayAdmitted-gated;
//   * MaterialBagSection - entries map materialBag.getAll() verbatim, so
//     a carried scope-suppressed material (companion pull token, whose
//     CurrencyHud sibling censors the same id at every realm) renders
//     as an ordinary live cell.
//
// Assertions marked DEFECT fail on the audited state - each failure is
// the deterministic repro for a reported finding.
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import type { TurnBattle } from '@/core/battle/turn/TurnBattleSystem'
import type { GameManager } from '@/core/game/GameManager'
import { makeKiemBarReader } from '@/presentation/bridges/kiemBarBridge'
import { makeTheBarReader } from '@/presentation/bridges/theBarBridge'
import {
  hasPathCapability,
  hasStaticPathCapability,
  resolvePathCapabilities,
} from '@/core/player/CultivationPathSystem'
import { HIDDEN_SPELL_PASSIVE_ID } from '@/core/phap-tu/PhapTuPath'
import { freshSwordPathState } from '@/core/kiem-tu/KiemTuState'
import { createSpellPathState } from '@/core/phap-tu/PhapTuState'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import { GameManager as RealGameManager } from '@/core/game/GameManager'
import { materials } from '@/data/materials/materials'
import { BUMP_STATE_KEY, GAME_MANAGER_KEY, STATE_VERSION_KEY } from '@/composables/useGameState'
import { vTooltip } from '@/directives/tooltip'
import { i18n } from '@/i18n'
import {
  lockBetaFeaturesForTests,
} from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'

// Pin the canonical all-false beta tables (the global test setup
// unlocks them).
lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

// Minimal TurnBattle stand-in for the HUD readers: 'fighting' state and
// a players[0] entity are all the bridges consume.
function fightingBattle(): TurnBattle {
  return {
    state: 'fighting',
    players: [
      {
        entity: { id: 'player-entity', stats: { maxHp: 100 } },
        dynamicBasic: undefined,
        basic: undefined,
      },
    ],
  } as unknown as TurnBattle
}

function bridgeManager(battle: TurnBattle | null): GameManager {
  return {
    getTurnBattle: () => battle,
    getBattleBuffs: () => [],
  } as unknown as GameManager
}

// jsdom has no ResizeObserver - useBagGridLayout observes the grid on
// mount; stub per InventorySort.test.ts pattern.
beforeEach(() => {
  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never)
})

describe('capability resolver on carried dormant ways', () => {
  it('resolvePathCapabilities mints the full declared set for every scope-hidden way', () => {
    const dormant = player({ cultivationPath: 'body', cultivationWay: 'body_pathway' })
    // DEFECT: no isBetaWay gate inside the resolver - every dormant way
    // emits its declared capability set to any consumer.
    expect([...resolvePathCapabilities(dormant, { hasSkill: () => false })]).toEqual([])

    const hiddenSword = player({ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway' })
    expect([...resolvePathCapabilities(hiddenSword, { hasSkill: () => false })]).toEqual([])
  })

  it('control: an uncommitted mortal player resolves no capabilities', () => {
    expect([...resolvePathCapabilities(player(), { hasSkill: () => false })]).toEqual([])
  })
})

describe('kiemBar snapshot on a carried dormant way', () => {
  it("DEFECT: a carried sword_pathway save emits the 'Kiem Pho' HUD bar mid-battle", () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
    })
    const reader = makeKiemBarReader(bridgeManager(fightingBattle()), () => p)

    // Beta contract: way_out_of_scope save -> no Kiem bar. The bridge
    // mints the persisted preset strip instead.
    expect(reader()).toBeNull()
  })

  it("DEFECT: a carried hidden_sword_pathway save emits the 'Kiem Y' HUD bar mid-battle", () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'hidden_sword_pathway',
      swordPath: { preset: [], kiemY: 40, kiemDaoCount: 3, kiemDaoBase: 2 },
    })
    const reader = makeKiemBarReader(bridgeManager(fightingBattle()), () => p)

    expect(reader()).toBeNull()
  })

  it("DEFECT: a carried body way emits the 'The' proc-fuel HUD bar mid-battle", () => {
    for (const way of ['body_pathway', 'hidden_body_pathway'] as const) {
      const p = player({
        realmId: 'qi_refining',
        cultivationPath: 'body',
        cultivationWay: way,
      })
      const reader = makeKiemBarReader(bridgeManager(fightingBattle()), () => p)
      expect(reader()).toBeNull()
    }
  })

  it('control: the live spell way emits no Kiem bar at all', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: createSpellPathState(),
    })
    const reader = makeKiemBarReader(bridgeManager(fightingBattle()), () => p)
    expect(reader()).toBeNull()
  })

  it('control: no live battle -> reader hides the bar on any way', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
    })
    const reader = makeKiemBarReader(bridgeManager(null), () => p)
    expect(reader()).toBeNull()
  })
})

describe('theBar snapshot on a carried dormant way', () => {
  it('DEFECT: a carried hidden_body_pathway save emits the Ung The HUD mid-battle', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'body',
      cultivationWay: 'hidden_body_pathway',
      spellPath: createSpellPathState(),
      nodeLevels: {},
    })
    const reader = makeTheBarReader(bridgeManager(fightingBattle()), () => p)

    // Beta contract: way_out_of_scope save -> no Ung The snapshot. The
    // bridge returns the dormant-economy HUD object (thamTargetId /
    // quanTheActive / reactionDebt / quaThe) instead.
    expect(reader()).toBeNull()
  })

  it('DEFECT: a carried body_pathway save emits the same Ung The HUD', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'body',
      cultivationWay: 'body_pathway',
      spellPath: createSpellPathState(),
      nodeLevels: {},
    })
    const reader = makeTheBarReader(bridgeManager(fightingBattle()), () => p)
    expect(reader()).toBeNull()
  })

  it('control: hidden_spell_pathway owns NO The pool (spec P6) -> still hidden', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'spell',
      cultivationWay: 'hidden_spell_pathway',
      spellPath: createSpellPathState(),
      nodeLevels: {},
    })
    const reader = makeTheBarReader(bridgeManager(fightingBattle()), () => p)
    expect(reader()).toBeNull()
  })
})

describe("the An emblem channel (TurnCombatSkillBar.isAnPath)", () => {
  it("DEFECT: hasPathCapability('spell.reaction_aura') resolves true on a carried hidden_spell save", () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'spell',
      cultivationWay: 'hidden_spell_pathway',
      spellPath: createSpellPathState(),
    })

    // The skill bar computes isAnPath via the bound facade
    // (skillManager.has for ngo_dao_hon_don); on a carried save that
    // passive IS learned, so the emblem mints while the aura entryBuff
    // is wayAdmitted-gated - dormant branding inside live combat.
    expect(hasPathCapability(p, 'spell.reaction_aura', {
      hasSkill: (id: string) => id === HIDDEN_SPELL_PASSIVE_ID,
    })).toBe(false)
  })

  it('control: the same capability is false on the live spell way', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: createSpellPathState(),
    })
    expect(hasPathCapability(p, 'spell.reaction_aura', {
      hasSkill: (id: string) => id === HIDDEN_SPELL_PASSIVE_ID,
    })).toBe(false)
  })

  it('DEFECT: static capability reads admit every dormant way regardless of beta gate', () => {
    // The shared mint path for the bars: 'static' mode never reaches
    // isBetaWay, so every declared static cap re-admits a dormant way.
    const hiddenSword = player({ cultivationPath: 'sword', cultivationWay: 'hidden_sword_pathway' })
    expect(hasStaticPathCapability(hiddenSword, 'sword.sword_riding')).toBe(false)

    const body = player({ cultivationPath: 'body', cultivationWay: 'body_pathway' })
    expect(hasStaticPathCapability(body, 'body.essence_economy')).toBe(false)
  })
})

function mountMaterialBag(manager: RealGameManager): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div')
  const app = createApp({ render: () => h(MaterialBagSection) })
  const version = ref(0)
  app.use(createPinia())
  app.use(i18n)
  app.directive('tooltip', vTooltip)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, version)
  app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
  app.mount(container)
  return { container, unmount: () => app.unmount() }
}

describe('material bag surface on carried scope-suppressed records', () => {
  it('DEFECT: a carried companion pull token renders as an ordinary live cell', () => {
    const manager = new RealGameManager()
    manager.catalogOps.registerMaterials(materials)
    const token = materials.find((m) => m.id === 'chieu_hien_lenh')!
    manager.materialBag.add(token, 3)

    const mounted = mountMaterialBag(manager)
    const filled = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.bag-section__slot.slot-view--filled'),
    )

    // Beta contract: the pull token's domain is scope-hidden and its
    // only sink is realm-locked; CurrencyHud censors the same id at
    // every realm. The bag renders it as an ordinary available cell
    // (aria-label carries the full name, tooltip advertises the dormant
    // gacha "dung tai Chieu Hien Quan") - tri-state dishonesty: no
    // scope-hidden/locked marker on the surface.
    expect(filled).toHaveLength(0)
    mounted.unmount()
  })
})
