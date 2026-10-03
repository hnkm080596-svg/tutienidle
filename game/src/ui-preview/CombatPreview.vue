<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { DEFAULT_THANH_VAN_VARIANT, thanhVanLoadList } from '@/presentation/background/ThanhVanBackdropArt'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import CombatFidelityScene from '@/components/scenes/combat/fidelity/CombatFidelityScene.vue'
import type { CombatDisplayModel } from '@/components/scenes/combat/fidelity/combatUi'
const { t } = useI18n()
const selectedStrategy = shallowRef('nearest')
const auto = shallowRef(true)
const paused = shallowRef(false)
const notice = shallowRef('')
const portrait = resolveAssetUrl('/assets/characters/animated/zuofeng/avatar/zuofeng-battle-status-avatar.png')
const wolf = resolveAssetUrl('/assets/enemies/animated/graymane-wolf/avatar.png')
const elite = resolveAssetUrl('/assets/enemies/animated/graymane-wolf-ferocious/avatar.png')
const attackIcon = resolveAssetUrl('/assets/skills/tram.png')
const skillIcon = resolveAssetUrl('/assets/skills/linh_bao.png')
// Static context only; the runtime background and parallax are not mounted or modified.
const existingLayers = thanhVanLoadList(DEFAULT_THANH_VAN_VARIANT)
const previewLayers = [0, 1, 2, 6, 3, 4, 5].map(index => existingLayers[index]!).map(layer => ({ key: layer.key, src: resolveAssetUrl(layer.url) }))
const strategyIds = ['nearest', 'boss_first', 'elite_first', 'lowest_hp', 'highest_hp'] as const
const model = computed<CombatDisplayModel>(() => ({
  zone: t('zone'), stage: t('stage'), round: t('round'),
  player: { name: t('player'), level: t('level'), portrait, bars: [
    { id: 'hp', label: t('hp'), value: '128.640 / 142.300', percent: 90 },
    { id: 'mana', label: t('mana'), value: '21.340 / 30.000', percent: 71, tone: 'mana' },
  ], effects: [{ id: 'guard', label: t('buff.guard'), icon: resolveAssetUrl('/assets/skills/tho_cau_thuat.png') }, { id: 'focus', label: t('buff.focus'), icon: skillIcon }, { id: 'strength', label: t('buff.strength'), icon: resolveAssetUrl('/assets/skills/huy_quyen.png') }], pips: 3, pipTotal: 5 },
  turns: [{ id: 'player', name: t('player'), portrait, side: 'player' }, { id: 'wolf-1', name: t('enemy'), portrait: wolf, side: 'enemy' }, { id: 'wolf-2', name: t('elite'), portrait: elite, side: 'enemy' }, { id: 'wolf-3', name: t('enemy'), portrait: wolf, side: 'enemy' }, { id: 'wolf-4', name: t('enemy'), portrait: wolf, side: 'enemy' }], currentTurn: 'player',
  enemies: [{ id: 'elite', name: t('elite'), x: 755, y: 286, bar: { id: 'elite-hp', label: t('hp'), value: '78.420 / 120.000', percent: 65 } }, { id: 'wolf-1', name: t('enemy'), x: 1065, y: 350, bar: { id: 'wolf-1-hp', label: t('hp'), value: '24.680 / 48.000', percent: 51 } }, { id: 'wolf-2', name: t('enemy'), x: 993, y: 522, bar: { id: 'wolf-2-hp', label: t('hp'), value: '13.280 / 48.000', percent: 28 } }],
  strategies: strategyIds.map(id => ({ id, label: t(`strategy.${id}`) })),
  skills: [{ id: 'attack', label: t('attack'), icon: attackIcon, motif: 'sword', hint: t('attackHint'), badge: '' }, { id: 'special', label: t('skill'), icon: skillIcon, motif: 'orb', hint: t('skillHint'), badge: '3' }],
}))
function chooseStrategy(id: string) { selectedStrategy.value = id; notice.value = t('selectedStrategy', { name: t(`strategy.${id}`) }) }
function toggleAuto() { auto.value = !auto.value; notice.value = t('notice') }
function togglePause() { paused.value = !paused.value; notice.value = t('notice') }
function back() { window.location.assign('/ui-exploration.html') }
</script>
<template><SceneDesignCanvas><div class="combat-preview"><div class="existing-art-context" aria-hidden="true"><img v-for="layer in previewLayers" :key="layer.key" :src="layer.src" alt="" draggable="false"></div><CombatFidelityScene :model="model" :selected-strategy="selectedStrategy" :auto="auto" :paused="paused" :notice="notice" @strategy="chooseStrategy" @auto="toggleAuto" @pause="togglePause" @skill="notice = t('notice')" @back="back" /></div></SceneDesignCanvas></template>
<style scoped>.combat-preview { position:relative; width:100%; height:100%; background:#172526; }.existing-art-context { position:absolute; inset:0; pointer-events:none; }.existing-art-context img { position:absolute; inset:0; width:100%; height:100%; object-fit:fill; }</style>
