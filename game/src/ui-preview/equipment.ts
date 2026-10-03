import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import EquipmentPreview from './EquipmentPreview.vue'
import { equipmentMessages } from './equipmentMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(EquipmentPreview).use(createI18n({ legacy: false, locale: 'vi', messages: equipmentMessages })).mount('#app')
