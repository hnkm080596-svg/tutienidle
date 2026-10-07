import { messages } from './combatoutcomedesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CombatOutcomeDesignPreview from './CombatOutcomeDesignPreview.vue'

createApp(CombatOutcomeDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')
