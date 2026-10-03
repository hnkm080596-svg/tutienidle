import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import RealmPreview from './RealmPreview.vue'
import { realmMessages } from './realmMessages'
import '@/assets/theme.css'
import '@/assets/huyen-kim.tokens.css'
createApp(RealmPreview).use(createI18n({ legacy: false, locale: 'vi', messages: realmMessages })).mount('#app')
