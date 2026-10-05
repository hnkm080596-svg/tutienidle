import { messages } from './collectioncraftdesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import CollectionCraftDesignPreview from './CollectionCraftDesignPreview.vue'

createApp(CollectionCraftDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages })).mount('#app')
