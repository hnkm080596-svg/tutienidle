import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPreview from './ExplorationPreview.vue'
import { explorationMessages } from './explorationMessages'
import { vTooltip } from '@/directives/tooltip'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(ExplorationPreview)
  .directive('tooltip', vTooltip)
  .use(createI18n({ legacy: false, locale: 'vi', messages: explorationMessages }))
  .mount('#app')
