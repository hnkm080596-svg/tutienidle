<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useCombatPlayerVitals } from '@/composables/useCombatPlayerVitals'
import { formatNumber } from '@/core/format/NumberFormatter'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import CombatArtSurface from './CombatArtSurface.vue'
defineProps<{ expanded?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const { entity, hpPercent, isBattleInProgress } = useCombatPlayerVitals()
const fill = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/health-fill-v1.png')
const expandArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/combat/expand-button-v1.png')
</script>
<template>
  <CombatArtSurface v-if="isBattleInProgress && entity" art="hp-caption" class="combat-health-hud">
    <div class="combat-health-hud__meter" role="progressbar" :aria-label="t('combat.overlay.playerCard.hp')" :aria-valuenow="hpPercent" aria-valuemin="0" aria-valuemax="100">
      <div class="combat-health-hud__fill-clip" :style="{ clipPath: `inset(0 ${100-hpPercent}% 0 0)` }"><img :src="fill" alt="" /></div>
      <span>{{ t('combat.overlay.playerCard.hp') }} {{ formatNumber(Math.max(0, Math.ceil(entity.currentHp))) }} / {{ formatNumber(Math.ceil(entity.maxHp)) }}</span>
    </div>
    <p class="combat-health-hud__caption">{{ t('combat.overlay.healthHud.caption') }}</p>
    <button type="button" class="combat-health-hud__expand" :aria-expanded="expanded ?? false" :aria-label="t(expanded ? 'combat.overlay.healthHud.hideLog' : 'combat.overlay.healthHud.showLog')" @click="emit('toggle')"><img :src="expandArt" alt="" aria-hidden="true"><span aria-hidden="true">{{ expanded ? '⌄' : '⌃' }}</span></button>
  </CombatArtSurface>
</template>
<style scoped>
.combat-health-hud { position: absolute; left: 450px; bottom: 14px; width: 540px; height: 131px; pointer-events: none; }
.combat-health-hud__meter { position: absolute; left: 116px; right: 45px; top: 45px; height: 22px; background: #170b0ae0; border: 1px solid #bf9748; }
.combat-health-hud__fill-clip { position: absolute; inset: 0; }
.combat-health-hud__fill-clip img { width: 100%; height: 100%; }
.combat-health-hud__meter > span { position: relative; display: block; text-align: center; color: #fff1d0; font: 700 15px/20px var(--font-display); text-shadow: 0 1px 2px #000; }
.combat-health-hud__caption { position: absolute; top: 77px; left: 120px; right: 40px; margin: 0; text-align: center; font: italic 15px/1.3 var(--font-display); color: #e4c573; }
.combat-health-hud__expand { position: absolute; left: 50%; top: 110px; transform: translateX(-50%); width: 40px; height: 40px; padding: 0; border: 0; background: transparent; pointer-events: auto; cursor: pointer; color: #f3d58a; }
.combat-health-hud__expand img { position: absolute; inset: 0; width: 100%; height: 100%; clip-path: circle(44%); }
.combat-health-hud__expand span { position: relative; font-size: 26px; }
.combat-health-hud__expand:focus-visible { outline: 2px solid #f3d58a; outline-offset: 2px; }
</style>
