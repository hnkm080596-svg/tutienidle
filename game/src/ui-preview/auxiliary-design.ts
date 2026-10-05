import { messages } from './auxiliarydesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import AuxiliaryDesignPreview from './AuxiliaryDesignPreview.vue'

createApp(AuxiliaryDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')
