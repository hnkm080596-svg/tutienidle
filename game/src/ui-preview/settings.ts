import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import SettingsPreview from './SettingsPreview.vue'
import {settingsMessages} from './settingsMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(SettingsPreview).use(createI18n({legacy:false,locale:'vi',messages:settingsMessages})).mount('#app')
