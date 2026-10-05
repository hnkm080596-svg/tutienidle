import { messages } from './characterprogressiondesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CharacterProgressionDesignPreview from './CharacterProgressionDesignPreview.vue'

createApp(CharacterProgressionDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')


