<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CharacterUiModel } from './characterUi'
defineProps<{ model: CharacterUiModel; open: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
</script>
<template>
  <aside class="cf-details" :class="{ 'is-closed': !open }">
    <button class="cf-details__heading" :aria-label="t(open ? 'character.close' : 'character.open')" :aria-expanded="open" @click="emit('toggle')"><span>{{ t('character.details') }}</span><span aria-hidden="true">{{ open ? '×' : '‹' }}</span></button>
    <div v-show="open" class="cf-details__body">
      <section v-for="group in (['combat', 'other'] as const)" :key="group" class="cf-details__section">
        <h3>{{ t(`character.${group}`) }}</h3>
        <dl><div v-for="row in model[group]" :key="row.id" class="cf-detail-row" :title="row.description"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
      </section>
    </div>
  </aside>
</template>
<style scoped>
.cf-details { position: absolute; left: 1160px; top: 174px; width: 252px; height: 540px; padding: 0 23px; border-left: 1px solid #96815260; z-index: 5; color: #30291d; }.cf-details.is-closed { height: 48px; }
.cf-details__heading { position: relative; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 0 11px; background: none; border: 0; border-bottom: 1px solid #8d754c80; color: #4b3822; cursor: pointer; font-size: 22px; line-height: 25px; }
.cf-details__body { position: relative; height: 475px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #7f714c transparent; }
.cf-details__section h3 { font-size: 14px; color: #745730; margin: 16px 0 6px; font-weight: 600; }.cf-details__section dl { margin: 0; }
.cf-detail-row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 0; border-bottom: 1px solid #96815230; font-size: 12px; line-height: 16px; }.cf-detail-row dt { color: #5c513b; }.cf-detail-row dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; color: #30291d; }
</style>
