<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { createMaterialTooltipBuilder } from '@/composables/useMaterialTooltip'
import GameCard from '@/components/common/GameCard.vue'
import GameActionButton from '@/components/common/GameActionButton.vue'
import SlotView from '@/components/common/SlotView.vue'
import type { TechniqueUiModel } from './techniqueUi'
defineProps<{ model: TechniqueUiModel; notice: string }>()
const emit = defineEmits<{ advance: [] }>()
const { t } = useI18n()
const gameManager = inject(GAME_MANAGER_KEY, null)
const defaultCrystalIcon = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png')
const buildMaterialTooltip = createMaterialTooltipBuilder(t)

function materialTooltip(materialId: string | undefined, owned: number | undefined) {
  if (!materialId) return undefined
  try {
    const material = gameManager?.materialRegistry?.get?.(materialId)
    return material ? buildMaterialTooltip(material, { owned: owned ?? 0 }) : undefined
  } catch {
    return undefined
  }
}
</script>
<template>
  <GameCard as="aside" class="technique-upgrade">
    <div class="technique-compare">
      <strong>{{ model.currentGrade }}</strong>
      <span aria-hidden="true">›</span>
      <strong>{{ model.nextGrade }}</strong>
    </div>
    <h3>{{ t('technique.materials') }}</h3>
    <div
      v-tooltip="materialTooltip(model.material.id, model.material.have)"
      class="technique-material"
      :class="{ 'is-missing': model.material.met === false }"
    >
      <div class="technique-material-slot">
        <SlotView
          variant="equipment"
          static
          :item="null"
          :icon="model.material.icon ?? defaultCrystalIcon"
          :label="model.material.name"
        />
      </div>
      <div class="technique-material-meta">
        <p>{{ model.material.name }}</p>
        <strong>{{ model.material.amountLabel }}</strong>
      </div>
    </div>
    <p v-if="model.materialNote" class="technique-material-note">{{ model.materialNote }}</p>
    <GameActionButton
      class="technique-advance"
      :gold="!model.advanceDisabled"
      :disabled="model.advanceDisabled"
      @click="emit('advance')"
    >{{ t('technique.advance') }}</GameActionButton>
    <p class="technique-notice" role="status" aria-live="polite">{{ notice || model.disabledReason }}</p>
  </GameCard>
</template>
<style scoped>
.technique-upgrade { position:absolute; left:1002px; top:178px; width:362px; height:543px; color:#f3e4c4; }
h3 { margin:10px 0 6px; padding-top:14px; border-top:1px solid #b28a4344; font-size:16px; font-weight:500; color:#ebd49e; }
.technique-compare { display:flex; align-items:center; justify-content:center; gap:18px; text-align:center; padding:14px 12px; border:1px solid #b6975e55; background:#19261e88; border-radius:4px; }
.technique-compare strong { font-size:22px; font-weight:600; color:#a3d793; }
.technique-compare > span { font-size:28px; line-height:1; color:#e0bd6b; }
.technique-material { display:flex; gap:12px; align-items:center; padding:6px 0; }
.technique-material-slot { width:48px; height:48px; flex:none; }
.technique-material-slot :deep(.slot-view) { width:100%; height:100%; }
.technique-material-meta { display:flex; flex-direction:column; gap:4px; min-width:0; }
.technique-material p { margin:0; font-size:15px; color:#f3e4c4; }
.technique-material strong { color:#a3d793; font-size:15px; font-weight:600; }
.technique-material.is-missing strong { color:#d98a6f; }
.technique-material-note { font-size:12px; color:#b6a87e; line-height:1.6; margin:0; }
.technique-advance.game-action-button { width:240px; height:calc(240px * 324 / 1225); min-height:46px; flex:none; font-size:21px; padding:8px 24px; margin:auto auto 0; }
.technique-notice { margin:0; color:#c9a95f; font-size:12px; line-height:16px; text-align:center; min-height:20px; }
</style>
