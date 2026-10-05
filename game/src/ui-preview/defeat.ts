import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import DefeatPreview from './DefeatPreview.vue'
import {remainingMessages} from './remainingMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(DefeatPreview).use(createI18n({legacy:false,locale:'vi',messages:remainingMessages})).mount('#app')
