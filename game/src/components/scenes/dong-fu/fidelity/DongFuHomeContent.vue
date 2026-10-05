<script setup lang="ts">
// Dong Phu home surface (fidelity regions, no vista/canvas) - shared by
// the ui-dong-fu preview (fixture model) and the production DongFuStage
// (read-model adapter). Wheel/board open state is CONTROLLED: preview
// owns a local ref, production binds ui.isCommandWheelOpen. Emits bare
// ids; the host routes them to domain navigation/panels.
import { useI18n } from 'vue-i18n'
import DongFuHud from './DongFuHud.vue'
import DongFuWheel from './DongFuWheel.vue'
import DongFuBoard from './DongFuBoard.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import { symbolUrl, type DongFuUiModel } from './dongFuUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '@/assets/tien-hiep-entry.css'

withDefaults(defineProps<{
  model: DongFuUiModel
  notice: string
  selected: string | null
  wheelOpen: boolean
  boardOpen: boolean
  // True while a scene/panel overlay covers the home view - the board
  // + quest chip live in the scene's own stacking context, so they
  // otherwise paint THROUGH the overlay's transparent margins.
  occluded?: boolean
}>(), { occluded: false })
const emit = defineEmits<{
  action: [id: string]
  toggleWheel: []
  toggleBoard: []
  // Owner scope 2026-10-03: gate 1 - the plaque badge dot becomes a real
  // upgrade button when the model marks the building 'upgrade'. Emits
  // bare ids like 'action'; the host routes them to navigation.upgrade.
  upgrade: [id: string]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="df-buildings">
    <button
      v-for="building in model.buildings"
      :key="building.id"
      class="df-building"
      :data-df-building="building.id"
      :style="{ left: `${building.x}px`, top: `${building.y}px`, backgroundImage: `url(${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/landmark-v1.png')})` }"
      @click="emit('action', building.id)"
    >
      <img :src="symbolUrl(building.symbol)" alt="">
      <span>{{ t(building.labelKey) }}<small>{{ t('dongFu.buildingHint') }}</small></span>
      <span
        v-if="building.badge === 'upgrade'"
        role="button"
        tabindex="0"
        class="df-building__upgrade"
        :title="t('layout.functionOverlay.upgrade')"
        :aria-label="t('layout.functionOverlay.upgrade')"
        @click.stop="emit('upgrade', building.id)"
        @keydown.enter.stop="emit('upgrade', building.id)"
        @keydown.space.stop.prevent="emit('upgrade', building.id)"
      >↑</span>
      <i v-else-if="building.badge" class="df-building__dot" :class="`df-building__dot--${building.badge}`" aria-hidden="true" />
    </button>
  </div>
  <button
    class="df-cultivator"
    :aria-label="t('dongFu.toggleWheel')"
    :aria-expanded="wheelOpen"
    @click="emit('toggleWheel')"
  >
    <PlayerPortrait variant="cultivate" animation-mode="idle" height="100%" />
  </button>
  <DongFuWheel
    :actions="model.actions"
    :selected="selected"
    :open="wheelOpen"
    @action="emit('action', $event)"
  />
  <DongFuHud :model="model" @action="emit('action', $event)">
    <template #utilities-extra><slot name="utilities-extra" /></template>
  </DongFuHud>
  <DongFuBoard
    v-show="!occluded"
    :entries="model.opportunities"
    :open="boardOpen"
    @toggle="emit('toggleBoard')"
    @action="emit('action', $event)"
  />
  <div class="pc-home-location">
    <span>{{ t('dongFu.sceneTitle') }}</span>
    <small>{{ t('dongFu.sceneSubtitle') }}</small>
  </div>
  <button
    v-if="model.quest"
    v-show="!occluded"
    class="df-quest"
    data-hk-region="quest-tracker"
    :class="{ 'is-claimable': model.quest.claimable }"
    :aria-label="t('home.questTracker.aria', { name: model.quest.name })"
    @click="emit('action', 'quest')"
  >
    <img :src="symbolUrl('quest')" alt="">
    <span><strong>{{ model.quest.name }}</strong><small>{{ model.quest.detail }}</small></span>
    <b aria-hidden="true">›</b>
  </button>
  <div class="df-notice" role="status" aria-live="polite">{{ notice }}</div>
  <nav v-show="!occluded" class="df-navigation" :aria-label="t('dongFu.aria')">
    <button
      v-for="action in model.actions"
      :key="action.id"
      :data-df-navigation="action.id"
      :class="{ 'is-active': action.active || selected === action.id, 'is-unavailable': action.disabledReason }"
      :aria-disabled="Boolean(action.disabledReason)"
      :title="action.disabledReason ?? undefined"
      @click="emit('action', action.id)"
    >
      <img :src="symbolUrl(action.symbol)" alt="">
      <span>{{ t(action.labelKey) }}</span>
      <i v-if="action.badge" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.df-buildings { position: absolute; inset: 0; z-index: 2; transform: translate(calc(var(--df-x) * -3px),calc(var(--df-y) * -2px)); transition: transform 400ms ease-out; pointer-events: none; }
.df-building { position: absolute; display: flex; align-items: center; gap: 7px; height: 49px; min-width: 143px; max-width: 185px; border: 0; padding: 7px 13px; background: transparent; color: var(--df-ivory); cursor: pointer; pointer-events: auto; text-align: left; }
.df-building > img { position: relative; width: 21px; height: 26px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg); }
.df-building > span:not(.df-art-frame) { position: relative; font-size: 15px; line-height: 19px; white-space: nowrap; }
.df-building small { display: block; font-size: 10px; color: #c3bea5; line-height: 14px; }
.df-building__dot { position: absolute; top: 6px; right: 8px; width: 9px; height: 9px; border-radius: 50%; background: #ffd766; box-shadow: 0 0 6px #ffc94d; }
.df-building__dot--alert { background: #ff9d5c; box-shadow: 0 0 8px #ff7a3c; }
/* Upgrade affordance replaces the passive dot when the model marks the
   building 'upgrade': same gold family as the dot, enlarged into a
   tappable circle with an ink arrow (owner: "hien khi du dieu kien"
   - hidden entirely otherwise). */
.df-building__upgrade { position: absolute; top: 3px; right: 4px; width: 18px; height: 18px; padding: 0; border: 1px solid #f4d896; border-radius: 50%; background: radial-gradient(circle at 50% 38%, #ffe49a 0%, #e2b04a 62%, #b5832e 100%); color: #241a06; font-size: 12px; font-weight: 700; line-height: 16px; cursor: pointer; box-shadow: 0 0 7px #ffc94dcc, 0 1px 2px #0009; }
.df-building__upgrade:hover { filter: brightness(1.12); box-shadow: 0 0 10px #ffd97a, 0 1px 2px #0009; }
.df-building__upgrade:focus-visible { outline: 2px solid #ffe9b0; outline-offset: 1px; }
.df-cultivator { position: absolute; z-index: 2; left: 550px; top: 366px; width: 300px; height: 300px; padding: 0; background: none; border: 0; cursor: pointer; filter: drop-shadow(0 8px 7px #07101bcc); }
.df-cultivator img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.pc-home-location { position: absolute; left: 535px; bottom: 105px; width: 370px; text-align: center; display: grid; gap: 3px; text-shadow: 0 1px #fff1d2; }
.pc-home-location > span { font: 700 22px/28px var(--pc-font-body); color: #4c3821; }
.pc-home-location > small { font-size: 13px; color: #755f3b; }
.df-quest { position: absolute; bottom: 16px; right: 13px; width: 305px; height: 71px; border: 0; background: none; color: var(--df-ivory); display: flex; align-items: center; gap: 13px; padding: 14px 22px; cursor: pointer; text-align: left; }
.df-quest.is-claimable strong { color: #ffd98a; }
.df-quest > img { position: relative; width: 32px; height: 32px; filter: invert(87%) sepia(41%) saturate(480%) hue-rotate(350deg); }
.df-quest > span:not(.df-art-frame) { position: relative; flex: 1; display: grid; gap: 3px; }
.df-quest strong { font-size: 16px; font-weight: 500; color: var(--df-gold-light); }
.df-quest small { font-size: 11px; }.df-quest b { position: relative; font-size: 28px; font-weight: 400; }
.df-notice { position: absolute; top: 107px; left: 415px; width: 610px; height: 28px; text-align: center; font-size: 14px; color: #fff1ce; text-shadow: 0 1px 3px #000, 0 0 8px #000; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .df-buildings { transform: none; transition: none; } }
</style>
