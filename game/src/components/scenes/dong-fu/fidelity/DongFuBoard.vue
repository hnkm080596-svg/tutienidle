<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { symbolUrl, type DongFuUiOpportunity } from './dongFuUi'

export interface DongFuBoardQuestCard {
  name: string
  detail: string
  claimable: boolean
  percent: number
}

defineProps<{
  entries: readonly DongFuUiOpportunity[]
  open: boolean
  quest?: DongFuBoardQuestCard | null
}>()

const emit = defineEmits<{
  action: [id: string]
  toggle: []
  questClick: []
}>()

const { t } = useI18n()
</script>
<template>
  <aside class="df-board" :class="{ 'is-collapsed': !open }" data-df-ui>
    <InkNineSlice chrome-id="surface-l-drawer" layer="surface" />
    <button class="df-board__heading" :aria-label="t(open ? 'home.thienCo.collapse' : 'home.thienCo.expand')" :aria-expanded="open" @click="emit('toggle')"><span>{{ t('home.thienCo.title') }}</span><span class="df-board__chevron" aria-hidden="true">{{ open ? '‹' : '›' }}</span></button>
    <div v-show="open" class="df-board__body">
      <button
        v-if="quest"
        type="button"
        class="df-board__quest home-design-quest"
        :class="{ 'is-claimable': quest.claimable }"
        :aria-label="t('home.questTracker.aria', { name: quest.name })"
        @click="emit('questClick')"
      >
        <div class="df-board__quest-head">
          <span class="df-board__quest-tag">{{ t('dongFu.nav.quest') }}</span>
          <span class="df-board__quest-progress-text">{{ quest.detail }} ›</span>
        </div>
        <p class="df-board__quest-name">{{ quest.name }}</p>
        <div class="df-board__quest-bar"><i :style="{ width: `${quest.percent}%` }" /></div>
      </button>
      <div class="df-board__entries">
        <p v-if="!entries.length" class="df-board__empty">{{ t('home.thienCo.empty') }}</p>
        <article v-for="entry in entries" :key="entry.id" class="df-board__entry">
          <span class="df-board__icon"><img :src="symbolUrl(entry.symbol)" alt=""></span>
          <div class="df-board__copy"><strong>{{ t(entry.labelKey, entry.labelParams ?? {}) }}</strong><small>{{ t(entry.detailKey, entry.detailParams ?? {}) }}</small></div>
          <button class="df-board__go" @click="emit('action', entry.id)">{{ t(entry.ctaKey ?? 'dongFu.view') }}</button>
        </article>
      </div>
    </div>
  </aside>
</template>
<style scoped>
.df-board { position: absolute; isolation: isolate; z-index: 5; right: 10px; top: 75px; width: 314px; min-height: 68px; max-height: 455px; padding: 13px 20px 20px; }
/* wave B chrome: surface-l-drawer paints the dark card; content sits
   above the slice. */
.df-board > :not(.ink-nine-slice) { position: relative; z-index: 2; }
.df-board.is-collapsed { height: 68px; }
.df-board__heading { position: relative; width: 100%; background: transparent; border: 0; border-bottom: 1px solid #c9a66a80; color: var(--df-gold-light); font-size: 22px; font-style: italic; line-height: 34px; cursor: pointer; padding: 0 12px 6px; text-align: left; }
.df-board__chevron { position: absolute; right: 0; font-style: normal; }
.df-board__body { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.df-board__quest { width: 100%; padding: 9px 11px 10px; border: 1px solid #b58d43; background: linear-gradient(180deg, rgba(56, 44, 24, 0.92), rgba(32, 26, 15, 0.92)); color: #f1e6c5; font-family: inherit; text-align: left; cursor: pointer; transition: filter 140ms ease, box-shadow 140ms ease; }
.df-board__quest:hover { filter: brightness(1.08); }
.df-board__quest.is-claimable { border-color: #f3cc68; box-shadow: 0 0 12px rgba(217, 169, 63, 0.55); }
.df-board__quest-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #d9b66c; margin-bottom: 4px; }
.df-board__quest-tag { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.df-board__quest-progress-text { color: #e8d8b0; font-weight: 600; }
.df-board__quest-name { margin: 0 0 7px; font-size: 14px; font-weight: 600; color: #fff2ce; line-height: 1.3; }
.df-board__quest-bar { width: 100%; height: 6px; background: #1c1912; border: 1px solid #8f6d31; border-radius: 6px; overflow: hidden; }
.df-board__quest-bar i { display: block; height: 100%; background: linear-gradient(90deg, #c8963e, #f2ce74); }
.df-board__entries { position: relative; max-height: 270px; overflow-y: auto; scrollbar-width: thin; }
.df-board__empty { font-size: 13px; color: #c4c4ad; padding: 10px 4px; margin: 0; }
.df-board__entry { display: flex; align-items: center; gap: 9px; min-height: 54px; border-bottom: 1px solid #8f784444; }
.df-board__entry:last-child { border-bottom: 0; }
.df-board__icon { flex: 0 0 38px; height: 38px; border: 1px solid #bda363; box-shadow: inset 0 0 0 2px #142824; background: radial-gradient(circle,#30656a,#081918); display: grid; place-items: center; }
.df-board__icon img { width: 28px; height: 28px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg) drop-shadow(0 0 3px #a4e7dc); }
.df-board__entry:nth-child(2) .df-board__icon { background: radial-gradient(circle,#9f6026,#201908); }
.df-board__entry:nth-child(3) .df-board__icon { background: radial-gradient(circle,#6b5b2f,#201e11); }
.df-board__copy { flex: 1; min-width: 0; display: grid; gap: 2px; padding: 5px 0; }
.df-board__copy strong { font-size: 14px; line-height: 18px; font-weight: 500; color: #e1c98c; }
.df-board__copy small { font-size: 11px; line-height: 14px; color: #c4c4ad; }
/* 72px basis: 'Nang cap'/'Nhan thuong' no longer clip at the hexagon
   corners (the old 53px cut glyphs mid-stroke). */
.df-board__go { flex: 0 0 72px; height: 28px; border: 1px solid #8e6b32; color: #352414; background: linear-gradient(#ffecaf,#d6af60); clip-path: polygon(9% 0,91% 0,100% 50%,91% 100%,9% 100%,0 50%); cursor: pointer; font-size: 12px; white-space: nowrap; }
</style>
