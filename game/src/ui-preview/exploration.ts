import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import ExplorationPreview from './ExplorationPreview.vue'
import { explorationMessages } from './explorationMessages'
import { vTooltip } from '@/directives/tooltip'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(ExplorationPreview)
  .directive('tooltip', vTooltip)
  .use(createI18n({ legacy: false, locale: 'vi', messages: explorationMessages }))
  .mount('#app')
