import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import VictoryPreview from './VictoryPreview.vue'
import { victoryMessages } from './victoryMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(VictoryPreview).use(createI18n({legacy:false,locale:'vi',messages:victoryMessages})).mount('#app')
