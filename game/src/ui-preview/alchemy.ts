import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import AlchemyPreview from './AlchemyPreview.vue'
import { alchemyMessages } from './alchemyMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(AlchemyPreview).use(createI18n({ legacy: false, locale: 'vi', messages: alchemyMessages })).mount('#app')
