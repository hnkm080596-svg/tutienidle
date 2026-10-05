import { messages } from './designreviewMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import DesignReviewIndex from './DesignReviewIndex.vue'
createApp(DesignReviewIndex).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')
