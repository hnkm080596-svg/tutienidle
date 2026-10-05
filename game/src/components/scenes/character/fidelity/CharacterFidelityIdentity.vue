<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { symbolUrl } from '../../dong-fu/fidelity/dongFuUi'
import type { CharacterUiModel } from './characterUi'
defineProps<{ model: CharacterUiModel }>()
const { t } = useI18n()
</script>
<template>
  <header class="cf-identity">
    <h1 class="cf-name">{{ model.name }}<span class="cf-seal" aria-hidden="true">◆</span></h1>
    <p class="cf-realm">{{ model.realm }}</p>
    <p class="cf-path"><img :src="symbolUrl('technique')" alt="">{{ t('character.path') }}: {{ model.path }}</p>
    <p v-if="model.pathVerse" class="cf-path-verse">{{ model.pathVerse }}</p>
    <div class="cf-power"><small>{{ t('character.power') }}</small><strong>{{ model.combatPower }}</strong></div>
  </header>
</template>
<style scoped>
.cf-identity { position: absolute; left: 215px; top: 178px; width: 225px; z-index: 4; color: #27251b; }
.cf-name { margin: 0; font-size: 39px; font-style: italic; font-weight: 700; line-height: 1.2; white-space: nowrap; }
.cf-seal { display: inline-grid; place-items: center; vertical-align: middle; background: #a53b2f; color: #f4dfb9; font-size: 13px; width: 19px; height: 32px; margin-left: 10px; border-radius: 3px; box-shadow: inset 0 0 0 2px #eed7a94d; }
.cf-realm { font-size: 16px; margin: 10px 0 15px; padding-bottom: 12px; border-bottom: 1px solid #a08a5570; }
.cf-path { display: flex; gap: 9px; align-items: center; font-size: 14px; margin: 0 0 34px; }
.cf-path img { width: 21px; height: 21px; }
.cf-path-verse { margin: -26px 0 30px 30px; font-size: 11px; letter-spacing: 0.5px; color: #8a5a3a; }
.cf-power { display: grid; gap: 5px; padding: 0; }
.cf-power small { font-size: 15px; color: #746044; }
.cf-power strong { font-size: 37px; font-weight: 500; line-height: 44px; color: #4b3420; font-variant-numeric: tabular-nums; }
</style>
