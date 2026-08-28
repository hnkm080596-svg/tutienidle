<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import PlayerPortrait from '../common/PlayerPortrait.vue'
import GamePanel from '../common/GamePanel.vue'
import GameButton from '../common/GameButton.vue'
import type { Stats } from '@/core/stats/StatBlock'
import { formatNumber } from '@/core/format/NumberFormatter'
import { BASE_STAT_LABELS, formatStat, type StatCategory } from '@/core/stats/StatLabels'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import { MAIN_STAT_KEYS, type MainStatKey } from '@/core/stats/StatTypes'
import { getMainStatCap } from '@/core/stats/StatCap'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import { getTalentDefinition } from '@/data/talent/Talents'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'

const player = usePlayerStore()
const ui = useUiStore()
const { allocateAttributePoint } = useLoadoutActions()

// Entry point Quán Khí (Task 7 review fix, Critical) — QuanKhiPanel.vue chỉ
// dùng đường mở duy nhất từ trước là useTribulation.ts's triggerQuanKhi(),
// bắn 1 lần lúc Phàm Nhân đột phá lên Kiếm Tu/Pháp Tu. Sau đó không còn nút
// nào mở lại panel (commandWheelCatalog.ts đã bỏ slot quan_khi với comment
// hứa "mở qua nút riêng trong Character Panel" nhưng chưa ai làm) — khiến
// UI đổi đường Kiếm Tu (Kiếm Trận/Bạt Kiếm) mới thêm ở Task 7 không ai bấm
// tới được. Chỉ hiện khi đã chọn Kiếm Tu (route switch chỉ có ý nghĩa ở đó).
const showQuanKhiEntry = computed(() => player.cultivationPath === 'kiem_tu')

function openQuanKhi() {
  ui.openStandalonePanel('quan_khi')
}

const chosenKit = computed(() => player.cultivationPath ? CULTIVATION_PATH_KITS[player.cultivationPath] : undefined)

// Thiên Phú (talent-direction-choice-plan §7) — hiển thị thiên phú đã chọn
// (tên + description) đọc từ selectedTalentIds qua getTalentDefinition;
// id lạ trong save cũ bị bỏ qua an toàn (undefined → filter loại).
const selectedTalents = computed(() =>
  player.selectedTalentIds
    .map((talentId) => getTalentDefinition(talentId))
    .filter((talent): talent is TalentDefinition => talent !== undefined),
)

// UI redesign mục 11 (Character) — silhouette nhân vật ở cột giữa
// header nhuộm màu theo hệ của path đã chọn (Kiếm Tu khai `element`
// cố định; Pháp Tu để trống vì đa hệ qua Element Loadout — xem
// CultivationPathKit.ts) — fallback vàng trung tính khi CHƯA chọn path
// (còn ở Phàm Nhân) hoặc đã chọn Pháp Tu.
const characterAuraColor = computed(() =>
    chosenKit.value?.element ? ELEMENT_COLOR_VARS[chosenKit.value.element] : 'var(--chrome-500)',
)

// Chân dung tĩnh (2026-08-26, dong-fu plan Workstream A) — PNG mortal
// mới player-mortal-v1.png qua PlayerPortrait; ẢNH TĨNH, không áp
// animation tu luyện (khác trigger cultivate giữa Động Phủ).
const characterPortraitHeight = 104

// Đọc tên skill qua skillManager (LEARNED skills, public) thay vì
// GameManager.skillTemplates (private) — sau chooseCultivationPath(),
// cả 3 skill của kit đã chắc chắn có trong skillManager.

const realm = computed(() => getCurrentRealm(player.realmId))

// Nhóm theo category để hiện thành từng khối danh sách riêng — dễ
// quét mắt hơn 1 khối phẳng chia 2 cột (không dùng bảng ô/table).
// BASE_STAT_LABELS/StatCategory trích ra @/core/stats/StatLabels.ts
// (2026-08-15, tooltip Tâm Pháp dùng chung).

const STAT_CATEGORY_LABELS: Record<StatCategory, string> = {
  combat: 'Chiến Đấu',
  survival: 'Sinh Tồn & Tài Nguyên',
  special: 'Tỉ Lệ Đặc Biệt',
  attribute: 'Thuộc Tính',
  defense_advanced: 'Phòng Thủ Nâng Cao',
}

const STAT_CATEGORY_ORDER: StatCategory[] = ['combat', 'survival', 'special', 'attribute', 'defense_advanced']

const statGroups = computed(() =>
  STAT_CATEGORY_ORDER.map(category => ({
    category,

    label: STAT_CATEGORY_LABELS[category],

    stats: BASE_STAT_LABELS.filter(stat => stat.category === category),
  })),
)

// WS3 Redesign Character Panel (2026-08-24) — chỉ số chia TAB thay vì
// xếp 5 nhóm + Ngũ Hành + đan dược liên tiếp khiến mọi thứ phải nhỏ lại.
// 4 tab: Thuộc Tính (attribute, có nút +) | Chiến Đấu (combat+special)
// | Phòng Thủ & Sinh Tồn (defense_advanced+survival) | Ngũ Hành & Khác
// (chips + hiệu ứng đan dược vĩnh viễn).

// PLAN HOÀN CHỈNH mục 4 — UI Stat Cap: KHÔNG hiện "24/30", chỉ hiện số
// + chữ "MAX" (vàng) ngay bên dưới khi ĐẦY. Trần tính trên baseStats
// (phần người chơi TỰ đầu tư) chứ không phải finalStats đang hiện ở
// cột giá trị — equipment/pill vẫn có thể đẩy finalStats cao hơn trần
// này bình thường, trần chỉ chặn HÀNH ĐỘNG phân phối điểm.
function isMainStat(key: string): key is MainStatKey {
  return (MAIN_STAT_KEYS as string[]).includes(key)
}

function mainStatCap(): number {
  return getMainStatCap(player.realmId)
}

function isMainStatCapped(key: MainStatKey): boolean {
  return player.baseStats[key] >= mainStatCap()
}

function allocate(key: MainStatKey) {
  allocateAttributePoint(key)
}

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

// "Chiến Lực" — chỉ số tổng hợp THUẦN HIỂN THỊ (không dùng ở đâu khác
// trong game logic/combat thật), lấy cảm hứng từ số "Mastery" tổng
// trong màn Combat Attributes tham khảo. Hệ số minh hoạ, dễ tinh
// chỉnh lại sau khi thấy số thực tế qua nhiều mốc cảnh giới.
const combatPower = computed(() => {
  const stats = player.finalStats

  return Math.round(
    stats.attack * 2 +
    stats.defense * 1.5 +
    stats.maxHp * 0.1 +
    stats.maxMp * 0.05 +
    stats.criticalRate * 500 +
    stats.criticalDamage * 300 +
    stats.attackSpeed * 200,
  )
})

// Thay thế pillUsageRows cũ (đếm SỐ LẦN uống mỗi pill) — giờ hiện
// TIẾN ĐỘ TRẦN thật theo cảnh giới (RealmData.attributeCap): mỗi
// stat có bonus vĩnh viễn cộng dồn từ pill (bucket
// `pill-permanent:${stat}`, xem PillSystem.ts) hiện "Tên Stat: X/cap".
// Ẩn hoàn toàn nếu cảnh giới hiện tại chưa thiết kế trần.
const pillPermanentRows = computed(() => {
  const cap = realm.value.attributeCap

  if (cap === undefined) {
    return []
  }

  return player.modifiers
    .filter(modifier => modifier.id.startsWith('pill-permanent:'))
    .map(modifier => ({
      stat: modifier.stat,
      label: BASE_STAT_LABELS.find(entry => entry.key === modifier.stat)?.label ?? modifier.stat,
      value: modifier.flat ?? 0,
      cap,
    }))
})
</script>

<template>
  <GamePanel class="character-panel" variant="ornate" padding="none">
    <!-- Tu vi và Đột Phá thuộc hoàn toàn về panel Cảnh Giới. Nhân Vật
         chỉ giữ nhận diện, chiến lực và chỉ số để tránh lặp UI. -->
    <div class="character-panel__header">
      <div class="character-panel__identity">
        <div class="character-panel__figure" :style="{ '--aura': characterAuraColor }">
          <span class="character-panel__figure-aura" />

          <PlayerPortrait
            class="character-panel__figure-sprite"
            variant="portrait"
            :height="characterPortraitHeight"
          />
        </div>

        <div class="character-panel__identity-text">
          <h3 class="character-panel__name">{{ player.name }}</h3>

          <p class="character-panel__realm-line">{{ realm.name }} · Tầng {{ player.realmLevel }}</p>

          <p class="character-panel__power">
            <span class="character-panel__power-value">{{ formatNumber(combatPower) }}</span>
            <span class="character-panel__power-label">Chiến Lực</span>
          </p>

          <button
            v-if="showQuanKhiEntry"
            type="button"
            class="character-panel__quan-khi-btn"
            @click="openQuanKhi"
          >
            Quán Khí
          </button>
        </div>
      </div>

      <!-- Thiên Phú đã chọn (talent-direction-choice-plan §7) — quyết định
           hướng Đạo duy nhất lúc tạo nhân vật, luôn hiển thị để người
           chơi nhớ mình đang đi đường nào. -->
      <div v-if="selectedTalents.length > 0" class="character-panel__talents">
        <div
          v-for="talent in selectedTalents"
          :key="talent.id"
          class="talent-block"
          :class="`talent-tier-${talent.rarity}`"
        >
          <span class="talent-block__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span>
          <span class="talent-block__name">{{ talent.name }}</span>
          <p class="talent-block__description">{{ talent.description }}</p>
        </div>
      </div>
    </div>

    <div class="character-panel__body scrollfade">
        <div v-for="group in statGroups" :key="group.category" class="stat-group">
        <h4 class="stat-group__title stat-group__title--static">
          {{ group.label }}
          <template v-if="group.category === 'attribute' && player.attributePoints > 0">(còn {{ player.attributePoints }} điểm)</template>
        </h4>

        <ul class="stat-list">
          <li v-for="stat in group.stats" :key="stat.key" v-tooltip="stat.description">
            <span>{{ stat.label }}</span>

            <!-- PLAN HOÀN CHỈNH mục 2/4 — chỉ Main Stat (category
                 'attribute') mới có nút +/nhãn MAX, mọi stat khác giữ
                 nguyên hiển thị chỉ-đọc như cũ. -->
            <span v-if="isMainStat(stat.key)" class="stat-list__main-stat">
              <span class="stat-list__value-col">
                <span>{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
                <span v-if="isMainStatCapped(stat.key as MainStatKey)" class="stat-list__max">MAX</span>
              </span>

              <GameButton
                v-if="player.attributePoints > 0 && !isMainStatCapped(stat.key as MainStatKey)"
                class="stat-list__allocate"
                shape="circle"
                size="sm"
                @click="allocate(stat.key as MainStatKey)"
              >
                +
              </GameButton>
            </span>

            <span v-else>{{ formatStat(stat.key, player.finalStats[stat.key]) }}</span>
          </li>
        </ul>
      </div>
      <div class="stat-group">
        <h4 class="stat-group__title stat-group__title--static">Ngũ Hành</h4>

        <div class="element-chips">
          <div
            v-for="row in elementRows"
            :key="row.element"
            class="element-chip"
            :data-element="row.element"
            :class="`element-chip--${row.element}`"
            :style="{ '--chip-color': row.color }"
            v-tooltip="{ title: row.label, description: `Power ${Math.round(row.power)} · Kháng ${Math.round(row.resistance)} · Xuyên ${Math.round(row.penetration)}` }"
          >
            <span class="element-chip__dot" />
            <span class="element-chip__label">{{ row.label }}</span>
            <span class="element-chip__value">{{ formatNumber(Math.round(row.power)) }}</span>
          </div>

          <div
            class="element-chip"
            :style="{ '--chip-color': PRIMORDIAL_COLOR }"
            v-tooltip="{ title: 'Hỗn Nguyên', description: 'Bỏ qua mọi phòng thủ.' }"
          >
            <span class="element-chip__dot" />
            <span class="element-chip__label">Hỗn Nguyên</span>
            <span class="element-chip__value">{{ formatNumber(Math.round(player.finalStats.primordialPower)) }}</span>
          </div>
        </div>
      </div>

      <div v-if="pillPermanentRows.length > 0" class="pill-usage">
        <span v-for="row in pillPermanentRows" :key="row.stat" class="pill-usage__item">
          {{ row.label }}: {{ row.value }}/{{ row.cap }}
        </span>
      </div>
    </div>
  </GamePanel>
</template>

<style scoped>
.character-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.character-panel__header {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--ink-line);
  background: linear-gradient(180deg, var(--ink-800), var(--ink-900));
}

/* WS3 vùng 1 — chân dung + tên/cảnh giới/chiến lực, nằm ngang thoải mái. */
.character-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.character-panel__figure {
  position: relative;
  flex: 0 0 auto;
  width: 112px;
  height: 116px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.character-panel__figure-sprite {
  z-index: 1;
  pointer-events: none;
}

.character-panel__figure-aura {
  position: absolute;
  inset: -20%;
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
  color: var(--text-primary);
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
  color: var(--chrome-100);
}

.character-panel__power {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  line-height: 1.1;
}

.character-panel__power-value {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--chrome-100);
  text-shadow: var(--shadow-glow-chrome);
}

.character-panel__power-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.character-panel__quan-khi-btn {
  align-self: flex-start;
  margin-top: var(--space-1);
  padding: 3px 10px;
  background: var(--ink-800);
  color: var(--gold-300);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  cursor: pointer;
}

.character-panel__quan-khi-btn:hover {
  background: var(--ink-700, var(--ink-800));
}

/* Thiên Phú đã chọn (talent-direction-choice-plan §7) — khối nhỏ dưới
   vùng nhận diện, tông màu theo rarity giống thẻ roll lúc tạo nhân vật
   (CharacterCreationScreen.vue's talent-tier-*). */
.character-panel__talents {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.talent-block {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--ink-line);
  border-radius: var(--radius-md);
  background: var(--ink-900);
}

.talent-block__rarity {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.talent-block__name {
  display: block;
  margin: 4px 0 2px;
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--text-primary);
}

.talent-block__description {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.talent-tier-pham .talent-block__rarity { color: var(--rank-color-1); }
.talent-tier-linh .talent-block__rarity { color: var(--rank-color-3); }
.talent-tier-dia .talent-block__rarity { color: var(--rank-color-5); }
.talent-tier-thien .talent-block__rarity { color: var(--rank-color-7); }
.talent-tier-di .talent-block__rarity { color: var(--rank-color-8); }

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

.stat-group {
  margin-bottom: var(--space-4);
}

.stat-group__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0 0 var(--space-1);
  padding: var(--space-1) 0;
  background: none;
  border: none;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--chrome-500);
  cursor: default;
  font-family: var(--font-body);
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
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--ink-line-soft);
}

.stat-list__main-stat {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-list__value-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}

/* PLAN HOÀN CHỈNH mục 4 — "MAX" màu vàng, nằm NGAY DƯỚI giá trị,
   KHÔNG hiện dạng X/Y hay dòng "Max: Y" riêng. */
.stat-list__max {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--chrome-100);
}

.stat-list__allocate {
  flex: 0 0 auto;
  font-size: var(--text-body);
  line-height: 1;
}

/* Fit-refactor đợt 3 — pentagram scale theo bề rộng panel thật (container
   query nội bộ) thay vì px cứng 310px. Thiết kế gốc 310px giữ nguyên tỉ lệ
   ngũ giác, chỉ co giãn toàn khối. */
.element-chips {
  position: relative;
  width: 100%;
  max-width: 310px;
  height: clamp(180px, 34vh, 260px);
  margin: 0 auto;
  container-type: inline-size;
  container-name: element-chips;
}

.element-chip {
  position: absolute;
  width: 28%;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  font-size: var(--text-xs);
}

.element-chip--fire { left: 50%; top: 0; transform: translateX(-50%); }
.element-chip--wood { left: 5%; top: 24%; }
.element-chip--earth { right: 5%; top: 24%; }
.element-chip--water { left: 20%; bottom: 6%; }
.element-chip--metal { right: 20%; bottom: 6%; }
.element-chip--wind { left: calc(50% - 30% - 2%); top: 43%; }
.element-chip--lightning { right: calc(50% - 30% - 2%); top: 43%; }
.element-chip:not([data-element]) { left: 50%; top: 60%; transform: translateX(-50%); }

/* Panel hẹp: chip 28% < 86px gốc → thu label, giãn chip chiếm trọn để
   chữ vẫn đọc được (floor --text-xs đã có từ token). */
@container element-chips (max-width: 260px) {
  .element-chip { width: 40%; }
  .element-chip--water { left: 5%; bottom: 2%; }
  .element-chip--metal { right: 5%; bottom: 2%; }
  .element-chip--wind { left: 8%; top: 55%; }
  .element-chip--lightning { right: 8%; top: 55%; }
}

.element-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-color);
  box-shadow: 0 0 6px var(--chip-color);
  flex: 0 0 auto;
}

.element-chip__label {
  flex: 1;
  min-width: 0;
  color: var(--chip-color);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.element-chip__value {
  min-width: 0;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-usage {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  max-width: 100%;
}

.pill-usage__item {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid var(--ink-line);
  border-radius: 3px;
  color: var(--text-secondary);
  white-space: nowrap;
}
</style>
