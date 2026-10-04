import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CharacterPreview from './CharacterPreview.vue'
import { characterMessages } from './characterMessages'
import { vTooltip } from '@/directives/tooltip'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(CharacterPreview)
  .use(createI18n({ legacy: false, locale: 'vi', messages: characterMessages }))
  .directive('tooltip', vTooltip)
  .mount('#app')
