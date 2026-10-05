import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createApp, ref } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/i18n'
import { GameManager } from '@/core/game/GameManager'
import { GAME_MANAGER_KEY, STATE_VERSION_KEY, BUMP_STATE_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { COMPANIONS } from '@/data/companion/Companions'
import { materials } from '@/data/materials/materials'
import { vTooltip } from '@/directives/tooltip'
import SecondaryPreview from './SecondaryPreview.vue'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/system-theme.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
import '@/assets/tien-hiep-auxiliary.css'

// An isolated authoring fixture: no session, save adapter, clock, or release-policy changes.
const pinia = createPinia()
const player = usePlayerStore(pinia)
player.name = 'Thanh Vân'
player.realmId = 'golden_core'
player.realmLevel = 12
player.cultivationPath = 'spell'
player.cultivationWay = 'spell_pathway'
player.artifact = { artifactId: 'ngu_hanh_chau', realmId: 'foundation_establishment', realmLevel: 12, experience: 320, grade: 'linh', selectedPath: 'attack' }
player.companions = COMPANIONS.slice(0, 3).map((definition, index) => ({ instanceId: `preview-${index}`, definitionId: definition.id, realmId: 'mortal', realmLevel: 6, exp: 20, constellationRank: index }))
const manager = new GameManager()
manager.catalogOps.registerMaterials(materials)
manager.setActivePlayer(player.$state)
useUiStore(pinia).standalonePanel = 'tran_phap'
const version = ref(0)
installTienHiepUiAssets(document.documentElement)

const app = createApp(SecondaryPreview)
app.use(pinia).use(i18n).directive('tooltip', vTooltip)
app.provide(GAME_MANAGER_KEY, manager)
app.provide(STATE_VERSION_KEY, version)
app.provide(BUMP_STATE_KEY, () => { version.value += 1 })
app.mount('#app')
