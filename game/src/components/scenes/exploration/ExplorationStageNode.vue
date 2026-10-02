<script setup lang="ts">
// Scene 09 scaffold - one stage seal on a chapter band's trail. All
// state/enemy/lock data comes from the canonical StageSurfaceModel
// (frontend-contract sec.7 DO-NOT-DERIVE) - the node never recomputes.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Stage } from '@/core/stage/Stage'
import type { StageSurfaceModel } from '@/core/game/GameManagerStageOps'
import type { StageTrailPoint } from '@/components/panels/stageTrailLayout'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'

const props = defineProps<{
  stage: Stage
  model: StageSurfaceModel | undefined
  point: StageTrailPoint | undefined
  selected: boolean
  isLast: boolean
  bossSealUrl: string | null
  tooltipText?: string
}>()

const emit = defineEmits<{
  (e: 'select', stageId: string): void
}>()

const { t } = useI18n()

const floor = computed(() => props.stage.floor ?? props.stage.requiredRealmLevel ?? 1)
const locked = computed(() => props.model?.state === 'locked')
</script>

<template>
  <button
    type="button"
    class="stage-map__node art-needed"
    data-art-id="exploration-stage-node"
    :data-testid="`stage-node-${props.stage.id}`"
    :class="{
      'is-selected': props.selected,
      'is-locked': locked,
      'is-final': props.isLast,
      'is-boss': props.model?.isBossFloor,
      'is-current': props.model?.state === 'current',
      'is-cleared': props.model?.state === 'completed' || props.model?.state === 'perfect',
      'is-perfect': props.model?.state === 'perfect',
    }"
    :style="{
      left: `${(props.point?.x ?? 0.5) * 100}%`,
      top: `${(props.point?.y ?? 0.5) * 100}%`,
    }"
    v-tooltip="props.tooltipText"
    @click="emit('select', props.stage.id)"
  >
    <span class="stage-map__number">{{ floor }}</span>
    <span class="stage-map__copy">
      <strong>{{ t('panels.stageSelect.labels.floorPrefix', { floor }) }}</strong>
      <small v-if="props.model?.displayEnemy">{{ props.model.displayEnemy.name }}</small>
    </span>
    <span v-if="props.model?.isBossFloor" class="stage-map__boss">
      <img v-if="props.bossSealUrl" class="stage-map__boss-seal" :src="props.bossSealUrl" alt="" aria-hidden="true" />
      {{ t('panels.stageSelect.labels.boss') }}
    </span>
    <span v-if="locked" class="stage-map__lock" aria-hidden="true"><HuyenKimSymbol name="lock" /></span>
  </button>
</template>

<style scoped>
/* Hit area = the number disc only. The 84px pill let a node's box
   swallow its neighbour's centre (~39px spacing), so elementFromPoint
   resolved to the next node; the copy hangs below the disc in the
   layout, painted but inside no hit box wider than the disc. */
.stage-map__node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--paper-text);
  cursor: pointer;
  text-align: center;
}

.stage-map__number {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--scene-portal-accent) 60%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--paper-50) 72%, var(--scene-portal-glow) 10%);
  box-shadow: 0 1px 6px rgba(60, 40, 10, 0.25);
  color: color-mix(in srgb, var(--scene-portal-accent) 60%, var(--brush-950) 40%);
  font: 700 var(--text-xs) var(--font-display);
}
/* Painted copy hangs centered under the disc; it overflows the 44px
   hit box horizontally, which keeps each node's centre inside its own
   border-box even when labels overlap a neighbour. */
.stage-map__copy {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.stage-map__copy strong { font-size: 10px; text-shadow: 0 1px 2px var(--paper-50); }
.stage-map__copy small { overflow: hidden; color: var(--paper-text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 2px var(--paper-50); }
/* Scene 10: boss stages wear the boss-seal badge art behind the label. */
.stage-map__boss {
  position: absolute;
  top: -2px;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--crimson);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.stage-map__boss-seal {
  width: 24px;
  height: auto;
  margin-bottom: 1px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
}

/* Chapter-end boss medallion (ref: fiery seal at the band's right end). */
.stage-map__node.is-boss {
  width: 54px;
  height: 54px;
}
.stage-map__node.is-boss .stage-map__number {
  width: 46px;
  height: 46px;
  border-color: var(--crimson);
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--crimson) 34%, var(--paper-50)), color-mix(in srgb, var(--crimson) 20%, var(--paper-100)));
  color: var(--crimson);
  font-size: var(--text-sm);
}

.stage-map__node:hover .stage-map__number {
  border-color: var(--scene-portal-glow);
  box-shadow: 0 0 10px -2px var(--scene-portal-glow);
}

.stage-map__node.is-selected .stage-map__number {
  border-color: var(--scene-portal-glow);
  background: color-mix(in srgb, var(--scene-portal-glow) 26%, var(--paper-50));
  box-shadow: 0 0 12px -1px var(--scene-portal-glow);
}

/* Read-model states: current floor breathes gold; cleared wears jade. */
.stage-map__node.is-current .stage-map__number {
  border-color: color-mix(in srgb, var(--hk-gold, #b99a55) 80%, var(--brush-950));
  box-shadow: 0 0 12px -2px color-mix(in srgb, var(--hk-gold, #b99a55) 70%, transparent);
}

.stage-map__node.is-cleared .stage-map__number {
  border-color: color-mix(in srgb, #315f55 75%, var(--brush-950));
  background: color-mix(in srgb, #315f55 22%, var(--paper-50));
  color: color-mix(in srgb, #315f55 80%, var(--brush-950));
}

.stage-map__node.is-perfect .stage-map__number {
  background: color-mix(in srgb, var(--hk-gold, #b99a55) 30%, var(--paper-50));
}

.stage-map__node.is-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Lock affordance on the floor tile itself - the 45% dim alone did not
   read as "locked" (ui-audit progression fix). */
.stage-map__lock {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: var(--text-sm);
  line-height: 1;
}

.stage-map__node.is-final:not(.is-boss):not(.is-selected) .stage-map__number {
  border-color: var(--crimson);
}
</style>
