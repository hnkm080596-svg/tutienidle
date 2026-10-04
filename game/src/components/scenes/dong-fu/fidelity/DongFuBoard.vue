<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { symbolUrl, type DongFuUiOpportunity } from './dongFuUi'
defineProps<{ entries: readonly DongFuUiOpportunity[]; open: boolean }>()
const emit = defineEmits<{ action: [id: string]; toggle: [] }>()
const { t } = useI18n()
</script>
<template>
  <aside class="df-board" :class="{ 'is-collapsed': !open }">
    <InkNineSlice chrome-id="surface-l-drawer" layer="surface" />
    <button class="df-board__heading" :aria-label="t(open ? 'home.thienCo.collapse' : 'home.thienCo.expand')" :aria-expanded="open" @click="emit('toggle')"><span>{{ t('home.thienCo.title') }}</span><span class="df-board__chevron" aria-hidden="true">{{ open ? '‹' : '›' }}</span></button>
    <div v-show="open" class="df-board__entries">
      <p v-if="!entries.length" class="df-board__empty">{{ t('home.thienCo.empty') }}</p>
      <article v-for="entry in entries" :key="entry.id" class="df-board__entry">
        <span class="df-board__icon"><img :src="symbolUrl(entry.symbol)" alt=""></span>
        <div class="df-board__copy"><strong>{{ t(entry.labelKey, entry.labelParams ?? {}) }}</strong><small>{{ t(entry.detailKey, entry.detailParams ?? {}) }}</small></div>
        <button class="df-board__go" @click="emit('action', entry.id)">{{ t(entry.ctaKey ?? 'dongFu.view') }}</button>
      </article>
    </div>
  </aside>
</template>
<style scoped>
.df-board { position: absolute; isolation: isolate; z-index: 5; right: 10px; top: 75px; width: 314px; min-height: 68px; max-height: 375px; padding: 13px 23px 24px; }
/* wave B chrome: surface-l-drawer paints the dark card; content sits
   above the slice. */
.df-board > :not(.ink-nine-slice) { position: relative; z-index: 2; }
.df-board.is-collapsed { height: 68px; }
.df-board__heading { position: relative; width: 100%; background: transparent; border: 0; border-bottom: 1px solid #c9a66a80; color: var(--df-gold-light); font-size: 25px; font-style: italic; line-height: 36px; cursor: pointer; padding: 0 12px 6px; text-align: left; }
.df-board__chevron { position: absolute; right: 0; font-style: normal; }
.df-board__entries { position: relative; }
.df-board__empty { font-size: 13px; color: #c4c4ad; padding: 12px 4px; margin: 0; }
.df-board__entry { display: flex; align-items: center; gap: 9px; min-height: 58px; border-bottom: 1px solid #8f784444; }
.df-board__entry:last-child { border-bottom: 0; }
.df-board__icon { flex: 0 0 42px; height: 42px; border: 1px solid #bda363; box-shadow: inset 0 0 0 2px #142824; background: radial-gradient(circle,#30656a,#081918); display: grid; place-items: center; }
.df-board__icon img { width: 31px; height: 31px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg) drop-shadow(0 0 3px #a4e7dc); }
.df-board__entry:nth-child(2) .df-board__icon { background: radial-gradient(circle,#9f6026,#201908); }
.df-board__entry:nth-child(3) .df-board__icon { background: radial-gradient(circle,#6b5b2f,#201e11); }
.df-board__copy { flex: 1; min-width: 0; display: grid; gap: 3px; padding: 6px 0; }
.df-board__copy strong { font-size: 15px; line-height: 19px; font-weight: 500; color: #e1c98c; }
.df-board__copy small { font-size: 11px; line-height: 15px; color: #c4c4ad; }
/* 72px basis: 'Nang cap'/'Nhan thuong' no longer clip at the hexagon
   corners (the old 53px cut glyphs mid-stroke). */
.df-board__go { flex: 0 0 72px; height: 29px; border: 1px solid #8e6b32; color: #352414; background: linear-gradient(#ffecaf,#d6af60); clip-path: polygon(9% 0,91% 0,100% 50%,91% 100%,9% 100%,0 50%); cursor: pointer; font-size: 12px; white-space: nowrap; }
</style>
