<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import type { TooltipContent } from '@/composables/useTooltip'
import { makeKiemBarReader } from '@/presentation/bridges/kiemBarBridge'
import { makeTheBarReader } from '@/presentation/bridges/theBarBridge'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { PLAYER_VISUAL_PROFILES } from '@/presentation/art/PlayerVisualProfiles'
import { resolvePlayerEntityKey, staticArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { skillIconPath } from '@/data/skill/SkillIconManifest'
import { formatNumber } from '@/core/format/NumberFormatter'
import { projectSkillStatRows } from '@/presentation/combat/SkillStatProjection'
import GameCard from '@/components/common/GameCard.vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import TurnCombatSkillBar from './TurnCombatSkillBar.vue'
import CombatVitalMeter from './CombatVitalMeter.vue'

const props = defineProps<{ participant: TurnBattleParticipant | null }>()
const { t } = useI18n()
const { stateVersion } = useStateVersion()
const player = usePlayerStore()
const manager = useGameManager()
const kiemReader = makeKiemBarReader(manager, () => player)
const theReader = makeTheBarReader(manager, () => player)
const resource = computed(() => { stateVersion.value; return isHuman.value ? kiemReader() ?? theReader() : null })
const entity = computed(() => { stateVersion.value; return props.participant?.entity })
const isHuman = computed(() => props.participant?.id === 'player')
const avatar = computed(() => {
  if (!entity.value) return undefined
  if (!isHuman.value) return staticArtFormFor(entity.value.id)?.texture.textureUrl
  const profile = PLAYER_VISUAL_PROFILES[player.visualProfileId] ?? PLAYER_VISUAL_PROFILES.mortal
  return staticArtFormFor(resolvePlayerEntityKey(profile.id, profile.combatTextureKey, { armed: player.visualArmed }))?.texture.textureUrl ?? profile.combatTextureUrl
})
const hp = computed(() => { stateVersion.value; return entity.value ? Math.max(0, entity.value.currentHp) / Math.max(1, entity.value.maxHp) * 100 : 0 })
const statsTooltip = computed<TooltipContent | undefined>(() => {
  stateVersion.value
  if (!entity.value) return undefined
  return { kind: 'stat', name: entity.value.name, sections: [{ label: t('combat.partyCard.stats'), rows: ['might', 'defense', 'speed'].map(key => ({ label: t(`combat.partyCard.${key}`), value: formatNumber(entity.value!.stats[key as 'might' | 'defense' | 'speed']) })) }] }
})
const skills = computed(() => {
  stateVersion.value
  const p = props.participant
  return [p?.basic, p?.special?.skill, p?.ultimate?.skill].map((skill, index) => {
    const meta = skill ? turnSkillDisplayMetaOf(skill.id) : undefined
    const template = skill ? manager.catalogOps.getSkillTemplate(skill.id) : undefined
    const tooltip: TooltipContent | undefined = meta || template ? {
      kind: 'technique', name: template?.name ?? meta!.name,
      description: template?.description ?? meta?.description,
      sections: [{ label: t('skill.stats'), rows: projectSkillStatRows(template, key => t(key)) }],
    } : undefined
    return { role: ['basic', 'special', 'ultimate'][index], hasSkill: !!skill, meta, tooltip, icon: skillIconPath(meta?.iconKey), remaining: index === 1 ? p?.special?.remainingCooldownTurns : index === 2 ? p?.ultimate?.remainingCooldownTurns : 0 }
  })
})
</script>

<template>
  <GameCard class="battle-card" :class="{ 'is-empty': !participant, 'is-human': isHuman, 'is-defeated': participant && !participant.alive }">
    <header class="battle-card__identity" v-tooltip="statsTooltip" tabindex="0">
      <div class="battle-card__avatar"><div class="battle-card__crop"><img v-if="avatar" :src="avatar" alt="" /></div><img src="/assets/ui/tien-hiep-2026-10/combat/battle-card/ring-v1.png" alt="" class="battle-card__ring" /></div>
      <strong>{{ entity?.name ?? t('combat.partyCard.empty') }}</strong>
    </header>
    <div class="battle-card__vitals" v-tooltip="statsTooltip">
      <CombatVitalMeter v-if="entity" frame-src="/assets/ui/tien-hiep-2026-10/combat/battle-card/meter-v1.png" :label="t('combat.overlay.playerCard.hp')" :percent="hp" :ward-percent="(entity.currentWard + (entity.externalWard?.amount ?? 0)) / Math.max(1, entity.maxHp) * 100" :text="`${formatNumber(Math.max(0, Math.ceil(entity.currentHp)))} / ${formatNumber(entity.maxHp)}`" />
      <CombatVitalMeter frame-src="/assets/ui/tien-hiep-2026-10/combat/battle-card/meter-v1.png" v-if="entity && entity.stats.maxMp > 0" tone="mp" :label="t('combat.overlay.playerCard.mp')" :percent="entity.currentMp / entity.stats.maxMp * 100" :text="formatNumber(entity.currentMp)" />
      <span v-if="resource" class="battle-card__resource">{{ resource.label }}: {{ formatNumber(resource.current) }} / {{ formatNumber(resource.max) }}</span>
    </div>
    <TurnCombatSkillBar v-if="isHuman" card class="battle-card__skills" />
    <div v-else class="battle-card__skills battle-card__companion-skills">
      <div v-for="skill in skills" :key="skill.role" class="battle-card__skill">
        <CombatSkillSlot variant="circle" :show-caption="false" :has-skill="skill.hasSkill" :is-locked="!skill.hasSkill" :auto-active="skill.role === 'basic' && skill.hasSkill && !!participant?.alive" :remaining="skill.remaining ?? 0" :total="skill.remaining ?? 0" :is-masked="!!skill.remaining" :display-icon="skill.icon" :display-label="skill.meta?.name ?? t(`combat.overlay.skillBar.roles.${skill.role}`)" circle-frame-src="/assets/ui/tien-hiep-2026-10/combat/battle-card/ring-v1.png" :tooltip-override="skill.tooltip" />
      </div>
    </div>
  </GameCard>
</template>

<style scoped>
.battle-card.game-card { padding: 10px 12px; height: 163px; container-type: inline-size; pointer-events: auto; }
.battle-card__identity { height: 38px; display: flex; align-items: center; gap: 6px; color: #f3e4c4; min-width: 0; }
.battle-card__identity strong { font: 700 15px/1.2 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.battle-card__avatar { position: relative; flex: 0 0 38px; height: 38px; }
.battle-card__crop { position: absolute; inset: 10%; border-radius: 50%; overflow: hidden; background: #252a25; }
.battle-card__crop img { width: 300%; height: 300%; max-width: none; object-fit: cover; position: absolute; left: -100%; top: -8%; }
.battle-card__ring { position: absolute; inset: 0; width: 100%; height: 100%; }
.battle-card__vitals { height: 48px; padding-top: 2px; display: flex; flex-direction: column; gap: 2px; }
.battle-card__vitals :deep(.combat-vital-meter) { font-size: 10px; grid-template-columns: 1fr auto; }
.battle-card__vitals :deep(.combat-vital-meter__label) { display: none; }
.battle-card__vitals :deep(.combat-vital-meter__frame) { height: 100%; }
.battle-card__vitals :deep(.combat-vital-meter__track) { height: 14px; }
.battle-card__vitals :deep(.combat-vital-meter__interior) { inset: 3px 5%; }
.battle-card__resource { font-size: 10px; line-height: 1.1; color: #ead394; }
.battle-card__skills { height: 48px; margin-top: 2px; }
.battle-card__skills :deep(.turn-combat-skill-bar__slots) { padding-bottom: 0; }
.battle-card__skills :deep(.turn-combat-skill-bar__slot-button) { width: min(100%, 38px); justify-self: center; }
.battle-card__skills :deep(.combat-skill-slot__caption) { font-size: 9px; top: calc(100% + 2px); }
.battle-card__companion-skills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10%; }
.battle-card__skill { min-width: 0; position: relative; }
.battle-card__skill :deep(.combat-skill-slot) { width: min(100%, 38px); height: auto; aspect-ratio: 1; margin: 0 auto; }
.battle-card__skill :deep(.combat-skill-slot__caption) { top: calc(100% + 2px); left: 0; width: 100%; font-size: 9px; }
.battle-card__skill :deep(.slot-view) { width: 100%; height: auto; aspect-ratio: 1; }
.battle-card__skill > span { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.battle-card.is-empty { opacity: .5; }
.battle-card.is-defeated { filter: grayscale(.8); }
</style>
