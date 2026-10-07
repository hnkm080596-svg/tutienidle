import { messages } from './systemdesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import SystemDesignPreview from './SystemDesignPreview.vue'

createApp(SystemDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')
