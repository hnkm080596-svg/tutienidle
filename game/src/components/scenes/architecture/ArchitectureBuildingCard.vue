<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import type { ArchitectureBuildingModel } from '@/core/game/ArchitectureReadModel'

defineProps<{ model: ArchitectureBuildingModel; artUrl: string }>()
const emit = defineEmits<{ details: []; upgrade: [] }>()
const { t, locale } = useI18n()

function effectValue(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(value)
  if (unit === 'percent') return `${formatted}%`
  if (unit === 'multiplier') return `×${formatted}`
  if (unit === 'perMinute') return `${formatted}/${t('architecture.minuteShort')}`
  return formatted
}
</script>

<template>
  <article class="architecture-card" data-testid="architecture-building-card" :data-building-id="model.id">
    <header class="architecture-card__heading">
      <img class="architecture-card__art" :src="artUrl" :alt="''" @error="($event.target as HTMLImageElement).hidden = true">
      <div class="architecture-card__identity">
        <h2>{{ model.name }}</h2>
        <p>{{ model.description }}</p>
      </div>
      <span class="architecture-card__level">{{ t('architecture.level', { level: model.level, max: model.maxLevel }) }}</span>
    </header>

    <div class="architecture-card__effects">
      <section>
        <h3>{{ t('architecture.current') }}</h3>
        <ul v-if="model.currentEffects.length">
          <li v-for="effect in model.currentEffects" :key="effect.key">
            <span>{{ t(`architecture.effects.${effect.key}`) }}</span><strong>{{ effectValue(effect.value, effect.unit) }}</strong>
          </li>
        </ul>
        <p v-else class="architecture-card__quiet">{{ t('architecture.noEffect') }}</p>
      </section>
      <section v-if="!model.maxed && model.nextEffects.length">
        <h3>{{ t('architecture.next') }}</h3>
        <ul>
          <li v-for="effect in model.nextEffects" :key="effect.key">
            <span>{{ t(`architecture.effects.${effect.key}`) }}</span><strong>{{ effectValue(effect.value, effect.unit) }}</strong>
          </li>
        </ul>
      </section>
    </div>

    <ul v-if="model.costs.length" class="architecture-card__costs" :aria-label="t('architecture.costs')">
      <li v-for="cost in model.costs" :key="cost.id" :class="{ 'is-missing': cost.owned < cost.required }">
        <img v-if="cost.icon" :src="cost.icon" alt="" @error="($event.target as HTMLImageElement).hidden = true">
        <span>{{ cost.name || t('architecture.unknownMaterial') }}</span>
        <strong>{{ t('architecture.costAmount', { owned: cost.owned, required: cost.required }) }}</strong>
      </li>
    </ul>
    <p v-else class="architecture-card__state">{{ t(model.artOnly ? 'architecture.artOnlyBrief' : 'architecture.maximum') }}</p>

    <footer class="architecture-card__actions">
      <PcPaperButton variant="secondary" :data-testid="'architecture-details'" @click="emit('details')">{{ t('architecture.details') }}</PcPaperButton>
      <PcPaperButton v-if="!model.maxed" data-testid="architecture-building-upgrade" @click="emit('upgrade')">{{ t('architecture.upgrade') }}</PcPaperButton>
      <span v-else-if="!model.artOnly" class="architecture-card__maximum">{{ t('architecture.maximum') }}</span>
    </footer>
  </article>
</template>

<style scoped>
.architecture-card { min-width:0; min-height:0; display:grid; grid-template-rows:auto 1fr auto auto; gap:8px; padding:13px 15px 11px; border:1px solid #a78345; border-radius:5px; background:linear-gradient(135deg,#fff8e8e8,#ead8b4d9); box-shadow:inset 0 0 0 3px #c9a66538,0 3px 9px #5d421426; color:#382a17; }
.architecture-card__heading { display:grid; grid-template-columns:82px minmax(0,1fr) auto; align-items:center; gap:12px; min-height:82px; }
.architecture-card__art { width:82px; height:82px; object-fit:cover; border:2px solid #a9813e; border-radius:4px; background:#b3976680; box-shadow:0 2px 6px #45321955; }
.architecture-card__identity { min-width:0; }
.architecture-card__identity h2 { margin:0 0 5px; font:700 22px/1.15 var(--pc-font-title); color:#302315; }
.architecture-card__identity p { display:-webkit-box; margin:0; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; font-size:13px; line-height:1.35; color:#715d3b; }
.architecture-card__level { align-self:start; padding:5px 9px; border:1px solid #9b7636; border-radius:15px; background:#362915; color:#f4dfad; white-space:nowrap; font-size:12px; font-weight:700; }
.architecture-card__effects { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; min-height:68px; }
.architecture-card__effects section { min-width:0; padding:6px 8px; border-top:1px solid #b18d4d88; background:#fff8e166; }
.architecture-card__effects h3 { margin:0 0 4px; font:700 12px/1.2 var(--pc-font-body); color:#745323; }
.architecture-card__effects ul,.architecture-card__costs { list-style:none; margin:0; padding:0; }
.architecture-card__effects li { display:flex; justify-content:space-between; gap:6px; font-size:12px; line-height:1.4; }
.architecture-card__effects li strong { color:#35533e; white-space:nowrap; }
.architecture-card__quiet { margin:0; color:#746342; font-size:12px; }
.architecture-card__costs { display:flex; align-items:center; gap:10px; min-height:32px; overflow:hidden; }
.architecture-card__costs li { display:grid; grid-template-columns:22px minmax(0,1fr); align-items:center; gap:1px 5px; min-width:0; padding-right:9px; border-right:1px solid #a7854e55; font-size:10px; color:#685635; }
.architecture-card__costs li:last-child { border-right:0; }
.architecture-card__costs img { grid-row:span 2; width:22px; height:22px; object-fit:contain; }
.architecture-card__costs span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.architecture-card__costs strong { color:#382b18; font-size:11px; white-space:nowrap; }
.architecture-card__costs .is-missing strong { color:#9b3023; }
.architecture-card__state,.architecture-card__maximum { margin:0; color:#6f572e; font-size:12px; font-weight:700; }
.architecture-card__actions { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.architecture-card__actions :deep(.pc-paper-button) { min-height:38px; padding:6px 16px; font-size:15px; }
.architecture-card__actions :deep(.pc-paper-button--secondary) { color:#f4e4c0; text-shadow:0 1px #17140e; }
.architecture-card__maximum { margin-left:auto; }
@media (max-width:740px) { .architecture-card__heading { grid-template-columns:64px minmax(0,1fr) auto; gap:8px; } .architecture-card__art { width:64px;height:64px; } .architecture-card__identity h2 { font-size:18px; } }
</style>
