<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { useStateVersion } from '@/composables/useGameState'
import { useNotificationStore, type ChatLogEntry } from '@/stores/notification'
import { isMaxRankTone } from '@/core/profession/slotRank'
import { formatNumber } from '@/core/format/NumberFormatter'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import type { BattleLogEntry } from '@/core/battle/turn/TurnOrderPreview'
import GamePanel from '@/components/common/GamePanel.vue'

const MAX_VISIBLE = 40
const props = withDefaults(
  defineProps<{ collapsible?: boolean; alwaysVisible?: boolean }>(),
  { collapsible: true, alwaysVisible: false },
)

const { battle, isBattleFighting, logEntries, participantNameOf } = useTurnBattleInfo()
const { t } = useI18n()
const { stateVersion } = useStateVersion()
const notification = useNotificationStore()

type CombatLogTab = 'battle' | 'stats' | 'loot'
const activeTab = ref<CombatLogTab>('battle')
const expanded = ref(false)
const collapsed = ref(false)
const listEl = ref<HTMLElement | null>(null)

const visible = computed(() => {
  stateVersion.value

  return isBattleFighting.value && (props.alwaysVisible || logEntries.value.length > 0)
})

const recentEntries = computed(() => {
  stateVersion.value

  const entries = logEntries.value

  return entries.slice(Math.max(0, entries.length - MAX_VISIBLE))
})

const lootEntries = computed<ChatLogEntry[]>(() =>
  notification.logEntries.filter((entry) => entry.kind === 'loot' || entry.kind === 'craft'),
)

interface DamageStatRow {
  actorId: string
  name: string
  isAlly: boolean
  totalDamage: number
  totalHealed: number
  turns: number
  hits: number
  crits: number
  damageKindLabel: string
  percentOfMax: number
  sharePercent: number
}

const damageStats = computed<DamageStatRow[]>(() => {
  stateVersion.value
  const entries = logEntries.value
  if (entries.length === 0) return []

  const allyIds = new Set((battle.value?.players ?? []).map((p) => p.id))
  const byActor = new Map<
    string,
    {
      totalDamage: number
      totalHealed: number
      turns: number
      hits: number
      crits: number
      damageKind?: 'physical' | 'magic' | 'true'
      element?: string
    }
  >()

  for (const entry of entries) {
    const rec = byActor.get(entry.actorId) ?? {
      totalDamage: 0,
      totalHealed: 0,
      turns: 0,
      hits: 0,
      crits: 0,
    }
    rec.turns += 1
    rec.totalDamage += entry.totalDamage ?? 0
    rec.totalHealed += entry.healed ?? 0
    rec.hits += entry.hitCount ?? ((entry.totalDamage ?? 0) > 0 ? 1 : 0)
    rec.crits += entry.critCount ?? (entry.crit ? 1 : 0)
    if (entry.damageKind) rec.damageKind = entry.damageKind
    if (entry.element) rec.element = entry.element
    byActor.set(entry.actorId, rec)
  }

  let maxDamage = 1
  let sumDamage = 0
  for (const rec of byActor.values()) {
    if (rec.totalDamage > maxDamage) maxDamage = rec.totalDamage
    sumDamage += rec.totalDamage
  }

  const rows: DamageStatRow[] = []
  for (const [actorId, rec] of byActor.entries()) {
    const kindKey =
      rec.damageKind && ['physical', 'magic', 'true'].includes(rec.damageKind)
        ? rec.damageKind
        : 'default'
    const kindLabel = t(`combat.log.damageKinds.${kindKey}`)
    const elLabel =
      rec.element &&
      ['metal', 'wood', 'water', 'fire', 'earth', 'primordial'].includes(rec.element)
        ? ` (${t(`combat.log.elements.${rec.element}`)})`
        : ''
    rows.push({
      actorId,
      name: participantNameOf(actorId) ?? t('combat.log.unknownActor'),
      isAlly: allyIds.has(actorId) || actorId === 'player',
      totalDamage: rec.totalDamage,
      totalHealed: rec.totalHealed,
      turns: rec.turns,
      hits: rec.hits,
      crits: rec.crits,
      damageKindLabel: `${kindLabel}${elLabel}`,
      percentOfMax: Math.min(100, Math.round((rec.totalDamage / Math.max(1, maxDamage)) * 100)),
      sharePercent: sumDamage > 0 ? Math.round((rec.totalDamage / sumDamage) * 100) : 0,
    })
  }

  return rows.sort((a, b) => b.totalDamage - a.totalDamage || Number(b.isAlly) - Number(a.isAlly))
})

function isAllyActor(actorId: string): boolean {
  return (battle.value?.players ?? []).some((p) => p.id === actorId) || actorId === 'player'
}

function describe(entry: BattleLogEntry): string {
  const actor = participantNameOf(entry.actorId) ?? t('combat.log.unknownActor')

  if (entry.ccBlocked) {
    return t('combat.log.entryCcBlocked', { turn: entry.turn, actor })
  }

  const skill = entry.skillId
    ? turnSkillDisplayMetaOf(entry.skillId)?.name ?? t('combat.log.unknownSkill')
    : t('combat.log.basicAttack')

  const targetNames = entry.targetIds
    .map((targetId) => participantNameOf(targetId) ?? t('combat.log.unknownActor'))
    .join(', ')

  const base = t('combat.log.entry', {
    turn: entry.turn,
    actor,
    skill,
    targets: targetNames.length > 0 ? ` → ${targetNames}` : '',
  })

  const details: string[] = []

  if (entry.dodged) {
    details.push(t('combat.log.dodged'))
  } else if ((entry.totalDamage ?? 0) > 0) {
    const kindKey =
      entry.damageKind && ['physical', 'magic', 'true'].includes(entry.damageKind)
        ? entry.damageKind
        : 'default'
    const kindLabel = t(`combat.log.damageKinds.${kindKey}`)
    const elementLabel =
      entry.element &&
      ['metal', 'wood', 'water', 'fire', 'earth', 'primordial'].includes(entry.element)
        ? ` (${t(`combat.log.elements.${entry.element}`)})`
        : ''
    const critLabel = entry.crit
      ? ` [${
          (entry.critCount ?? 1) > 1
            ? t('combat.log.critMultiTag', { count: entry.critCount })
            : t('combat.log.critTag')
        }]`
      : ''
    const wardLabel =
      (entry.wardDamage ?? 0) > 0
        ? t('combat.log.wardNote', { ward: formatNumber(entry.wardDamage!) })
        : ''

    details.push(
      t('combat.log.damageDealt', {
        damage: formatNumber(entry.totalDamage!),
        kind: kindLabel,
        element: elementLabel,
        crit: critLabel,
        ward: wardLabel,
      }),
    )
  }

  if ((entry.healed ?? 0) > 0) {
    details.push(t('combat.log.healed', { healed: formatNumber(entry.healed!) }))
  }

  return details.length > 0 ? `${base} — ${details.join(' · ')}` : base
}

function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

watch(
  () => [logEntries.value.length, logEntries.value.at(-1)?.turn],
  async () => {
    await nextTick()
    if (listEl.value && activeTab.value === 'battle') {
      listEl.value.scrollTop = listEl.value.scrollHeight
    }
  },
)
</script>

<template>
  <GamePanel
    v-if="visible"
    class="battle-log-panel df-chatbox"
    :class="{ 'is-expanded': expanded }"
    :title="t('dongFu.chatbox.title')"
    :aria-label="t('dongFu.chatbox.aria')"
  >
    <div class="df-chatbox__toolbar">
      <div class="df-chatbox__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeTab === 'battle' }"
          :aria-selected="activeTab === 'battle'"
          @click="activeTab = 'battle'"
        >
          {{ t('combat.log.tabs.battle') }}
        </button>
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeTab === 'stats' }"
          :aria-selected="activeTab === 'stats'"
          @click="activeTab = 'stats'"
        >
          {{ t('combat.log.tabs.stats') }}
        </button>
        <button
          type="button"
          role="tab"
          class="df-chatbox__tab"
          :class="{ 'is-active': activeTab === 'loot' }"
          :aria-selected="activeTab === 'loot'"
          @click="activeTab = 'loot'"
        >
          {{ t('combat.log.tabs.loot') }}
        </button>
      </div>

      <div class="df-chatbox__actions">
        <button
          v-if="collapsible"
          type="button"
          class="battle-log-panel__toggle df-chatbox__icon-btn"
          :aria-expanded="!collapsed"
          @click="collapsed = !collapsed"
        >{{ collapsed ? '▸' : '▾' }}</button>
        <button
          type="button"
          class="df-chatbox__icon-btn"
          :aria-label="t(expanded ? 'dongFu.chatbox.collapse' : 'dongFu.chatbox.expand')"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? '▼' : '▲' }}
        </button>
      </div>
    </div>

    <div
      v-if="!collapsible || !collapsed"
      ref="listEl"
      class="battle-log-panel__entries df-chatbox__list"
      role="log"
      aria-live="polite"
    >
      <template v-if="activeTab === 'battle'">
        <p v-if="!recentEntries.length" class="df-chatbox__empty">
          {{ t('dongFu.chatbox.empty') }}
        </p>
        <p
          v-for="(entry, index) in recentEntries"
          :key="`${entry.turn}-${index}`"
          class="battle-log-panel__line df-chatbox__line"
          :class="{
            'df-chatbox__line--ally': isAllyActor(entry.actorId),
            'df-chatbox__line--enemy': !isAllyActor(entry.actorId),
            'df-chatbox__line--crit': entry.crit,
          }"
        >
          {{ describe(entry) }}
        </p>
      </template>

      <template v-else-if="activeTab === 'stats'">
        <p v-if="!damageStats.length" class="df-chatbox__empty">
          {{ t('combat.log.stats.empty') }}
        </p>
        <div
          v-for="row in damageStats"
          :key="row.actorId"
          class="combat-stat-row"
          :class="{ 'is-ally': row.isAlly, 'is-enemy': !row.isAlly }"
        >
          <div class="combat-stat-row__head">
            <span class="combat-stat-row__name">
              <span class="combat-stat-row__badge">{{ t(row.isAlly ? 'combat.log.stats.ally' : 'combat.log.stats.enemy') }}</span>
              {{ row.name }}
            </span>
            <strong class="combat-stat-row__dmg">
              {{ formatNumber(row.totalDamage) }} ({{ row.sharePercent }}%)
            </strong>
          </div>
          <div class="combat-stat-row__bar">
            <span class="combat-stat-row__fill" :style="{ width: `${row.percentOfMax}%` }" />
          </div>
          <div class="combat-stat-row__meta">
            <span>{{ row.damageKindLabel }}</span>
            <span>{{ t('combat.log.stats.hits', { hits: row.hits, crits: row.crits }) }}</span>
            <span>{{ t('combat.log.stats.perTurn', { avg: formatNumber(Math.round(row.totalDamage / Math.max(1, row.turns))) }) }}</span>
            <span v-if="row.totalHealed > 0" class="combat-stat-row__heal">
              +{{ formatNumber(row.totalHealed) }} HP
            </span>
          </div>
        </div>
      </template>

      <template v-else>
        <p v-if="!lootEntries.length" class="df-chatbox__empty">
          {{ t('dongFu.chatbox.empty') }}
        </p>
        <div
          v-for="entry in lootEntries"
          :key="entry.id"
          class="df-chatbox__line df-chatbox__line--loot"
        >
          <span class="df-chatbox__time">{{ formatTime(entry.timestampMs) }}</span>
          <span v-if="entry.lootItems.length > 0" class="df-chatbox__loot-group">
            <span class="df-chatbox__prefix">{{ t('toasts.received') }}: </span>
            <template v-for="(seg, idx) in entry.lootItems" :key="`${seg.name}-${idx}`">
              <span v-if="idx > 0" class="df-chatbox__comma">, </span>
              <span
                class="df-chatbox__loot-item"
                :class="{ 'df-chatbox__loot-item--max-rank': isMaxRankTone(seg.nameTone) }"
                :style="seg.nameColorVar && !isMaxRankTone(seg.nameTone) ? { color: `var(${seg.nameColorVar})` } : undefined"
              >{{ seg.name }}</span>
              <span v-if="seg.gradeLabel" class="df-chatbox__loot-grade"> ({{ seg.gradeLabel }})</span>
              <strong v-if="seg.amountLabel" class="df-chatbox__loot-amount"> {{ seg.amountLabel }}</strong>
            </template>
          </span>
          <span v-else class="df-chatbox__text">{{ entry.message }}</span>
        </div>
      </template>
    </div>
  </GamePanel>
</template>

<style scoped>
.battle-log-panel.game-panel {
  --game-panel-header-top: 8px;
  --game-panel-line-bottom: 24px;
  position: absolute;
  left: auto;
  top: auto;
  right: 0;
  bottom: 0;
  width: 356px;
  height: 192px;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(10, 8, 4, 0.55);
  transition: height 180ms ease;
}

.battle-log-panel.game-panel.is-expanded {
  height: 308px;
}

.battle-log-panel :deep(.game-panel__header) {
  inset: 8px 12px auto;
  height: 30px;
}

.battle-log-panel :deep(.game-panel__title) {
  height: 24px;
  font-size: 22px;
  line-height: 24px;
}

.battle-log-panel :deep(.game-panel__line) {
  bottom: 0;
}

.battle-log-panel :deep(.game-panel__content) {
  inset: 42px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.df-chatbox__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex: none;
}

.df-chatbox__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-chatbox__tab {
  padding: 2px 8px;
  border: 1px solid #b39a68;
  background: #ede0c4;
  color: #5c492c;
  font-size: 11px;
  cursor: pointer;
}

.df-chatbox__tab.is-active {
  border-color: #8a6420;
  background: #302519;
  color: #f4e4c1;
  font-weight: 600;
}

.df-chatbox__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.df-chatbox__icon-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #b39a68;
  background: #ede0c4;
  color: #302519;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.df-chatbox__icon-btn:hover {
  background: #decba2;
  border-color: #8a6420;
}

.df-chatbox__list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--pc-font-body, Georgia, serif);
  font-size: 12px;
  line-height: 1.4;
  scrollbar-width: thin;
  scrollbar-color: #a18547 transparent;
}

.df-chatbox__empty {
  margin: 0;
  padding: 8px 2px;
  color: #675637;
  font-style: italic;
  font-size: 12px;
}

.battle-log-panel__line {
  margin: 0;
  padding: 3px 6px;
  border-radius: 2px;
  background: rgba(178, 138, 67, 0.14);
  border-left: 2px solid #b28a43;
  color: #302519;
  overflow-wrap: anywhere;
}

.df-chatbox__line--ally {
  border-left-color: #287257;
}

.df-chatbox__line--enemy {
  border-left-color: #a63628;
}

.df-chatbox__line--crit {
  background: rgba(190, 92, 38, 0.18);
  font-weight: 600;
}

.combat-stat-row {
  padding: 4px 6px;
  border-radius: 3px;
  background: rgba(178, 138, 67, 0.14);
  border-left: 3px solid #287257;
  color: #302519;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.combat-stat-row.is-enemy {
  border-left-color: #a63628;
}

.combat-stat-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.combat-stat-row__name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.combat-stat-row__badge {
  padding: 0 4px;
  border-radius: 2px;
  font-size: 10px;
  background: #287257;
  color: #f4e4c1;
}

.combat-stat-row.is-enemy .combat-stat-row__badge {
  background: #a63628;
}

.combat-stat-row__dmg {
  color: #6b3f08;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.combat-stat-row__bar {
  height: 5px;
  border-radius: 2px;
  background: rgba(48, 37, 25, 0.18);
  overflow: hidden;
}

.combat-stat-row__fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #287257, #48a883);
  transition: width 180ms ease;
}

.combat-stat-row.is-enemy .combat-stat-row__fill {
  background: linear-gradient(90deg, #a63628, #d45b48);
}

.combat-stat-row__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #675637;
}

.combat-stat-row__heal {
  color: #1f6b50;
  font-weight: 600;
}

.df-chatbox__time {
  color: #675637;
  margin-right: 4px;
  font-size: 11px;
}

.df-chatbox__prefix {
  color: #5c492c;
}

.df-chatbox__loot-item {
  font-weight: 600;
  color: #302519;
}

.df-chatbox__loot-item--max-rank {
  background: linear-gradient(90deg, #b33225, #8a5a19, #287257, #5b3882);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.df-chatbox__loot-grade {
  color: #675637;
  font-size: 11px;
}

.df-chatbox__loot-amount {
  color: #6b3f08;
  font-weight: 700;
}

.df-chatbox__text {
  color: #302519;
}
</style>
