import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CharacterPreview from './CharacterPreview.vue'
import { characterMessages } from './characterMessages'
import { vTooltip } from '@/directives/tooltip'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(CharacterPreview).use(createPinia())
  .use(createI18n({ legacy: false, locale: 'vi', messages: characterMessages }))
  .directive('tooltip', vTooltip)
  .mount('#app')
