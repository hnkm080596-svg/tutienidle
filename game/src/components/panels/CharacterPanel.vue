<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { getCurrentRealm, getNextRealm, BASE_CULTIVATION_PER_SECOND } from '@/core/realm/realmSystem'
import TechniqueSlotCard from './loadout-sections/TechniqueSlotCard.vue'
import EquipmentPaperdoll from './EquipmentPaperdoll.vue'
import AtlasSprite from '../common/AtlasSprite.vue'
import type { Stats } from '@/core/stats/StatBlock'
import { formatNumber } from '@/core/format/NumberFormatter'
import { BASE_STAT_LABELS, formatStat, type StatCategory } from '@/core/stats/StatLabels'
import { ELEMENT_LABELS, ELEMENT_COLOR_VARS, ELEMENT_ORDER } from '@/core/element/ElementLabels'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import { MAIN_STAT_KEYS, type MainStatKey } from '@/core/stats/StatTypes'
import { getMainStatCap } from '@/core/stats/StatCap'
import { useLoadoutActions } from '@/composables/useLoadoutActions'
import { useBreakthrough } from '@/composables/useBreakthrough'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useUiStore } from '@/stores/ui'
import { useTribulation } from '@/composables/useTribulation'

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { allocateAttributePoint } = useLoadoutActions()
const { breakthrough } = useBreakthrough()
const breakthroughRequirement = useBreakthroughRequirementStore()
const ui = useUiStore()
const { triggerQuanKhi } = useTribulation()

// Quán Khí (2026-08-20, Realm Passive & Pressure follow-up) — mở SỚM ở
// tầng 12 (KHÔNG còn chờ maxLevel=18), chừa 12-18 làm cửa sổ "chơi
// tiếp" (Luyện Thể tầng cuối cũng mở ở 12, xem data/realm/LuyenThe.ts)
// trước khi quyết định. Nút bấm hiện bên cạnh Đột Phá (xem
// .character-panel__breakthrough), mở QuanKhiPanel.vue thay vì liệt kê
// path-choices ngay tại đây như trước.
const QUAN_KHI_UNLOCK_TANG = 12

// Nghi Lễ Nhập Môn (2026-08-16) — chọn path. Save cũ (tạo trước khi
// Phàm Nhân tồn tại, đã ở qi_refining+ mà chưa từng chọn path) là NGOẠI
// LỆ — coi như nghi lễ đã qua, mở ngay không cần lùi về Phàm Nhân (Phàm
// Nhân->Luyện Khí là chuyển tiếp 1 chiều, không có đường quay lại).
const canChooseCultivationPath = computed(() => {
  if (player.cultivationPath) {
    return false
  }

  if (player.realmId === 'pham_nhan') {
    return player.realmLevel >= QUAN_KHI_UNLOCK_TANG
  }

  return true
})

function openQuanKhi() {
  triggerQuanKhi()
}

const chosenKit = computed(() => player.cultivationPath ? CULTIVATION_PATH_KITS[player.cultivationPath] : undefined)

// UI redesign mục 11 (Character) — silhouette nhân vật ở cột giữa
// header nhuộm màu theo hệ của path đã chọn (Kiếm Tu khai `element`
// cố định; Pháp Tu để trống vì đa hệ qua Element Loadout — xem
// CultivationPathKit.ts) — fallback vàng trung tính khi CHƯA chọn path
// (còn ở Phàm Nhân) hoặc đã chọn Pháp Tu.
const characterAuraColor = computed(() =>
  chosenKit.value?.element ? ELEMENT_COLOR_VARS[chosenKit.value.element] : 'var(--gold-500)',
)

// Sprite thật (2026-08-20, thay khối robe/head CSS placeholder) — cùng
// atlas idle/cultivate MainScene.ts dùng ở giữa Động Phủ. LUÔN dùng
// idle ở đây (khác DongFuScene.vue's dongfu-player, nơi đổi theo
// player.isCultivating) — đây chỉ là chân dung nhỏ trong panel, không
// phải nơi thể hiện trạng thái ngồi thiền.
const characterAtlasUrl = '/assets/cultivate.json'
const characterImageUrl = '/assets/cultivate.png'

// Đọc tên skill qua skillManager (LEARNED skills, public) thay vì
// GameManager.skillTemplates (private) — sau chooseCultivationPath(),
// cả 3 skill của kit đã chắc chắn có trong skillManager.
const chosenKitSkillNames = computed(() => {
  stateVersion.value

  // Pháp Tu Redesign — Pháp Tu không còn skillIds cố định (skill mở
  // qua Node Tree), CHỈ Kiếm Tu còn khai.
  return (chosenKit.value?.skillIds ?? []).map(skillId => gameManager.skillManager.get(skillId)?.name ?? skillId)
})

// Đọc technique THẬT qua techniqueManager (không phải chỉ id tĩnh
// trong kit) — Pháp Tu Redesign (magicpath): Tâm Pháp giờ thuần lớp
// giới thiệu, hiện description hoa mỹ thay vì hiệu ứng đột phá cũ.
const chosenTechnique = computed(() => {
  stateVersion.value

  const kit = chosenKit.value

  if (!kit) {
    return undefined
  }

  return gameManager.techniqueManager.get(kit.techniqueId)
})

// Đột Phá Trúc Cơ (mục 3/4 spec) — dời từ BreakthroughButton.vue (overlay
// nổi giữa màn hình cũ, đã xoá) vào thẳng cột Cảnh Giới (2026-08-20,
// thay nút "Dừng Tu Luyện" đã bỏ — xem Work Stream 3, tu luyện giờ tự
// động hoàn toàn). Bỏ guard `!isFighting` cũ — CharacterPanel.vue chỉ
// render trong chrome Động Phủ, GameRoot.vue đã ẩn hẳn chrome này lúc
// combat (`v-if="!isCombatSceneActive"`), guard cũ thành thừa.
const canTriggerFoundation = computed(() => gameManager.canTriggerFoundationBreakthrough(player.$state))

const canTriggerRealm = computed(() => gameManager.canTriggerRealmBreakthrough(player.$state))

const nextRealmName = computed(() => getNextRealm(player.realmId)?.name ?? '')

// UI redesign mục 11/14 (Character đã hấp thu luôn "Tu Luyện" — không
// có LeftPanelMode riêng nào cho nó, xem tienhiep-ui-redesign memory
// Step 11) — spec mục 14 muốn 1 đồng hồ đếm ngược thật thay vì chỉ %.
// cultivationPerSecond CỐ ĐỊNH cho MỌI người chơi từ Pháp Tu Redesign
// (không còn bonus nào rút ngắn được nữa, xem realmSystem.ts's
// BASE_CULTIVATION_PER_SECOND) nên ETA tính thẳng từ đó — số giây thật
// có thể trải dài từ vài giây (Phàm Nhân) tới hàng chục ngày (đại cảnh
// giới cao, realmDurationMultiplier lớn), KHÔNG dùng cứng HH:MM:SS như
// mockup gốc (sẽ vỡ hình với ETA nhiều ngày) — tự chọn đơn vị theo độ
// lớn, giống format-mẫu formatDuration() đã có ở ExplorationPanel.vue/
// OfflineSummaryModal.vue (thêm biến thể "ngày" vì phạm vi ETA ở đây
// rộng hơn 2 chỗ kia nhiều).
const cultivationEtaLabel = computed(() => {
  if (player.cultivationProgress >= 1) {
    return 'Có thể đột phá'
  }

  const secondsLeft = (player.cultivationRequired - player.cultivation) / BASE_CULTIVATION_PER_SECOND

  const days = Math.floor(secondsLeft / 86400)
  const hours = Math.floor((secondsLeft % 86400) / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)

  if (days > 0) {
    return `Còn ${days} ngày ${hours} giờ`
  }

  if (hours > 0) {
    return `Còn ${hours} giờ ${minutes} phút`
  }

  if (minutes > 0) {
    return `Còn ${minutes} phút`
  }

  return `Còn ${Math.ceil(secondsLeft)} giây`
})

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
  <div class="character-panel">
    <!-- UI redesign mục 11 (Character) — 3 cột EQUIPMENT | CHARACTER |
         CẢNH GIỚI thay header 1 cột cũ (chỉ có tên/chiến lực/tu vi,
         KHÔNG có hình ảnh nhân vật hay trang bị nào). Panel trái hẹp
         (25% khung 16:9, xem DesignFrame.ts) nên 3 cột không chia đều
         như mockup gốc — cột Cảnh Giới rộng hơn để chứa thanh
         progress+nút, cột Trang Bị dùng lại NGUYÊN paperdoll 6-slot
         thật (SlotView/tooltip/unequip đầy đủ) thay vì vẽ giả 4 ô như
         mockup — tránh tạo component trùng lặp, chỉ thu nhỏ container. -->
    <div class="character-panel__header">
      <div class="character-panel__col character-panel__col--equipment">
        <span class="character-panel__col-label">Trang Bị</span>

        <div class="character-panel__mini-paperdoll">
          <EquipmentPaperdoll />
        </div>
      </div>

      <div class="character-panel__col character-panel__col--figure">
        <h3 class="character-panel__name">{{ player.name }}</h3>

        <div class="character-panel__figure" :style="{ '--aura': characterAuraColor }">
          <span class="character-panel__figure-aura" />

          <AtlasSprite
            class="character-panel__figure-sprite"
            :atlas-url="characterAtlasUrl"
            :image-url="characterImageUrl"
            :height="104"
            :image-scale="1.25"
          />
        </div>

        <div class="character-panel__power">
          <span class="character-panel__power-value">{{ formatNumber(combatPower) }}</span>
          <span class="character-panel__power-label">Chiến Lực</span>
        </div>
      </div>

      <div class="character-panel__col character-panel__col--realm">
        <span class="character-panel__col-label">Cảnh Giới</span>

        <p class="character-panel__realm">{{ realm.name }}</p>
        <p class="character-panel__realm-level">Tầng {{ player.realmLevel }}</p>

        <div class="character-panel__cultivation">
          <div class="character-panel__cultivation-bar">
            <div
              class="character-panel__cultivation-fill"
              :style="{ width: `${player.cultivationProgress * 100}%` }"
            />
          </div>

          <span class="character-panel__cultivation-label">Tu vi {{ (player.cultivationProgress * 100).toFixed(1) }}%</span>

          <span class="character-panel__cultivation-eta">{{ cultivationEtaLabel }}</span>
        </div>

        <label
          class="character-panel__auto-breakthrough"
          v-tooltip="'Tu vi đủ là tự động đột phá tiểu cảnh giới, không cần bấm tay. Không áp dụng cho Trúc Cơ/đại cảnh giới.'"
        >
          <input type="checkbox" :checked="ui.isAutoBreakthrough" @change="ui.toggleAutoBreakthrough()">
          Tự Động Đột Phá
        </label>

        <div
          v-if="player.cultivation >= player.cultivationRequired || canTriggerFoundation || canTriggerRealm || canChooseCultivationPath"
          class="character-panel__breakthrough"
        >
          <button
            v-if="player.cultivation >= player.cultivationRequired"
            type="button"
            class="character-panel__breakthrough-btn"
            v-tooltip="'Tu vi đã đủ — bấm để đột phá lên tầng kế tiếp.'"
            @click="breakthrough()"
          >
            Đột Phá
          </button>

          <!-- Quán Khí (2026-08-20) — mở panel chọn Pháp Tu/Kiếm Tu (hoặc
               path tương lai), thay path-choices liệt kê thẳng ở đây như
               trước. Hiện SONG SONG với Đột Phá tiểu cảnh giới (Phàm Nhân
               tầng 12-18 vẫn có thể tiếp tục đột phá thường, xem
               QUAN_KHI_UNLOCK_TANG) — người chơi tự chọn lúc nào commit. -->
          <button
            v-if="canChooseCultivationPath"
            type="button"
            class="character-panel__breakthrough-btn character-panel__breakthrough-btn--realm"
            v-tooltip="'Chọn con đường tu luyện — Pháp Tu hoặc Kiếm Tu.'"
            @click="openQuanKhi()"
          >
            Quán Khí
          </button>

          <button
            v-if="canTriggerFoundation"
            type="button"
            class="character-panel__breakthrough-btn character-panel__breakthrough-btn--realm"
            @click="breakthroughRequirement.open()"
          >
            Trúc Cơ
          </button>

          <button
            v-if="canTriggerRealm"
            type="button"
            class="character-panel__breakthrough-btn character-panel__breakthrough-btn--realm"
            @click="breakthroughRequirement.open()"
          >
            Đột Phá {{ nextRealmName }}
          </button>
        </div>
      </div>
    </div>

    <!-- Home Hub Phase 6 (Động Phủ) — Tâm Pháp hợp nhất đang trang bị
         (2026-08-15, không còn tách Tu Luyện/Chiến Đấu), dùng chung
         TechniqueSlotCard với LoadoutManager.vue's tab Tâm Pháp (cùng
         nguồn techniqueManager, đổi ở đây phản ánh đúng sang đó và
         ngược lại). -->
    <div class="character-panel__technique">
      <TechniqueSlotCard label="Tâm Pháp" />
    </div>

    <!-- Pháp Tu profession-tier ladder (2026-08-14) — chọn 1 lần, VĨNH
         VIỄN. Trước khi chọn: nút bấm sống ở cột Cảnh Giới ("Quán Khí",
         xem .character-panel__breakthrough) mở QuanKhiPanel.vue, ở đây
         chỉ còn hint. Sau khi chọn: tóm tắt Tâm Pháp + 3 skill được
         cấp, CHỈ ĐỌC (không đổi so với trước). -->
    <div class="character-panel__cultivation-path">
      <div v-if="chosenKit" class="path-summary">
        <h4 class="path-summary__title">{{ chosenKit.name }}</h4>

        <p v-if="chosenKit.element" class="path-summary__meta">Hệ {{ ELEMENT_LABELS[chosenKit.element] }}</p>

        <ul v-if="chosenKitSkillNames.length > 0" class="path-summary__skills">
          <li v-for="name in chosenKitSkillNames" :key="name">{{ name }}</li>
        </ul>

        <p v-if="chosenTechnique?.description" class="path-summary__breakthrough">
          {{ chosenTechnique.description }}
        </p>

        <!-- Element Loadout + Node Tree dời sang LoadoutManager.vue's
             tab Kỹ Năng (nửa dưới, 2026-08-20) — xem PLAN HOÀN CHỈNH
             mục 10 rework. -->
      </div>

      <p v-else-if="canChooseCultivationPath" class="character-panel__path-hint">
        Nhấn "Quán Khí" để chọn con đường tu luyện.
      </p>

      <p v-else class="character-panel__path-hint">Đạt Phàm Nhân tầng {{ QUAN_KHI_UNLOCK_TANG }} để Quán Khí.</p>
    </div>

    <div class="character-panel__body">
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

              <button
                v-if="player.attributePoints > 0 && !isMainStatCapped(stat.key as MainStatKey)"
                type="button"
                class="stat-list__allocate"
                @click="allocate(stat.key as MainStatKey)"
              >
                +
              </button>
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
  </div>
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
  align-items: stretch;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--ink-line);
  background: linear-gradient(180deg, var(--ink-800), var(--ink-900));
}

.character-panel__col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.character-panel__col-label {
  margin-bottom: 3px;
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  text-align: center;
}

.character-panel__col--equipment {
  flex: 1 1 32%;
}

.character-panel__mini-paperdoll {
  flex: 1;
  min-height: 96px;
}

.character-panel__col--figure {
  flex: 1 1 28%;
  align-items: center;
  justify-content: space-between;
  text-align: center;
}

.character-panel__col--realm {
  flex: 1 1 40%;
  justify-content: center;
}

.character-panel__name {
  margin: 0 0 4px;
  font-family: var(--font-display);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Silhouette nhân vật — sprite animation thật (2026-08-20, thay khối
   robe/head CSS placeholder cũ), cùng atlas idle/cultivate MainScene.ts
   dùng ở giữa Động Phủ. width để auto vì idle/cultivate 2 sheet có tỉ
   lệ khung hình khác nhau (xem AtlasSprite.vue) — height cố định 56px
   khớp :height prop, align-items:center của .character-panel__col
   (base class) tự canh giữa theo chiều ngang dù width đổi. */
.character-panel__figure {
  position: relative;
  flex: 1 1 auto;
  min-height: 72px;
  width: 100%;
  margin: 2px 0 4px;
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

.character-panel__power {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.character-panel__power-value {
  font-family: var(--font-display);
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--gold-500);
  text-shadow: var(--shadow-glow-gold);
}

.character-panel__power-label {
  font-size: 0.55rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.character-panel__realm {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.character-panel__realm-level {
  margin: 1px 0 6px;
  font-size: 0.62rem;
  color: var(--text-secondary);
  text-align: center;
}

.character-panel__cultivation {
  margin-bottom: 6px;
}

.character-panel__cultivation-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--ink-700);
  overflow: hidden;
}

.character-panel__cultivation-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.character-panel__cultivation-label {
  display: block;
  margin-top: 2px;
  font-size: 0.6rem;
  color: var(--text-muted);
  text-align: center;
}

/* Đồng hồ đếm ngược thật (spec mục 14) — xem cultivationEtaLabel. */
.character-panel__cultivation-eta {
  display: block;
  font-size: 0.58rem;
  color: var(--gold-500);
  text-align: center;
}

/* Auto Đột Phá (2026-08-20) — nằm NGOÀI .character-panel__breakthrough
   (v-if theo cultivation đủ/không) để checkbox luôn hiện, không biến
   mất ngay sau lần đột phá đầu tiên (progress reset về dưới ngưỡng),
   người chơi khỏi phải tick lại mỗi tầng. Cùng kiểu với
   StageSelectPanel.vue's .stage-select__auto. */
.character-panel__auto-breakthrough {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-bottom: 4px;
  font-size: 0.62rem;
  color: var(--text-secondary);
  cursor: pointer;
}

/* Đột Phá — dời vào từ BreakthroughButton.vue (overlay cũ đã xoá, xem
   Work Stream 2), thay nút Tu Luyện thủ công. */
.character-panel__breakthrough {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-panel__breakthrough-btn {
  display: block;
  width: 100%;
  padding: 6px;
  background: linear-gradient(180deg, #ffe082, #ffb300);
  color: #221a00;
  border: 1px solid #fff3c4;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.68rem;
  cursor: pointer;
}

.character-panel__breakthrough-btn--realm {
  background: linear-gradient(180deg, #e082ff, #b300ff);
  color: #1a0022;
  border-color: #f3c4ff;
}

.character-panel__technique {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ink-line);
}

.character-panel__cultivation-path {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ink-line);
}

.character-panel__path-hint {
  margin: 0;
  font-size: 0.65rem;
  color: var(--text-muted);
}

.path-summary__title {
  margin: 0 0 2px;
  font-size: 0.75rem;
  color: var(--gold-500);
  font-family: var(--font-display);
}

.path-summary__meta {
  margin: 0 0 4px;
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.path-summary__skills {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.68rem;
  color: var(--text-secondary);
}

.path-summary__skills li {
  padding: 1px 0;
  border-bottom: 1px solid var(--ink-line-soft);
}

.path-summary__breakthrough {
  margin: 4px 0 0;
  font-size: 0.62rem;
  color: var(--gold-500);
}

.path-summary__section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ink-line-soft);
}

.character-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 8px;
  font-size: 0.8rem;
}

.stat-group {
  margin-bottom: 6px;
}

.stat-group__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0 0 2px;
  padding: 2px 0;
  background: none;
  border: none;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
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
  gap: 4px;
  padding: 1px 0;
  border-bottom: 1px solid var(--ink-line-soft);
}

.stat-list__main-stat {
  display: flex;
  align-items: center;
  gap: 6px;
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
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--gold-500);
}

.stat-list__allocate {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: 50%;
  font-weight: 700;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
}

.element-chips {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.element-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
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
  color: var(--chip-color);
  font-weight: 600;
}

.element-chip__value {
  color: var(--text-secondary);
}

.pill-usage {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  overflow-x: auto;
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
