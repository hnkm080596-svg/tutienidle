// B18 blind consumer-seam probe (QA fixpoint, commit af3666e7).
// Render-level honesty checks downstream of the scope verdict:
// hostile persisted state (carried dormant-way kit, dormant bag
// stacks) mounted through the REAL components via SSR renderToString,
// so a leak is a concrete produced string, not a source read.
//
// Assertions marked DEFECT are expected to fail on the audited state -
// the failure body is the deterministic repro.
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { JSDOM } from 'jsdom'
import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '@/i18n'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import LoreCodex from '@/components/panels/scripture/LoreCodex.vue'
import MaterialBagSection from '@/components/panels/bag-sections/MaterialBagSection.vue'
import SkillPathPanel from '@/components/panels/SkillPathPanel.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import CharacterPanel from '@/components/panels/CharacterPanel.vue'
import BagGrid from '@/components/panels/BagGrid.vue'
import { getCultivateTexture, PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { GameManager } from '@/core/game/GameManager'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { lockBetaFeaturesForTests, unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { buildings } from '@/data/building/buildings'
import { materials } from '@/data/materials/materials'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { ENEMIES } from '@/data/enemy/Enemies'
import { QUESTS } from '@/data/quest/quests'

lockBetaWaysForTests()
lockBetaTalentsForTests()

// OverlayPanel -> useDialogFocus touches document.* inside an
// immediate watch during setup, so the node environment needs a
// minimal DOM global before any component setup runs.
const dom = new JSDOM('<!doctype html><html><body></body></html>')
for (const key of ['window', 'document', 'HTMLElement', 'SVGElement', 'Element', 'Node', 'navigator']) {
  Object.defineProperty(globalThis, key, {
    value: (dom.window as unknown as Record<string, unknown>)[key],
    configurable: true,
    writable: true,
  })
}

function realGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerStages(STAGES)
  gameManager.catalogOps.registerZones(zones)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerQuests(QUESTS)
  return gameManager
}

// SSR-mount a component with the same injection seams App.vue provides.
// v-tooltip is registered as a no-op SSR directive (mounted hooks never
// run under renderToString; only getSSRProps must exist).
const ssrTooltip = { getSSRProps: () => ({}) }

async function ssr(component: object, gameManager: GameManager): Promise<string> {
  const app = createSSRApp(component)
  app.use(i18n)
  app.use(createPinia())
  app.directive('tooltip', ssrTooltip)
  app.provide(GAME_MANAGER_KEY, gameManager)
  app.provide(STATE_VERSION_KEY, ref(0))
  app.provide(BUMP_STATE_KEY, () => {})
  return renderToString(app)
}

describe('B18 hostile persisted state -> read-model honesty', () => {
  beforeAll(() => {
    lockBetaFeaturesForTests()
  })
  afterAll(() => {
    unlockAllFeaturesForTests()
  })

  it('DEFECT: LoreCodex renders the suppressed Chiêu Hiền Lệnh stack', async () => {
    const gameManager = realGameManager()
    // Hostile carried save: banked companion pull tokens from a
    // pre-lock session. MaterialBag keeps them (persisted balances are
    // never deleted) - every sibling surface hides them via
    // isCompanionPullTokenSourceSuppressed.
    gameManager.materialBag.add(gameManager.materialRegistry.get('chieu_hien_lenh'), 5)
    const html = await ssr(LoreCodex, gameManager)
    // chi_hien_lenh is category 'other' -> LoreCodex's unsuppressed
    // filter admits it, and the slot renders its dormant branding
    // ("dùng tại Chiêu Hiền Quán để chiêu mộ đồng đội").
    expect(html).not.toContain('Chiêu Hiền Lệnh')
  })

  it('LoreCodex still renders honest lore stacks (control)', async () => {
    const gameManager = realGameManager()
    gameManager.materialBag.add(gameManager.materialRegistry.get('cultivator_diary'), 2)
    const html = await ssr(LoreCodex, gameManager)
    expect(html).toContain('Nhật Ký Tu Sĩ')
    expect(html).not.toContain('Chiêu Hiền Lệnh')
  })

  it('MaterialBagSection hides the same suppressed token (control)', async () => {
    const gameManager = realGameManager()
    gameManager.materialBag.add(gameManager.materialRegistry.get('chieu_hien_lenh'), 5)
    gameManager.materialBag.add(gameManager.materialRegistry.get('cultivator_diary'), 2)
    const html = await ssr(MaterialBagSection, gameManager)
    expect(html).not.toContain('Chiêu Hiền Lệnh')
    expect(html).toContain('Nhật Ký Tu Sĩ')
  })

  it('DEFECT: BagGrid material tab count includes the suppressed token', async () => {
    const gameManager = realGameManager()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createSSRApp(BagGrid)
    app.use(i18n)
    app.use(pinia)
    app.directive('tooltip', ssrTooltip)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, ref(0))
    app.provide(BUMP_STATE_KEY, () => {})

    const ui = useUiStore()
    ui.setActiveBagTab('material')
    // Hostile bag: only the suppressed token, so an honest header count
    // is 0 (the pill tab's own comment requires the count to agree with
    // what the grid can render).
    gameManager.materialBag.add(gameManager.materialRegistry.get('chieu_hien_lenh'), 5)
    const html = await renderToString(app)
    const countMatch = html.match(/bag-grid__count[^>]*>(\d+)/)
    expect(countMatch?.[1]).toBe('0')
  })

  it('DEFECT: SkillPathPanel subtitle brands a carried dormant sword way', async () => {
    const gameManager = realGameManager()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createSSRApp(SkillPathPanel)
    app.use(i18n)
    app.use(pinia)
    app.directive('tooltip', ssrTooltip)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, ref(0))
    app.provide(BUMP_STATE_KEY, () => {})

    const player = usePlayerStore()
    // Hostile carried save: committed hidden_sword_pathway - flagged
    // way_out_of_scope by unsupportedReleaseReason but still loads.
    player.$patch({
      realmId: 'foundation_establishment',
      cultivationPath: 'sword',
      cultivationWay: 'hidden_sword_pathway',
    })
    const ui = useUiStore()
    ui.openStandalonePanel('skill')

    const html = await renderToString(app)
    // The wayIdentity subtitle reads getActiveWayDefinition(player).name
    // ungated by betaWayAdmitted - the scope-hidden way name paints the
    // panel chrome while the entry list itself is correctly empty.
    expect(html).not.toContain('Vạn Kiếm Quyết')
    expect(html).not.toContain('Kiếm Tu')
  })

  it('SkillPathPanel subtitle is honest for a mortal save (control)', async () => {
    const gameManager = realGameManager()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createSSRApp(SkillPathPanel)
    app.use(i18n)
    app.use(pinia)
    app.directive('tooltip', ssrTooltip)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, ref(0))
    app.provide(BUMP_STATE_KEY, () => {})

    const ui = useUiStore()
    ui.openStandalonePanel('skill')
    const html = await renderToString(app)
    expect(html).not.toContain('Kiếm Tu')
    expect(html).not.toContain('Thể Tu')
  })

  it('DEFECT: PlayerPortrait cultivate variant renders dormant hidden-way art', async () => {
    const gameManager = realGameManager()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createSSRApp(PlayerPortrait, { variant: 'cultivate', height: 150 })
    app.use(i18n)
    app.use(pinia)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, ref(0))
    app.provide(BUMP_STATE_KEY, () => {})

    const player = usePlayerStore()
    // Hostile carried save: committed hidden_spell_pathway (the
    // sealed-offer way) - way_out_of_scope per unsupportedReleaseReason.
    player.$patch({
      realmId: 'foundation_establishment',
      cultivationPath: 'spell',
      cultivationWay: 'hidden_spell_pathway',
    })
    const html = await renderToString(app)
    // getCultivateTexture's override map has no beta-way gate; the
    // static variant paints the hidden-way PNG on live surfaces
    // (DongFuScene cultivate pose, RealmPanel figure).
    expect(html).not.toContain('phap-tu-an')
  })

  it('resolver feed: hidden-way override reaches MainScene/TribulationScene', () => {
    // Domain-level evidence for the same leak class on the Phaser
    // surfaces SSR cannot mount: PhaserCanvas writes raw
    // player.cultivationWay into the 'playerCultivationWay' gate;
    // MainScene.ts:336 and TribulationScene.ts:128 feed it to
    // getCultivateTexture with no beta-way admission check.
    const texture = getCultivateTexture(PLAYER_VISUAL_PROFILES.mortal, 'hidden_spell_pathway')
    expect(texture.key).toContain('phap-tu-an')
  })

  it('observed (Low): character-panel aura tints from a dormant way element', async () => {
    const gameManager = realGameManager()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createSSRApp(CharacterPanel)
    app.use(i18n)
    app.use(pinia)
    app.directive('tooltip', ssrTooltip)
    app.provide(GAME_MANAGER_KEY, gameManager)
    app.provide(STATE_VERSION_KEY, ref(0))
    app.provide(BUMP_STATE_KEY, () => {})

    const player = usePlayerStore()
    player.$patch({
      realmId: 'foundation_establishment',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
    })
    const html = await renderToString(app)
    // chosenKit drives --aura from the way's fixed element (metal) with
    // no beta-way gate - a subtle dormant cue, no branding text.
    // Documented as a deferred Low surface, not a blocking defect.
    expect(html).toContain('--el-metal')
  })
})
