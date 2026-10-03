<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CombatFidelityFrame from './CombatFidelityFrame.vue'
import CombatFidelityPlayer from './CombatFidelityPlayer.vue'
import CombatFidelityTurns from './CombatFidelityTurns.vue'
import CombatFidelityControls from './CombatFidelityControls.vue'
import CombatFidelityMeter from './CombatFidelityMeter.vue'
import type { CombatDisplayModel } from './combatUi'
defineProps<{ model: CombatDisplayModel; selectedStrategy: string; auto: boolean; paused: boolean; notice: string }>()
const emit = defineEmits<{ strategy: [id: string]; auto: []; pause: []; skill: [id: string]; back: [] }>()
const { t } = useI18n()
</script>
<template>
  <section class="combat-hud" :aria-label="t('title')">
    <CombatFidelityPlayer :player="model.player" />
    <CombatFidelityFrame class="stage-plaque" :border="24"><p class="zone-name">{{ model.zone }}</p><h1 class="stage-name">{{ model.stage }}</h1></CombatFidelityFrame>
    <p class="round">{{ model.round }}</p>
    <CombatFidelityTurns :turns="model.turns" :current="model.currentTurn" />
    <CombatFidelityControls :strategies="model.strategies" :selected-strategy="selectedStrategy" :auto="auto" :paused="paused" :skills="model.skills" @strategy="emit('strategy', $event)" @auto="emit('auto')" @pause="emit('pause')" @skill="emit('skill', $event)" @back="emit('back')" />
    <div v-for="enemy in model.enemies" :key="enemy.id" class="enemy-plate" :style="{ left: `${enemy.x}px`, top: `${enemy.y}px` }"><span class="enemy-name">{{ enemy.name }}</span><CombatFidelityMeter v-bind="enemy.bar" /></div>
    <div class="notice" role="status">{{ notice }}</div>
    <p class="preview-label">{{ t('preview') }}</p>
  </section>
</template>
<style scoped>
.combat-hud { position:absolute; inset:0; pointer-events:none; color:#efdba1; font-family:var(--font-display,Georgia,serif); line-height:1.3; }.combat-hud :deep(*) { box-sizing:border-box; }.stage-plaque { position:absolute; left:520px; top:12px; width:400px; height:68px; padding:11px 26px; text-align:center; }.zone-name { margin:0 0 3px; font-size:17px; color:#e4cf95; }.stage-name { margin:0; font-size:20px; font-weight:500; color:#fff1c6; }.round { position:absolute; top:78px; left:520px; width:400px; text-align:center; margin:0; font-size:13px; color:#ffedc4; text-shadow:0 1px 4px #000; }.enemy-plate { position:absolute; width:206px; padding:5px 9px 8px; background:linear-gradient(90deg,transparent,#0b1515bd 13%,#0b1515bd 87%,transparent); }.enemy-name { display:block; text-align:center; font-size:13px; color:#fff0ca; margin-bottom:4px; text-shadow:0 1px 3px #000; }.notice { position:absolute; left:420px; bottom:57px; width:600px; height:41px; padding:6px 12px; text-align:center; color:#fff0c3; font-size:14px; text-shadow:0 1px 4px #000,0 0 6px #000; }.preview-label { position:absolute; left:310px; right:310px; bottom:21px; margin:0; text-align:center; color:#eadbb8; font-size:11px; text-shadow:0 1px 4px #000; }
</style>
