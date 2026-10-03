<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CombatFidelityPortrait from './CombatFidelityPortrait.vue'
import CombatFidelityMeter from './CombatFidelityMeter.vue'
import type { CombatDisplayPlayer } from './combatUi'
defineProps<{ player: CombatDisplayPlayer }>()
const { t } = useI18n()
</script>
<template>
  <section class="player-hud" :aria-label="t('playerHud')">
    <div class="avatar"><CombatFidelityPortrait :image="player.portrait" /></div>
    <div class="player-info"><h2 class="player-name">{{ player.name }}</h2><p class="level">{{ player.level }}</p><div class="bars"><CombatFidelityMeter v-for="bar in player.bars" :key="bar.id" v-bind="bar" /></div></div>
    <div class="effects" :aria-label="t('effects')"><span v-for="effect in player.effects" :key="effect.id" class="effect" tabindex="0" :aria-label="effect.label"><img :src="effect.icon" alt=""><span class="effect-tooltip">{{ effect.label }}</span></span></div>
    <div class="pips" :aria-label="t('pipsValue', { n: player.pips, total: player.pipTotal })"><span class="pip-label">{{ t('pips') }}</span><i v-for="pip in player.pipTotal" :key="pip" :class="['pip', { filled: pip <= player.pips }]" /></div>
  </section>
</template>
<style scoped>
.player-hud { position:absolute; left:20px; top:16px; width:362px; height:170px; background:radial-gradient(ellipse at 35% 40%,#08120fe8,transparent 73%); }.avatar { position:absolute; left:0; top:0; width:116px; height:116px; z-index:1; }.player-info { position:absolute; left:105px; right:2px; top:14px; }.player-name { margin:0; padding:0 12px 3px; font-size:25px; font-weight:500; color:#fff0bf; text-shadow:0 2px 4px #000; }.level { margin:0 0 6px 12px; font-size:12px; color:#d2b565; text-shadow:0 1px 3px #000; }.bars { display:grid; gap:4px; }.effects { position:absolute; left:119px; top:113px; display:flex; gap:7px; pointer-events:auto; }.effect { position:relative; width:26px; height:26px; border:1px solid #ab935b; background:#142d26; border-radius:3px; }.effect img { width:100%; height:100%; object-fit:cover; border-radius:2px; }.effect-tooltip { display:none; position:absolute; top:32px; left:0; padding:7px 10px; white-space:nowrap; background:#0d1919f5; border:1px solid #b49c62; color:#eee2bd; font-size:12px; z-index:5; }.effect:hover .effect-tooltip,.effect:focus-visible .effect-tooltip { display:block; }.effect:focus-visible { outline:2px solid #f2d58f; }.pips { position:absolute; left:30px; top:147px; display:flex; align-items:center; gap:7px; }.pip-label { margin-right:3px; color:#d8c18a; font-size:12px; }.pip { width:9px; height:9px; background:#162523; border:1px solid #98824c; transform:rotate(45deg); }.pip.filled { background:#dcba66; box-shadow:0 0 7px #dbba6380; }
</style>
