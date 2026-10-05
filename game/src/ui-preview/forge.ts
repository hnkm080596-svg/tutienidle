import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import {createApp} from 'vue'
import {createI18n} from 'vue-i18n'
import ForgePreview from './ForgePreview.vue'
import {forgeMessages} from './forgeMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(ForgePreview).use(createI18n({legacy:false,locale:'vi',messages:forgeMessages})).mount('#app')
