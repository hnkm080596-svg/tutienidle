import { installTienHiepUiAssets } from '@/presentation/assets/TienHiepUiAssets'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import EquipmentPreview from './EquipmentPreview.vue'
import { equipmentMessages } from './equipmentMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
import '@/assets/tien-hiep-ui.css'
import '@/assets/tien-hiep-secondary-ui.css'
installTienHiepUiAssets(document.documentElement)

createApp(EquipmentPreview).use(createPinia()).use(createI18n({ legacy: false, locale: 'vi', messages: equipmentMessages })).mount('#app')
