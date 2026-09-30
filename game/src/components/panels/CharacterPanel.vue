<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import PlayerPortrait from '../common/PlayerPortrait.vue'
import GameButton from '../common/GameButton.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import { BASE_STAT_LABELS, formatStat } from '@/core/stats/StatLabels'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { getActiveWayDefinition } from '@/core/player/CultivationPathKit'
import { isActivePath, getActiveElement } from '@/core/player/CultivationPathSystem'
import { MAIN_STAT_KEYS, type MainStatKey } from '@/core/stats/StatTypes'
import { getEffectiveMainStatCap } from '@/core/stats/StatCap'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { getTalentDefinition } from '@/data/talent/Talents'
import { TALENT_RARITY_LABELS, type TalentDefinition, type TalentRarity } from '@/core/talent/Talent'
import SysTag from '../common/system/SysTag.vue'

const { t } = useI18n()
const player = usePlayerStore()
const ui = useUiStore()
const { allocateAttributePoint } = useProgressionActions()

// attribute allocation rejects mid-battle (ops gate) - the + button
// disables up front so the affordance doesn't look live.
const { isBattleInProgress: inBattle } = useTurnBattleInfo()

// Entry point Quán Khí (Task 7 review fix, Critical) — nút riêng trong
// Character Panel này (openQuanKhi → ui.openStandalonePanel('quan_khi'))
// là đường mở lại panel sau khi Quán Khí; flow đột phá thống nhất đi qua
// triggerBreakthroughAction() trong useTribulation.ts (commandWheelCatalog.ts
// đã bỏ slot quan_khi). Chỉ hiện khi đã chọn Kiếm Tu (route switch chỉ có
// ý nghĩa ở đó).
// M9 - the entry is kiem-way machinery. P1 - the generic authority read
// resolves the committed pair through the catalog (fail closed on a
// way-less/corrupt pair), never a raw path id.
const showQuanKhiEntry = computed(() => isActivePath(player, 'sword'))

function openQuanKhi() {
  ui.openStandalonePanel('quan_khi')
}

// M5 — the active way (cultivationWay authoritative) drives the kit
// label + aura colour; getActiveWayDefinition resolves the persisted
// (path, way) pair and fails closed on a way-less/corrupt save.
const chosenKit = computed(() => getActiveWayDefinition(player))

// Huyen Kim SS15 (Dao The) - the elemental disc behind the portrait.
// Spell-path players resolve their element through the canonical read;
// other ways declare theirs on the kit. No element yet -> formation ring.
const heroElement = computed(() => getActiveElement(player) ?? chosenKit.value?.element ?? null)
const heroDiscUrl = computed(() =>
  resolveAssetUrl(
    heroElement.value
      ? `/assets/ui/elements/el-${heroElement.value}.png`
      : '/assets/ui/elements/el-formation-ring.png',
  ),
)

// Thiên Phú (talent-direction-choice-plan §7) — hiển thị thiên phú đã chọn
// (tên + description) đọc từ selectedTalentIds qua getTalentDefinition;
// id lạ trong save cũ bị bỏ qua an toàn (undefined → filter loại).
const selectedTalents = computed(() =>
  player.selectedTalentIds
    .map((talentId) => getTalentDefinition(talentId))
    .filter((talent): talent is TalentDefinition => talent !== undefined),
)

// M-UI-SYSTEM - talent rarity tag -> SysTag tone: the tier is carried by
// the glyph shape + label text (color only reinforces, spec 7.3).
const TALENT_RARITY_TONE: Record<TalentRarity, 'muted' | 'success' | 'cyan' | 'violet' | 'warn'> = {
  pham: 'muted',
  linh: 'success',
  dia: 'cyan',
  thien: 'violet',
  di: 'warn',
}

// UI redesign mục 11 (Character) — silhouette nhân vật ở cột giữa
// header nhuộm màu theo hệ của path đã chọn (Kiếm Tu khai `element`
// fixed; spell pathway leaves it empty because the element lives on player.spellPath.element - see
// CultivationPathKit.ts) — fallback vàng trung tính khi CHƯA chọn path
// (còn ở Phàm Nhân) hoặc đã chọn Pháp Tu.
const characterAuraColor = computed(() =>
    chosenKit.value?.element ? ELEMENT_COLOR_VARS[chosenKit.value.element] : 'var(--chrome-500)',
)

// Chân dung tĩnh (2026-08-26, dong-fu plan Workstream A) — PNG mortal
// mới player-mortal-v1.png qua PlayerPortrait; ẢNH TĨNH, không áp
// animation tu luyện (khác trigger cultivate giữa Động Phủ).
const characterPortraitHeight = 148

// Đọc tên skill qua skillManager (LEARNED skills, public) thay vì
// GameManager.skillTemplates (private) — sau chooseCultivationPath(),
// cả 3 skill của kit đã chắc chắn có trong skillManager.

const realm = computed(() => getCurrentRealm(player.realmId))

// Nhóm theo category để hiện thành từng khối danh sách riêng — dễ
// quét mắt hơn 1 khối phẳng chia 2 cột (không dùng bảng ô/table).
// BASE_STAT_LABELS/StatCategory trích ra @/core/stats/StatLabels.ts
// (2026-08-15, tooltip Tâm Pháp dùng chung).

// Attribute first — the five main stats are the interactive core of the
// sheet (point allocation) and render as the meridian figure below.
// The other categories (combat/survival/special/defense_advanced) live
// in the detail card beside the drawer (CharacterDetailCard.vue,
// toggle = panels.character.actions.details) — the panel keeps just
// the meridian + Ngu Hanh chips so the drawer stays compact.
const attributeStats = computed(() =>
  BASE_STAT_LABELS.filter(stat => stat.category === 'attribute'),
)

// PLAN HOÀN CHỈNH mục 4 — UI Stat Cap: KHÔNG hiện "24/30", chỉ hiện số
// + chữ "MAX" (vàng) ngay bên dưới khi ĐẦY. Trần tính trên baseStats
// (phần người chơi TỰ đầu tư) chứ không phải finalStats đang hiện ở
// cột giá trị — equipment/pill vẫn có thể đẩy finalStats cao hơn trần
// này bình thường, trần chỉ chặn HÀNH ĐỘNG phân phối điểm.
function isMainStat(key: string): key is MainStatKey {
  return (MAIN_STAT_KEYS as string[]).includes(key)
}

function mainStatCap(): number {
  return getEffectiveMainStatCap(player)
}

function isMainStatCapped(key: MainStatKey): boolean {
  return player.baseStats[key] >= mainStatCap()
}

function allocate(key: MainStatKey) {
  allocateAttributePoint(key)
}

// Meridian node anchors — dot positions on stat-meridian-figure.png
// (904x1024 stance art): head = intelligence, chest = vitality,
// dantian = attunement, extended left fist = strength, grounded right
// foot = dexterity. Percent coords so the block scales with panel
// width without distorting the art; `side` decides which way the info
// card extends. Bands are staggered so no two cards share a row:
// strength's card drops BELOW the fist dot into the empty space under
// the extended arm (extending right from y=12% would collide with the
// head card).
const MERIDIAN_NODE_POSITIONS: Record<MainStatKey, { x: number; y: number; side: 'left' | 'right' | 'below' | 'above' }> = {
  intelligence: { x: 57, y: 10, side: 'right' },
  vitality: { x: 51, y: 40, side: 'right' },
  attunement: { x: 52, y: 54, side: 'below' },
  strength: { x: 8, y: 14, side: 'left' },
  dexterity: { x: 8, y: 92, side: 'above' },
}

function meridianNode(key: string): { style: { left: string; top: string }; modifier: string } {
  const pos = MERIDIAN_NODE_POSITIONS[key as MainStatKey] ?? { x: 50, y: 50, side: 'right' }
  const modifier =
    pos.side === 'left' ? 'meridian__node--left'
    : pos.side === 'below' ? 'meridian__node--below'
    : pos.side === 'above' ? 'meridian__node--above'
    : ''
  return {
    style: { left: `${pos.x}%`, top: `${pos.y}%` },
    modifier,
  }
}

// Bound dynamically on purpose: a literal src="/assets/..." in the
// template is rewritten to a file import by @vitejs/plugin-vue, which
// breaks jsdom mounts (CharacterPanel.meridian.test.ts).
const MERIDIAN_FIGURE_SRC = resolveAssetUrl('/assets/ui/stat-meridian-figure.png')

// Không còn "Hướng" (ElementAffinity đã xoá — vai trò khuếch đại
// Power giờ do Linh Căn/Attunement đảm nhiệm, xem StatCalculator.ts)
// và không còn chu kỳ sinh/khắc — mỗi hành độc lập kiểu Last Epoch.
const elementRows = computed(() =>
  ELEMENT_ORDER.map(element => ({
    element,

    label: ELEMENT_LABELS[element],

    color: ELEMENT_COLOR_VARS[element],

    power: player.finalStats[`${element}Power`],

    resistance: player.finalStats[`${element}Resistance`],

    penetration: player.finalStats[`${element}Penetration`],
  })),
)

// Hỗn Nguyên (Void) — chỉ có Power, bỏ qua Armor/Resistance hoàn
// toàn nên không có cột Kháng/Xuyên như 5 hành thường.
const PRIMORDIAL_COLOR = 'var(--el-primordial)'

// Static src="/..." gets rewritten to an import by the vite plugin and
// breaks under jsdom — bind dynamically like the element discs above.
const primordialDiscUrl = resolveAssetUrl('/assets/ui/elements/el-primordial.png')

// 3 concentric formation rings from the same sprite sheet - the formation base layer.
const formationRingUrl = resolveAssetUrl('/assets/ui/elements/el-formation-ring.png')
const formationOrbsUrl = resolveAssetUrl('/assets/ui/elements/el-formation-orbs.png')
const formationStarUrl = resolveAssetUrl('/assets/ui/elements/el-formation-star.png')

// "Chiến Lực" — chỉ số tổng hợp THUẦN HIỂN THỊ (không dùng ở đâu khác
// trong game logic/combat thật), lấy cảm hứng từ số "Mastery" tổng
// trong màn Combat Attributes tham khảo. Hệ số minh hoạ, dễ tinh
// chỉnh lại sau khi thấy số thực tế qua nhiều mốc Cảnh Giới.
const combatPower = computed(() => {
  const stats = player.finalStats

  return Math.round(
    stats.might * 2 +
    stats.defense * 1.5 +
    stats.maxHp * 0.1 +
    stats.maxMp * 0.05 +
    stats.criticalRate * 500 +
    stats.criticalDamage * 300 +
    stats.speed * 200,
  )
})

</script>

<template>
  <section class="character-panel">
    <!-- Tu vi và Đột Phá thuộc hoàn toàn về panel Cảnh Giới. Nhân Vật
         chỉ giữ nhận diện, chiến lực và chỉ số để tránh lặp UI. -->
    <div class="character-panel__header">
      <div class="character-panel__identity">
        <div class="character-panel__figure" :style="{ '--aura': characterAuraColor }">
          <img class="character-panel__figure-disc" :src="heroDiscUrl" alt="" aria-hidden="true" />
          <span class="character-panel__figure-aura" />

          <PlayerPortrait
            class="character-panel__figure-sprite"
            variant="portrait"
            :height="characterPortraitHeight"
          />
        </div>

        <div class="character-panel__identity-text">
          <h3 class="character-panel__name" data-testid="character-name">{{ player.name }}</h3>

          <p class="character-panel__realm-line" data-testid="character-realm-line">{{ realm.name }} · {{ t('panels.character.labels.realmFloor') }} {{ player.realmLevel }}</p>

          <p class="character-panel__power">
            <span class="character-panel__power-value">{{ formatNumber(combatPower) }}</span>
            <span class="character-panel__power-label">{{ t('panels.character.labels.combatPower') }}</span>
          </p>
        </div>
      </div>

      <!-- Thiên Phú đã chọn (talent-direction-choice-plan §7) — quyết định
           hướng Đạo duy nhất lúc tạo nhân vật, luôn hiển thị để người
           chơi nhớ mình đang đi đường nào. -->
      <div v-if="selectedTalents.length > 0" class="character-panel__talents">
        <h4 class="character-panel__talents-title"><span class="sys-eyebrow">{{ t('panels.character.sections.talents') }}</span></h4>

        <!-- Huyen Kim SS15 - compact seal chips; detail on hover. -->
        <div class="character-panel__talent-seals">
          <span
            v-for="talent in selectedTalents"
            :key="talent.id"
            class="talent-seal"
            :class="`talent-tier-${talent.rarity}`"
            v-tooltip="talent.description"
          >
            <SysTag :tone="TALENT_RARITY_TONE[talent.rarity]" class="talent-seal__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</SysTag>
            <span class="talent-seal__name">{{ talent.name }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="character-panel__body scrollfade">
        <div class="stat-group">
        <h4 class="stat-group__title stat-group__title--static">
          <span class="sys-eyebrow">
            {{ t('panels.character.sections.attribute') }}
            <template v-if="player.attributePoints > 0">({{ t('panels.character.labels.attributePointsRemaining', { count: player.attributePoints }) }})</template>
          </span>
        </h4>

        <!-- Meridian figure (user art pass) — the five main stats sit
             on the martial art instead of a list. The dot lands on the
             body point, the card extends sideways; allocate (+)/MAX
             behavior identical to the old list rows. -->
        <div class="meridian">
          <img class="meridian__figure" :src="MERIDIAN_FIGURE_SRC" alt="" aria-hidden="true" />

          <div
            v-for="stat in attributeStats"
            :key="stat.key"
            class="meridian__node"
            :class="meridianNode(stat.key).modifier"
            :data-stat="stat.key"
            :style="meridianNode(stat.key).style"
            v-tooltip="stat.description"
          >
            <span class="meridian__node-dot" aria-hidden="true" />
            <span class="meridian__node-card">
              <span class="meridian__node-label">{{ stat.label }}</span>
              <span class="meridian__node-row">
                <span class="meridian__node-value-col">
                  <span class="meridian__node-value">{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
                  <span v-if="isMainStat(stat.key) && isMainStatCapped(stat.key as MainStatKey)" class="meridian__node-max">{{ t('panels.character.labels.max') }}</span>
                </span>
                <GameButton
                  v-if="isMainStat(stat.key) && player.attributePoints > 0 && !isMainStatCapped(stat.key as MainStatKey)"
                  class="meridian__node-allocate"
                  shape="circle"
                  size="sm"
                  :aria-label="stat.label"
                  :disabled="inBattle"
                  @click="allocate(stat.key as MainStatKey)"
                >
                  +
                </GameButton>
              </span>
            </span>
          </div>
        </div>
      </div>
      <div class="stat-group">
        <h4 class="stat-group__title stat-group__title--static"><span class="sys-eyebrow">{{ t('panels.character.sections.elements') }}</span></h4>

        <div class="element-wheel">
          <img class="element-wheel__ring element-wheel__ring--orbs" :src="formationOrbsUrl" alt="" aria-hidden="true" />
          <img class="element-wheel__ring element-wheel__ring--band" :src="formationRingUrl" alt="" aria-hidden="true" />
          <img class="element-wheel__ring element-wheel__ring--inner" :src="formationStarUrl" alt="" aria-hidden="true" />
          <svg class="element-wheel__star" viewBox="0 0 100 100" aria-hidden="true">
            <polygon class="element-wheel__star-line" points="50,15 73,76 14,40 86,40 27,76" />
          </svg>
          <div
            v-for="row in elementRows"
            :key="row.element"
            class="element-node"
            :data-element="row.element"
            :class="`element-node--${row.element}`"
            :style="{ '--node-color': row.color }"
            v-tooltip="{ kind: 'element', element: row.element, title: row.label, description: t('panels.character.tooltips.elementStat', { power: Math.round(row.power), resistance: Math.round(row.resistance), penetration: Math.round(row.penetration) }) }"
          >
            <img class="element-node__disc" :src="resolveAssetUrl(`/assets/ui/elements/el-${row.element}.png`)" :alt="row.label" />
          </div>

          <div
            class="element-node element-node--primordial"
            :style="{ '--node-color': PRIMORDIAL_COLOR }"
            v-tooltip="{ kind: 'element', element: 'primordial', title: t('panels.character.tooltips.primordialTitle'), description: t('panels.character.tooltips.primordialStat', { power: formatNumber(Math.round(player.finalStats.primordialPower)) }) }"
          >
            <img class="element-node__disc" :src="primordialDiscUrl" :alt="t('panels.character.tooltips.primordialTitle')" />
            <span class="element-node__core">{{ formatNumber(Math.round(player.finalStats.primordialPower)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Study Mode SS8.2 - the bottom action rail gathers the panel's
         contextual controls (detail card toggle, Quan Khi re-entry,
         pending attribute points). -->
    <footer class="character-panel__action-rail">
      <button
        type="button"
        class="character-panel__details-btn"
        :class="{ 'character-panel__details-btn--open': ui.characterDetailOpen }"
        @click="ui.toggleCharacterDetail()"
      >{{ t('panels.character.actions.details') }}</button>

      <button
        v-if="showQuanKhiEntry"
        type="button"
        class="character-panel__quan-khi-btn"
        @click="openQuanKhi"
      >
        {{ t('panels.character.actions.quanKhi') }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.character-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Surface is owned by the drawer (.ink-drawer) — the panel itself
     stays transparent; --paper-* reads resolve to the dark remap. */
  color: var(--paper-text);
  font-family: var(--font-body);
}

.character-panel__header {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--paper-line);
  background:
    var(--paper-grain) 0 0 / 140px 140px repeat,
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 100%);
}

/* WS3 vùng 1 — chân dung + tên/Cảnh Giới/chiến lực, nằm ngang thoải mái. */
.character-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.character-panel__figure {
  position: relative;
  flex: 0 0 auto;
  width: 150px;
  height: 156px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Huyen Kim SS15 - the way's element disc sits behind the portrait
   (formation ring fallback before a path commits an element). */
.character-panel__figure-disc {
  position: absolute;
  left: 50%;
  top: 52%;
  width: 92%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  opacity: 0.85;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--aura, var(--hk-gold)) 30%, transparent));
  pointer-events: none;
}

.character-panel__figure-sprite {
  z-index: 1;
  pointer-events: none;
}

.character-panel__figure-aura {
  position: absolute;
  inset: -18%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--aura), transparent 70%);
  opacity: 0.35;
  filter: blur(5px);
  animation: character-figure-breathe 5s ease-in-out infinite;
}

@keyframes character-figure-breathe {
  0%, 100% { transform: scale(1); opacity: 0.28; }
  50% { transform: scale(1.1); opacity: 0.5; }
}

.character-panel__identity-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.character-panel__name {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--paper-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.character-panel__realm-line {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--jade);
}

.character-panel__power {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  line-height: 1.1;
}

/* "Chiến Lực" là con số tổng hợp người chơi quan tâm nhất trên cả panel
   (frontend-design pass 2026-08-30: "the hero is a thesis") — phóng to
   hẳn so với các số khác thay vì cùng cỡ text-lg với tên thiên phú. */
.character-panel__power-value {
  /* M-UI-SYSTEM: display-font numerals + tabular; fallback keeps the
     ink font when system-theme.css is not loaded (safe degrade). */
  font-family: var(--sys-font-display, var(--font-display));
  font-variant-numeric: tabular-nums;
  font-size: var(--text-display);
  font-weight: 700;
  color: var(--sys-text, var(--paper-text));
  text-shadow: 0 0 12px color-mix(in srgb, var(--sys-cyan, var(--mineral-gold)) 35%, transparent);
}

.character-panel__power-label {
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Study Mode SS8.2 - action rail: contextual controls pinned at the
   drawer foot so the scroll body stays pure information. */
.character-panel__action-rail {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--paper-line);
  background: color-mix(in srgb, var(--paper-100) 70%, transparent);
}

.character-panel__quan-khi-btn {
  align-self: flex-start;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--hk-gold) 12%, var(--paper-100));
  color: var(--hk-gold-bright);
  border: 1px solid var(--hk-gold-muted);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
}

.character-panel__quan-khi-btn:hover {
  border-color: var(--hk-gold);
  color: var(--hk-gold-radiant);
}

/* Thiên Phú đã chọn (talent-direction-choice-plan §7) — khối nhỏ dưới
   vùng nhận diện, tông màu theo rarity giống thẻ roll lúc tạo nhân vật
   (CharacterCreationScreen.vue's talent-tier-*). */
.character-panel__talents {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.character-panel__talents-title {
  margin: 0;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: var(--paper-eyebrow);
}

/* Huyen Kim SS15 - talents render as compact seals: tier-tinted
   border + rarity chip + name; the description lives in the hover
   tooltip instead of a text-heavy card. Tier colors keep the existing
   --rank-color-* ladder (same vocabulary as creation). */
.character-panel__talent-seals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.talent-seal {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--talent-tier-color, var(--hk-gold-muted)) 70%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--talent-tier-color, var(--hk-gold-muted)) 10%, var(--paper-100));
}

.talent-seal__rarity.sys-tag {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--talent-tier-color, var(--hk-gold));
  --sys-tag-line: color-mix(in srgb, var(--talent-tier-color, var(--hk-gold)) 70%, transparent);
}

.talent-seal__name {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--paper-text);
}

.talent-tier-pham { --talent-tier-color: var(--rank-color-1); }
.talent-tier-linh { --talent-tier-color: var(--rank-color-3); }
.talent-tier-dia { --talent-tier-color: var(--rank-color-5); }
.talent-tier-thien { --talent-tier-color: var(--rank-color-7); }
.talent-tier-di { --talent-tier-color: var(--rank-color-8); }

/* WS3 — section Trang Bị độc lập dưới header, paperdoll dùng trọn
   chiều rộng panel. */
.character-panel__section-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.character-panel__cultivation-path {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ink-line);
}

.character-panel__path-hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.character-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-3);
  font-size: var(--text-body);
  scrollbar-width: none;
}

.character-panel__body::-webkit-scrollbar { display: none; }

/* Mỗi nhóm chỉ số giờ là 1 CARD thật (viền + nền giấy tinting nhẹ) thay
   vì khối phẳng chỉ phân bằng hairline — cùng ngôn ngữ thị giác với
   .qi-hall__preview-card/.resource-card đã dùng ở các building panel
   (frontend-design pass 2026-08-30, đồng bộ toàn app). */
.stat-group {
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--hk-border-muted, var(--paper-line));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--paper-50) 65%, transparent);
}

/* Tiêu đề nhóm — vạch cinnabar bên trái + cỡ chữ lớn hơn CHÍNH các dòng
   nó tiêu đề (trước đây tiêu đề 13px lại NHỎ HƠN dòng nội dung 14px bên
   dưới, đảo ngược tôn ti thị giác). */
.stat-group__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0 0 var(--space-2);
  padding-left: 9px;
  border-left: 3px solid var(--hk-gold-muted, var(--paper-eyebrow));
  font: 700 var(--text-md) var(--font-display);
  letter-spacing: 0.02em;
  color: var(--paper-text);
  cursor: default;
}

/* Button opening the detail stat card docked beside the drawer (LeftPanel). */
/* Button opening the detail stat card docked beside the drawer
   (LeftPanel) - lives on the action rail. */
.character-panel__details-btn {
  flex: 0 0 auto;
  padding: 3px 10px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: var(--paper-100);
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.character-panel__details-btn:hover {
  color: var(--hk-gold-bright);
  border-color: var(--hk-gold-muted);
}

.character-panel__details-btn--open {
  color: var(--hk-gold-bright);
  border-color: var(--hk-gold);
  background: color-mix(in srgb, var(--hk-gold) 12%, var(--paper-100));
}

.stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.stat-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding: 7px 0;
  border-bottom: 1px solid var(--paper-line);
  font-size: var(--text-md);
}

.stat-list li > span:first-child {
  color: var(--paper-text-soft);
}

.stat-list li > span:last-child {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--paper-text);
}

/* ============================================================
   MERIDIAN FIGURE — five main stats anchored on the martial art
   (user art pass). The dot marks the body point; the info card
   extends sideways (never clips: --left modifier mirrors it).
   ============================================================ */

/* Height-driven width cap: the 904x1024 figure keeps aspect (0.8828),
   so capping width by viewport height keeps all five node cards inside
   the first drawer viewport on short screens while wide screens still
   get the full-width figure. */
.meridian {
  position: relative;
  /* Detail stats moved to the side card — the figure now shares the
     drawer with just Ngu Hanh, so it shrinks to keep the whole block
     inside one viewport (user feedback: card was too big). */
  width: min(100%, calc(30vh * 0.8828), 300px);
  /* aspect-ratio holds the block height even if the figure 404s or is
     still loading — without it the 0x0 node anchors collapse to the
     section top and all five cards stack on each other. */
  aspect-ratio: 904 / 1024;
  margin-inline: auto;
  container-type: inline-size;
  container-name: meridian;
}

/* The jade figure is inherently dark (avg luminance ~35) — a faint
   cool moon-glow behind it lifts the silhouette off the dark drawer
   without changing the art itself. */
.meridian::before {
  content: '';
  position: absolute;
  inset: 4% 8%;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--azure, #7fb4c7) 16%, transparent),
    transparent 72%
  );
  pointer-events: none;
}

.meridian__figure {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
}

.meridian__node {
  position: absolute;
  width: 0;
  height: 0;
}

.meridian__node-dot {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--hk-jade, var(--sys-cyan, var(--mineral-gold)));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--ink-950) 55%, transparent),
    0 0 7px var(--hk-jade, var(--sys-cyan, var(--mineral-gold)));
}

/* Compact vertical card (label over value+button) — ~80px wide so the
   five callouts fit in staggered bands around the figure without
   overlapping each other (horizontal cards were ~65% of block width
   and collided). */
.meridian__node-card {
  position: absolute;
  left: 12px;
  top: 0;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 8px;
  border: 1px solid var(--sys-line-soft, var(--paper-line));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--sys-surface-solid, var(--paper-100)) 86%, transparent);
  white-space: nowrap;
}

.meridian__node-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.meridian__node--left .meridian__node-card {
  left: auto;
  right: 12px;
}

.meridian__node--below .meridian__node-card {
  left: 0;
  top: 12px;
  transform: none;
}

.meridian__node--above .meridian__node-card {
  left: 0;
  top: auto;
  bottom: 12px;
  transform: none;
}

.meridian__node-label {
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  color: var(--sys-text-muted, var(--paper-text-soft));
}

.meridian__node-value-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}

.meridian__node-value {
  font-family: var(--sys-font-display, var(--font-body));
  font-size: var(--text-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--sys-text, var(--paper-text));
}

.meridian__node-max {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--sys-warn, var(--gold-700));
}

/* Element wheel - the Ngu Hanh formation: a gilt formation ring as the
   base, a plain pentagram linking 5 vertices (no arrows - the game
   dropped the generating/overcoming cycle), 5 element medallions on
   the pentagon points, the Hon Nguyen taiji at center holding Power.
   No caption text - the art medallion identifies the element itself;
   detail lives in the hover banner tooltip. Square block scales
   with the drawer (aspect-ratio keeps proportions, no distortion). */
.element-wheel {
  position: relative;
  width: min(100%, 290px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.element-wheel__ring {
  position: absolute;
  left: 50%;
  top: 50%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* 3 concentric formation rings from the same sprite sheet: the orb
   ring frames the pentagon outside the discs, the star-chart band
   passes under the disc circle, the thin star ring encircles the
   taiji. */
.element-wheel__ring--orbs { width: 96%; opacity: 0.45; }
.element-wheel__ring--band { width: 80%; opacity: 0.5; }
.element-wheel__ring--inner { width: 56%; opacity: 0.5; }

.element-wheel__star {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.element-wheel__star-line {
  fill: none;
  stroke: var(--mineral-gold, #b79653);
  stroke-width: 0.55;
  opacity: 0.45;
}

.element-node {
  position: absolute;
  width: 26%;
  transform: translate(-50%, -50%);
  cursor: default;
}

.element-node__disc {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--node-color) 45%, transparent));
  transition: transform 0.15s ease, filter 0.15s ease;
}

.element-node:hover .element-node__disc {
  transform: scale(1.07);
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--node-color) 70%, transparent));
}

/* Pentagon points — disc centers match the star polygon vertices. */
.element-node--fire { left: 50%; top: 15%; }
.element-node--earth { left: 86%; top: 40%; }
.element-node--metal { left: 73%; top: 76%; }
.element-node--water { left: 27%; top: 76%; }
.element-node--wood { left: 14%; top: 40%; }

.element-node--primordial {
  left: 50%;
  top: 50%;
  width: 28%;
}

/* Hon Nguyen Power - seal chip centered on the taiji (the disc is
   half black/half white, a bare number can't read on both halves). */
.element-node__core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--mineral-gold, #b79653) 60%, transparent);
  border-radius: 999px;
  background: rgba(16, 14, 10, 0.78);
  color: var(--gold-300, #ffd54f);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
