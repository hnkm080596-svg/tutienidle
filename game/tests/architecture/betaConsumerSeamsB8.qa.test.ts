// @vitest-environment jsdom
//
// QA FIXPOINT probe - consumer-seam wave B8 (blind review on fba2bd85):
// dormant records reaching LIVE render surfaces under the beta lock.
// frontend-contract tri-state: a scope-hidden entity must never render
// as a selectable row or an armed control - parked-but-intact records
// are correct; rendering them (or rendering an enabled control whose
// write op fails closed) is the leak class this file pins.
//
// F-B8-1 SkillPathPanel library: `skillPathEntries` consumes
//   skillManager.getAll() + NATIVE_CORE_SKILL_IDS with no
//   betaSkillAdmitted filter - a carried dormant save lists dormant-way
//   skills AND dormant native cores (with an enabled "Nang cap" button
//   whose levelUpSkill write rejects - an enabled-but-dead control).
// F-B8-2 PillBagSection: `entries` maps pillBag.getAll() verbatim -
//   scope-hidden pill families render as cells and arm for drink;
//   the second click hits usePillDetailed's 'scope_hidden' reject.
// F-B8-3 TechniqueBand: renders techniqueManager.getActive() verbatim -
//   a dormant way's canonical technique shows hero+sections and an
//   enabled grade button (canAdvanceTechniqueGrade carries no
//   betaTechniqueAdmitted check; tryAdvanceTechniqueGrade rejects).
// F-B8-4 CharacterPanel: selectedTalents maps selectedTalentIds
//   unfiltered and characterAuraColor reads the dormant way's element
//   on a carried save (display-only identity leak).
//
// Every assertion states CONTRACT behavior; failures on the pinned
// commit are the deterministic repro evidence.
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import SkillPathPanel from '@/components/panels/SkillPathPanel.vue'
import TechniqueBand from '@/components/panels/skill-path/TechniqueBand.vue'
import PillBagSection from '@/components/panels/bag-sections/PillBagSection.vue'
import BagGrid from '@/components/panels/BagGrid.vue'
import BreakthroughRequirementPanel from '@/components/common/BreakthroughRequirementPanel.vue'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import CharacterPanel from '@/components/panels/CharacterPanel.vue'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { vTooltip } from '@/directives/tooltip'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { SKILLS } from '@/data/skill/Skills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { pills } from '@/data/pill/pills'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { skillCoreNodeId } from '@/core/progression/SkillCoreLevel'
import { ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import { isBetaTalentId, scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { betaSkillAdmitted, betaTechniqueAdmitted } from '@/core/betaScopeSkillDomain'
import { betaTechniqueSurfaceFor } from '@/core/betaScopeTechniqueDomain'
import type { PlayerData } from '@/core/player/Player'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function mountPanel(
  component: object,
  manager: GameManager,
  setup?: (player: ReturnType<typeof usePlayerStore>, pinia: ReturnType<typeof createPinia>) => void,
) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  window.ResizeObserver = window.ResizeObserver || (class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never)

  const stateVersion = ref(0)
  const pinia = createPinia()
  const app = createApp({ render: () => h(component as never) })

  app.use(pinia)
  app.use(i18n)
  app.provide(GAME_MANAGER_KEY, manager)
  app.provide(STATE_VERSION_KEY, stateVersion)
  app.provide(BUMP_STATE_KEY, () => {
    stateVersion.value += 1
  })
  app.directive('tooltip', vTooltip)

  const player = usePlayerStore(pinia)
  setup?.(player, pinia)

  app.mount(container)

  return { container, player, pinia, unmount: () => { app.unmount(); container.remove() } }
}

function renderedListLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.skill-path-list__label'))
    .map(el => el.textContent?.trim() ?? '')
}

// ---------------------------------------------------------------------------
// F-B8-1 - skill-path library
// ---------------------------------------------------------------------------

describe('F-B8-1: SkillPathPanel library must not render scope-hidden kit content', () => {
  it('a carried hidden_spell save lists no dormant-way learned skills', async () => {
    const vanPhap = SKILLS.find(s => s.id === 'van_phap_tuy_tam')!
    const daPhap = SKILLS.find(s => s.id === 'da_phap_lien_tuyen')!

    // Fixture sanity: the hidden_spell kit is genuinely dormant under
    // the beta lock (the write seam learnSkill/levelUpSkill already
    // rejects these ids).
    expect(betaSkillAdmitted('van_phap_tuy_tam')).toBe(false)
    expect(betaSkillAdmitted('da_phap_lien_tuyen')).toBe(false)

    const gameManager = new GameManager()
    // A carried save restores its learned list verbatim.
    gameManager.skillManager.restore([vanPhap, daPhap])

    const view = mountPanel(SkillPathPanel, gameManager, (player, pinia) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'spell'
      player.$state.cultivationWay = 'hidden_spell_pathway'
      useUiStore(pinia).standalonePanel = 'skill'
    })
    await nextTick()

    const labels = renderedListLabels(view.container)
    // Contract: scope-hidden entities never render on a beta surface.
    expect(labels).not.toContain('Vạn Pháp Tùy Tâm')
    expect(labels).not.toContain('Đa Pháp Liên Tuyên')

    view.unmount()
  })

  it('a carried body save lists no dormant native core rows', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const view = mountPanel(SkillPathPanel, gameManager, (player, pinia) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'body'
      player.$state.cultivationWay = 'body_pathway'
      // The carried save owns a dormant kit core (nodeLevels survives
      // restore - parked record, correct) and insight to afford an
      // upgrade click.
      player.$state.nodeLevels = { [skillCoreNodeId('cuong_quyen')]: 2 }
      player.$state.skillInsight = 9999
      useUiStore(pinia).standalonePanel = 'skill'
    })
    await nextTick()

    const labels = renderedListLabels(view.container)
    expect(labels).not.toContain('Cuồng Quyền')

    view.unmount()
  })

  it('dormant native core affordance: read arm refuses the preview, write gate rejects', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const pinia = createPinia()
    const player = usePlayerStore(pinia)
    player.$state.realmId = 'qi_refining'
    player.$state.cultivationPath = 'body'
    player.$state.cultivationWay = 'body_pathway'
    player.$state.nodeLevels = { [skillCoreNodeId('cuong_quyen')]: 2 }
    player.$state.skillInsight = 9999
    gameManager.setActivePlayer(player.$state)

    // The read arm no longer prices the upgrade for a scope-hidden
    // core - the surface cannot arm the button...
    expect(gameManager.progressionOps.getSkillCoreUpgradeCost('cuong_quyen', player.$state))
      .toBeUndefined()
    // ...and the write seam itself keeps refusing (pre-fix the read
    // priced it while the write rejected - the dead control).
    expect(gameManager.progressionOps.levelUpSkill('cuong_quyen', player.$state)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// F-B8-2 - pill bag
// ---------------------------------------------------------------------------

describe('F-B8-2: PillBagSection must not render scope-hidden pill stacks', () => {
  it('a dormant-family stack renders no cell while a beta stack renders', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)

    // Carried save inventory: a beta pill and a dormant-family pill.
    // Added before mount - entries compute against the seeded bag.
    expect(scopeHiddenPillFamilyOfId('phi_van_dan_mortal')).toBe('phi_van_dan')
    gameManager.pillBag.add(gameManager.pillRegistry.get('tu_linh_dan_mortal'), 2)
    gameManager.pillBag.add(gameManager.pillRegistry.get('phi_van_dan_mortal'), 3)

    const view = mountPanel(PillBagSection, gameManager, (player) => {
      player.$state.realmId = 'mortal'
    })
    gameManager.setActivePlayer(view.player.$state)
    await nextTick()

    // Bag cells carry the item identity on aria-label / icon alt -
    // the visible nametag is intentionally off (tooltip-only).
    const labels = Array.from(view.container.querySelectorAll('.bag-section__slot'))
      .map(el => el.getAttribute('aria-label') ?? '')
    // CONTROL: a beta-admitted stack renders.
    expect(labels.some(label => label.includes('Tụ Linh Đan'))).toBe(true)
    // Contract: a scope-hidden family never renders - parked records
    // stay parked, no cell, no drink affordance (the click would arm
    // a usePillDetailed call that fails closed as 'scope_hidden').
    expect(labels.some(label => label.includes('Phi Vân Đan'))).toBe(false)

    view.unmount()
  })

  it('the pill tab count agrees with the filtered grid (dormant-only bag reads 0)', async () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerPills(pills)
    gameManager.pillBag.add(gameManager.pillRegistry.get('phi_van_dan_mortal'), 3)

    const view = mountPanel(BagGrid, gameManager, (player, pinia) => {
      player.$state.realmId = 'mortal'
      useUiStore(pinia).setActiveBagTab('pill')
    })
    gameManager.setActivePlayer(view.player.$state)
    await nextTick()

    const count = view.container.querySelector('.bag-grid__count')
    expect(count?.textContent?.trim().startsWith('0')).toBe(true)

    view.unmount()
  })
})

// ---------------------------------------------------------------------------
// F-B8-3 - technique band
// ---------------------------------------------------------------------------

describe('F-B8-3: TechniqueBand must not render a dormant way technique', () => {
  it('a carried sword save shows no dormant technique hero or grade control', async () => {
    const swordArt = TECHNIQUES.find(t => t.id === 'sword_control_art')!
    expect(betaTechniqueAdmitted(swordArt.id)).toBe(false)

    const gameManager = {
      techniqueManager: { getActive: () => swordArt },
      materialBag: { getAmount: () => 99999 },
      materialRegistry: { get: () => ({ name: 'Linh Thạch' }) },
      // The write gate holds (betaTechniqueAdmitted reject inside
      // tryAdvanceTechniqueGrade); the seam here is the surface
      // offering the action at all. The model call delegates to the
      // real domain verdict - same wiring as GameManagerRealmAdvanceOps.
      realmAdvanceOps: {
        tryAdvanceTechniqueGrade: () => false,
        getBetaTechniqueSurfaceModel: (p: PlayerData) =>
          betaTechniqueSurfaceFor(p, {
            activeTechnique: swordArt,
            materialAmount: () => 99999,
            materialName: () => 'Linh Thạch',
            turnBattleInProgress: false,
          }),
      },
    } as unknown as GameManager

    const view = mountPanel(TechniqueBand, gameManager, (player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
    })
    await nextTick()

    // Contract: the parked technique stays parked - no hero, no
    // sections, no (dead) "Nang Canh" button on a beta surface.
    expect(view.container.querySelector('.technique-band__hero')).toBeNull()
    expect(view.container.querySelector('.technique-band__grade-btn')).toBeNull()

    view.unmount()
  })

  it('the breakthrough confirm shows no unperfected-technique warning for a dormant technique', async () => {
    const swordArt = TECHNIQUES.find(t => t.id === 'sword_control_art')!

    const gameManager = {
      techniqueManager: { getActive: () => swordArt },
      materialBag: { getAmount: () => 99999 },
      materialRegistry: { get: () => ({ name: 'Linh Thach' }) },
      equipmentBag: { getEquipped: () => [] },
      realmAdvanceOps: { tryAdvanceTechniqueGrade: () => false },
    } as unknown as GameManager

    const view = mountPanel(BreakthroughRequirementPanel, gameManager, (player, pinia) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
      // No gear equipped - the only possible warning is the technique's.
      useBreakthroughRequirementStore(pinia).open()
    })
    await nextTick()

    // The dormant technique's projected state must not surface - the
    // advisory read treats it as absent.
    expect(view.container.querySelectorAll('.breakthrough-confirm__warning'))
      .toHaveLength(0)

    view.unmount()
  })
})

// ---------------------------------------------------------------------------
// F-B8-4 - character sheet
// ---------------------------------------------------------------------------

describe('F-B8-4: CharacterPanel must not render dormant talent/way identity', () => {
  // F-B8-4 talent half promoted to Medium (B10-002) and fixed: the
  // roster is now filtered through isBetaTalentId, so the pin is live.
  it('a carried save lists only beta-admitted talents', async () => {
    const gameManager = new GameManager()

    const view = mountPanel(CharacterPanel, gameManager, (player) => {
      player.$state.realmId = 'qi_refining'
      // 'lk_linh_mach' is a beta-admitted breakthrough talent;
      // 'kd_thanh_dan' lives in the golden_core pool - authored but
      // dormant, ownable only on a carried out-of-scope save.
      expect(isBetaTalentId('lk_linh_mach')).toBe(true)
      expect(isBetaTalentId('kd_thanh_dan')).toBe(false)
      player.$state.selectedTalentIds = ['lk_linh_mach', 'kd_thanh_dan']
    })
    await nextTick()

    const names = Array.from(view.container.querySelectorAll('.talent-seal__name'))
      .map(el => el.textContent?.trim() ?? '')

    expect(names).toContain('Linh Mạch')
    expect(names).not.toContain('Thánh Đan')

    view.unmount()
  })

  // F-B8-4 - Low, deferred per Medium+-only ruling (human exception).
  it.skip('a carried dormant-way save renders no dormant element aura', async () => {
    const gameManager = new GameManager()

    const view = mountPanel(CharacterPanel, gameManager, (player) => {
      player.$state.realmId = 'qi_refining'
      player.$state.cultivationPath = 'sword'
      player.$state.cultivationWay = 'sword_pathway'
    })
    await nextTick()

    const figure = view.container.querySelector<HTMLElement>('.character-panel__figure')
    const style = figure?.getAttribute('style') ?? ''
    // Contract: the dormant way contributes no visual identity - the
    // neutral chrome fallback is the expected read-model.
    expect(style).not.toContain(ELEMENT_COLOR_VARS.metal)
    expect(style).toContain('chrome-500')

    view.unmount()
  })
})
