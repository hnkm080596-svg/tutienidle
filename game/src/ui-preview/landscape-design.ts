import {productionArtMessages} from './productionArtMessages'
import {supportArtMessages} from './supportArtMessages'
import {questArtMessages} from './questArtMessages'
import { messages as mapMessages } from './designsystemMessages'
import {formationPreviewMessages} from './formationPreviewMessages'
import {alchemyPreviewMessages} from './alchemyPreviewMessages'
import {inventoryPreviewMessages} from './inventoryPreviewMessages'
import { realmPreviewMessages } from './realmPreviewMessages'
import { techniquePreviewMessages } from './techniquePreviewMessages'
import { skillMessages } from './skillMessages'
import { equipmentPreviewMessages } from './equipmentPreviewMessages'
import { bodyPreviewMessages } from './bodyPreviewMessages'
import { messages } from './landscapedesignMessages'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import LandscapeDesignPreview from './LandscapeDesignPreview.vue'

createApp(LandscapeDesignPreview).use(createI18n({ legacy: false, locale: 'vi', messages: { vi: { ...mapMessages.vi, ...messages.vi, ...skillMessages.vi, ...equipmentPreviewMessages.vi, ...bodyPreviewMessages.vi, ...techniquePreviewMessages.vi, ...realmPreviewMessages.vi, ...inventoryPreviewMessages.vi, ...alchemyPreviewMessages.vi, ...formationPreviewMessages.vi, ...questArtMessages.vi, ...supportArtMessages.vi, ...productionArtMessages.vi } } })).mount('#app')





