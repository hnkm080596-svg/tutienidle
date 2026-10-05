import { messages } from './designsystemMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import DesignSystemPreview from './DesignSystemPreview.vue'

createApp(DesignSystemPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')


