SPEC (REVISED): Animation & VFX System cho Idle Tu Tiên
Version: 1.1.0
Stack: Vue 3 (UI) + Phaser 3 (visual only) + JS/TS core (logic)
Thay đổi chính so với v1.0: Loại bỏ hoàn toàn UI layer khỏi Phaser. Phaser chỉ vẽ animation + VFX. Vue lo toàn bộ UI tương tác.

1. Ranh giới trách nhiệm (QUAN TRỌNG NHẤT)
text
┌────────────────────────────────────────────────────────────────┐
│  CORE LOGIC (JS thuần, no framework)                           │
│  CombatManager · DamageEngine · SkillSystem · BuffSystem       │
│  → Chạy cả khi tab ẩn, offline, không cần render               │
└───────────────────────────────┬────────────────────────────────┘
                                │ EventBus (data thuần)
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│  VUE (UI Layer)           │              │  PHASER (Visual Layer)    │
│  - HP/MP bar              │              │  - Sprite animation       │
│  - Skill bar, cooldown    │              │  - VFX (hit, cast, AOE)   │
│  - Buff/debuff icons      │              │  - Projectile             │
│  - Damage log             │              │  - Camera shake/flash     │
│  - Settings, inventory    │              │  - Floating text          │
│  - Stats panel            │              │  - Environment effects    │
│  - Menu, popup            │              │  - Screen-space overlays  │
└───────────────────────────┘              └───────────────────────────┘
1.1 Nguyên tắc phân chia
Loại	Vue (DOM)	Phaser (Canvas)
Text UI (số, label, menu)	✅	❌
Nút bấm, input, form	✅	❌
HP/MP bar (static HUD)	✅	❌
Skill bar + cooldown	✅	❌
Buff icon row	✅	❌
Damage log, chat	✅	❌
Damage number bay lên	❌	✅
Entity (player/quái) sprite	❌	✅
VFX (hit, cast, AOE)	❌	✅
Projectile	❌	✅
Camera shake/flash	❌	✅
Environment (mưa, mây)	❌	✅
HP bar floating trên đầu entity	❌	✅
Boss HP bar cố định màn hình	✅	❌
Cast bar trên đầu entity	❌	✅
1.2 Quy tắc vàng
Vue không bao giờ touch Phaser API. Vue chỉ đọc/ghi Core state + listen EventBus.

Phaser không bao giờ touch Vue. Phaser chỉ listen EventBus + đọc Core state.

Không có event giữa Vue ↔ Phaser. Mọi giao tiếp phải qua Core (EventBus).

Damage number, HP bar floating, cast bar → Phaser vì chúng thuộc về "thế giới ảo".

HP bar HUD, skill bar, menu → Vue vì chúng thuộc về "giao diện người dùng".

2. Kiến trúc tổng thể (revised)
text
┌─────────────────────────────────────────────────────────────┐
│                     CORE (JS/TS)                            │
│  CombatManager · DamageEngine · SkillSystem · SaveSystem    │
│  Chạy độc lập với cả Vue và Phaser                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ EventBus
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌───────────────────────┐         ┌───────────────────────────┐
│  VUE BRIDGE           │         │  PHASER BRIDGE            │
│  vue/composables/     │         │  phaser/bridge/           │
│  useCombat()          │         │  CombatBridge.js          │
│  useEntity()          │         │                           │
│  useSkill()           │         │                           │
└───────────┬───────────┘         └───────────┬───────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────────┐
│  VUE COMPONENTS       │         │  PHASER SCENES            │
│  <HealthBar />        │         │  CombatScene              │
│  <SkillBar />         │         │  - EntityViewManager      │
│  <BuffRow />          │         │  - VFXManager             │
│  <DamageLog />        │         │  - FloatingTextManager    │
│  <SettingsPanel />    │         │  - CameraFX               │
└───────────────────────┘         └───────────────────────────┘
Điểm mấu chốt: Vue và Phaser hoàn toàn độc lập, chỉ gặp nhau ở Core qua EventBus.

3. Core ↔ Vue Contract
3.1 Vue composable (bridge)
js
// vue/composables/useCombat.js
import { ref, onMounted, onUnmounted } from 'vue';
import { EventBus } from '@/core/EventBus.js';
import { combatManager } from '@/modules/combat/CombatManager.js';

export function useCombat() {
  const playerHp = ref(0);
  const playerMaxHp = ref(0);
  const playerMp = ref(0);
  const playerMaxMp = ref(0);
  const monsters = ref([]);
  const combatRunning = ref(false);

  const offHandlers = [];

  function syncFromCore() {
    const playerId = combatManager.getPlayerId();
    const player = combatManager.entities.get(playerId);
    if (player) {
      playerHp.value = player.hp;
      playerMaxHp.value = player.maxHp;
      playerMp.value = player.mp;
      playerMaxMp.value = player.maxMp;
    }
    monsters.value = [...combatManager.entities.values()]
      .filter(e => e.type === 'monster')
      .map(e => ({ id: e.id, hp: e.hp, maxHp: e.maxHp, name: e.id }));
  }

  onMounted(() => {
    // Vue chỉ lắng nghe event mà nó cần cho UI
    offHandlers.push(
      EventBus.on('DAMAGE_APPLIED_TO_ENTITY', syncFromCore),
      EventBus.on('ENTITY_DIED', syncFromCore),
      EventBus.on('ENTITY_REGISTERED', syncFromCore),
      EventBus.on('MONSTER_SPAWNED', syncFromCore),
      EventBus.on('COMBAT_STARTED', () => { combatRunning.value = true; syncFromCore(); }),
      EventBus.on('COMBAT_STOPPED', () => { combatRunning.value = false; }),
    );
    syncFromCore();
  });

  onUnmounted(() => {
    offHandlers.forEach(off => off());
  });

  return { playerHp, playerMaxHp, playerMp, playerMaxMp, monsters, combatRunning };
}
3.2 Vue components
vue
<!-- vue/components/HealthBar.vue -->
<template>
  <div class="health-bar">
    <div class="fill" :style="{ width: hpPercent + '%' }"></div>
    <span class="label">{{ current }} / {{ max }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  current: Number,
  max: Number,
});
const hpPercent = computed(() => (props.current / props.max) * 100);
</script>
3.3 Vue không vẽ damage number
Damage number không thuộc Vue vì:

Bay lên theo world position.

Cần timing đồng bộ với VFX.

Số lượng lớn → DOM sẽ lag.

→ Damage number do Phaser vẽ. Vue chỉ vẽ damage log (lịch sử).

4. Core ↔ Phaser Contract
4.1 Phaser bridge (lắng nghe EventBus, gọi manager Phaser)
js
// phaser/bridge/CombatBridge.js
import { EventBus } from '@/core/EventBus.js';

export class CombatBridge {
  constructor({ viewManager, vfxManager, textManager, camera }) {
    this.vm = viewManager;
    this.vfx = vfxManager;
    this.text = textManager;
    this.camera = camera;
    this._bind();
  }

  _bind() {
    this.offHandlers = [
      EventBus.on('MONSTER_SPAWNED', this._onSpawn.bind(this)),
      EventBus.on('ENTITY_REGISTERED', this._onSpawn.bind(this)),
      EventBus.on('ENTITY_DIED', this._onDied.bind(this)),
      EventBus.on('SKILL_CAST', this._onCast.bind(this)),
      EventBus.on('DAMAGE_APPLIED_TO_ENTITY', this._onDamage.bind(this)),
      EventBus.on('DAMAGE_MISS', this._onMiss.bind(this)),
      EventBus.on('HEAL_APPLIED', this._onHeal.bind(this)),
      EventBus.on('BUFF_APPLIED', this._onBuff.bind(this)),
      EventBus.on('BUFF_REMOVED', this._onBuffEnd.bind(this)),
      EventBus.on('PROJECTILE_SPAWNED', this._onProjectile.bind(this)),
    ];
  }

  // ... handlers như đã viết ở spec v1.0

  shutdown() {
    this.offHandlers.forEach(off => off());
    this.offHandlers = [];
  }
}
4.2 Phaser chỉ vẽ những gì cần thiết
Phaser không vẽ:

Skill bar, cooldown UI.

HP bar HUD của player (Vue vẽ).

Menu, settings, inventory.

Buff icon row (Vue vẽ).

Boss HP bar (Vue vẽ).

Phaser chỉ vẽ:

Entity sprite (player + quái).

Animation (idle/attack/cast/hit/death).

VFX (hit spark, cast circle, AOE, projectile).

Floating text (damage number, miss, heal, buff text).

HP bar floating trên đầu entity (vì nó gắn với world position).

Cast bar floating trên đầu entity (tương tự).

Environment (mưa, mây, sương).

Camera FX (shake, flash, zoom).

5. Đồng bộ giữa Vue và Phaser
Vì cả hai độc lập, chúng cần đồng bộ qua Core. Ví dụ khi player click skill trên Vue:

text
[Vue] User click skill button
  → emit EventBus 'USE_SKILL' { attackerId, skillId, targetId }
    → [Core] CombatManager.onUseSkill()
      → CombatManager.useSkill()
        → emit 'SKILL_CAST' { attackerId, defenderId, skill, castTimeMs }
          → [Phaser] CombatBridge._onCast() → play animation
          → [Vue] có thể hiển thị "đang cast..." nếu cần
        → sau castTimeMs
          → emit 'REQUEST_DAMAGE'
            → DamageEngine
              → emit 'DAMAGE_RESULT'
                → CombatManager.onDamageResult()
                  → emit 'DAMAGE_APPLIED_TO_ENTITY'
                    → [Phaser] show damage number
                    → [Vue] update HP bar
Điểm mấu chốt: Vue và Phaser không biết nhau tồn tại. Chỉ Core biết cả hai. Khi cần thêm UI mới, chỉ Vue thay đổi. Khi cần thêm VFX, chỉ Phaser thay đổi. Core không đổi.

5.1 Layout canvas
html
<!-- App.vue -->
<template>
  <div class="game-root">
    <!-- Phaser canvas: chỉ vẽ world -->
    <div ref="phaserContainer" class="phaser-layer"></div>

    <!-- Vue UI overlay: absolute, pointer-events selective -->
    <div class="ui-layer">
      <TopHUD />       <!-- HP/MP player, gold, exp -->
      <SkillBar />     <!-- bottom center -->
      <BuffRow />      <!-- buff/debuff icons -->
      <DamageLog />    <!-- side panel -->
      <SettingsMenu /> <!-- modal -->
    </div>
  </div>
</template>

<style scoped>
.game-root { position: relative; width: 100vw; height: 100vh; }
.phaser-layer { position: absolute; inset: 0; }
.ui-layer {
  position: absolute; inset: 0;
  pointer-events: none; /* cho phép click xuyên qua */
}
.ui-layer > * { pointer-events: auto; } /* chỉ con nhận click */
</style>
5.2 Đồng bộ toạ độ (world ↔ screen)
Phaser dùng world coordinate. Vue dùng screen coordinate. Khi cần Vue hiển thị gì đó ở vị trí world (ví dụ: label trên đầu boss), có 2 cách:

Cách A (khuyến nghị): Để Phaser vẽ hết những gì gắn với world (HP bar floating, cast bar, name tag). Vue không cần biết toạ độ world.

Cách B: Nếu Vue cần vẽ tooltip ở vị trí entity, Phaser expose 1 API:

js
phaserGame.worldToScreen(x, y) // → { sx, sy }
Vue gọi qua một bridge object (không phải EventBus). Nhưng cách này phá vỡ nguyên tắc độc lập → tránh dùng.

Quy tắc: Nếu thứ gì gắn với world → Phaser vẽ. Nếu gắn với màn hình → Vue vẽ.

6. Animation System (Phaser-only)
6.1 Animation config
Giữ như spec v1.0 mục 5. Nhưng thêm:

js
// Animation chỉ định nghĩa visual, không chứa logic combat
// Timing (castTime, hitTime) nằm trong Core skill config,
// Phaser chỉ NHẬN timing đó qua event payload.
6.2 Đồng bộ animation ↔ damage timing
Core skill config:

js
// core/config/skillConfig.js
export const SKILLS = {
  fire_ball: {
    id: 'fire_ball',
    castTimeMs: 400,      // wind-up
    hitTimeMs: 400,       // frame hit = castTime (đơn giản)
    recoverTimeMs: 200,
    visual: {
      castAnim: 'player_cast',
      hitVfx: 'hit_fire',
      projectile: 'vfx_fireball',
    },
  },
};
Phaser bridge nhận SKILL_CAST với castTimeMs, hitTimeMs → chạy animation đúng duration. Core delay requestDamage tới hitTimeMs. → Damage number trồi lên đúng lúc VFX nổ.

Lưu ý: visual field trong skill config là data thuần, không phải code Phaser. Core chỉ pass nó qua event. Phaser đọc và lookup preset. Nếu Core không cần biết visual → có thể tách file skillVisualConfig.js ở phaser/config/.

7. VFX System (Phaser-only)
Giữ như spec v1.0 mục 6. Bổ sung:

7.1 VFX không được ảnh hưởng UI Vue
VFX nằm trong canvas Phaser, không bao giờ đè lên Vue UI vì:

Vue UI ở layer DOM phía trên canvas.

Canvas không thể vẽ ra ngoài viewport.

7.2 World-space VFX vs Screen-space VFX
Loại	Vẽ ở đâu	Ví dụ
World-space	Theo toạ độ entity	Hit spark, AOE, projectile
Screen-space (trong Phaser)	Cố định viewport	Vignette đỏ khi HP thấp, letterbox
Screen-space VFX trong Phaser khác với Vue UI. Ví dụ: vignette đỏ (radial gradient) có thể vẽ trong Phaser vì nó là hiệu ứng hình ảnh, không phải UI tương tác. Nhưng nếu muốn click được → phải Vue.

Quy tắc: Nếu cần pointer-events → Vue. Nếu chỉ là visual effect → Phaser.

8. Floating Text System (Phaser-only)
Damage number, miss, heal, crit → Phaser vẽ vì:

Bay theo world position.

Cần đồng bộ với VFX.

Số lượng lớn → DOM lag.

Cần blend mode, shader (không có trong DOM dễ dàng).

8.1 Khác biệt với damage log (Vue)
Damage number (Phaser)	Damage log (Vue)
Vị trí	Bay lên từ entity	Danh sách cố định
Thời gian	800ms rồi biến mất	Lịch sử cuộn
Số lượng	Rất nhiều, gộp lại	Giới hạn 100 dòng
Style	World-space text	DOM text
Cả hai đều lắng nghe DAMAGE_APPLIED_TO_ENTITY. Phaser vẽ số bay lên. Vue thêm vào log.

9. Camera & Screen FX (Phaser-only)
Giữ như spec v1.0 mục 8. Nhưng lưu ý:

Camera shake/flash → Phaser (vì là hiệu ứng canvas).

Nếu muốn flash đỏ toàn màn hình đè lên cả Vue UI → phải làm ở Vue (một div overlay).

Khuyến nghị: flash nhẹ trong Phaser (chỉ world), nếu cần đè UI → Vue làm.

10. Audio System (độc lập)
Audio có thể ở Vue hoặc Core, tùy kiến trúc. Khuyến nghị:

AudioManager trong Core (hoặc module riêng) lắng nghe EventBus.

Vue chỉ có volume slider → emit SET_VOLUME.

Phaser không liên quan đến audio.

11. Event Contract (revised)
11.1 Events Core → Vue (UI cần)
Event	Vue dùng để
ENTITY_REGISTERED	Update entity list
MONSTER_SPAWNED	Update monster count
ENTITY_DIED	Remove khỏi list
DAMAGE_APPLIED_TO_ENTITY	Update HP bar, thêm damage log
DAMAGE_MISS	Thêm log "MISS"
HEAL_APPLIED	Update HP bar, log
BUFF_APPLIED / BUFF_REMOVED	Update buff icon row
SKILL_CAST	Hiển thị "casting..." (nếu cần)
COMBAT_STARTED / STOPPED	Toggle combat UI
ENTITY_HP_CHANGED	Update HP bar (event gộp, dùng cho perf)
XP_GAINED, LOOT_DROPPED	Update exp bar, inventory
11.2 Events Core → Phaser (visual cần)
Event	Phaser dùng để
ENTITY_REGISTERED	Spawn EntityView
MONSTER_SPAWNED	Spawn + VFX spawn
ENTITY_DIED	Play death → despawn
SKILL_CAST	Play cast animation
PROJECTILE_SPAWNED	Tween projectile
AOE_TRIGGERED	Play AOE VFX
DAMAGE_APPLIED_TO_ENTITY	Hit flash + damage number
DAMAGE_MISS	Miss text
HEAL_APPLIED	Heal number + VFX
BUFF_APPLIED / BUFF_REMOVED	Aura VFX
COMBAT_STARTED / STOPPED	Environment
11.3 Events Vue → Core
Event	Payload
USE_SKILL	{ attackerId, skillId, targetId? }
TOGGLE_AUTO	{ enabled }
SET_SPEED	{ multiplier }
SET_VOLUME	{ channel, value }
PAUSE_COMBAT / RESUME_COMBAT	{}
11.4 Events Phaser → Core
Không có. Phaser không bao giờ emit event logic. Nếu cần (ví dụ: user click entity trong canvas) → Phaser emit event UI, Vue xử lý.

Nhưng nếu có:

Event	Payload	Mục đích
ENTITY_CLICKED	{ entityId }	User click entity trong canvas
GROUND_CLICKED	{ x, y }	User click đất (move command)
→ Vue có thể listen và mở tooltip, hoặc gửi lệnh logic.

12. Performance & Pooling
Giữ như spec v1.0 mục 12. Bổ sung:

12.1 Vue-specific perf
HP bar update: không update mỗi tick. Chỉ update khi DAMAGE_APPLIED_TO_ENTITY hoặc HEAL_APPLIED.

Nếu có nhiều monster HP bar trong Vue → dùng virtual list hoặc chỉ hiển thị top 5.

Dùng v-memo hoặc shallowRef cho list monster.

Damage log: giới hạn 100 dòng, dùng v-for với key.

12.2 Phaser-specific perf
Pool VFX, floating text, projectile như spec v1.0.

Không update Vue từ Phaser. Không update Phaser từ Vue.

12.3 Idle-specific
Tab ẩn → Vue vẫn render (DOM ít tốn), Phaser pause scene, Core vẫn tick.

Fast-forward → Phaser time.timeScale = multiplier. Vue không cần đổi (vì UI update theo event, không theo frame).

Offline → Core apply state, không emit event visual (hoặc emit với flag isOffline: true để Phaser skip).

13. Idle-specific Features (revised)
13.1 Speed multiplier
Core: không đổi, tick theo real time.

Phaser: time.timeScale = multiplier, anims.globalTimeScale = multiplier, tweens.timeScale = multiplier.

Vue: không đổi (UI vẫn update theo event).

13.2 Offline progress
Khi user quay lại sau offline:

Core tính toán offline progress (damage, kill, loot).

Không emit từng DAMAGE_APPLIED_TO_ENTITY (sẽ spam).

Chỉ emit OFFLINE_PROGRESS_RESULT với summary.

Vue hiển thị popup "Bạn đã nhận X exp, Y vàng trong 2 giờ".

Phaser không cần làm gì (entity state đã thay đổi, Phaser sync khi vào scene).

13.3 Ascension/Rebirth
Core reset state.

Emit ASCENSION_COMPLETED.

Vue reset UI.

Phaser reset scene (destroy all views, clear pools, đổi background).

14. Save/Load State
Core save logic state.

Vue save UI preferences (volume, layout) vào localStorage riêng.

Phaser không save gì.

Khi load:

Core restore state → emit STATE_RESTORED.

Vue re-render UI từ state.

Phaser spawn lại EntityView từ state (query Core).

15. Testing & Debug
15.1 Vue test
Unit test composable useCombat() với mock EventBus.

Component test với @vue/test-utils.

Không cần Phaser.

15.2 Phaser test
Bridge test với mock managers.

Scene test với Phaser headless (nếu cần).

15.3 Core test
Logic test thuần, không cần Vue/Phaser.

Đây là layer quan trọng nhất → test coverage cao nhất.

15.4 Debug overlay
Vue debug panel: hiển thị state, event log, FPS Vue.

Phaser debug overlay: entity count, VFX pool usage, draw calls.

Có thể bật/tắt riêng.

16. Cấu trúc thư mục (revised)
text
src/
├── core/                           # LOGIC (no framework)
│   ├── EventBus.js
│   ├── TickManager.js
│   └── SaveSystem.js
├── config/                         # shared data
│   ├── elementConfig.js
│   └── skillConfig.js
├── modules/
│   └── combat/                     # LOGIC
│       ├── CombatManager.js
│       ├── DamageEngine.js
│       ├── DamageService.js
│       └── listeners/
│           └── DamageListeners.js
├── audio/                          # có thể ở core hoặc riêng
│   └── AudioManager.js
├── vue/                            # UI LAYER
│   ├── App.vue
│   ├── composables/
│   │   ├── useCombat.js
│   │   ├── useEntity.js
│   │   ├── useSkill.js
│   │   └── useEventBus.js
│   ├── components/
│   │   ├── TopHUD.vue
│   │   ├── HealthBar.vue
│   │   ├── ManaBar.vue
│   │   ├── SkillBar.vue
│   │   ├── SkillButton.vue
│   │   ├── BuffRow.vue
│   │   ├── BuffIcon.vue
│   │   ├── DamageLog.vue
│   │   ├── MonsterList.vue
│   │   ├── SettingsMenu.vue
│   │   └── OfflinePopup.vue
│   └── stores/                     # Pinia (nếu dùng)
│       └── combatStore.js
├── phaser/                         # VISUAL LAYER
│   ├── scenes/
│   │   ├── BootScene.js
│   │   └── CombatScene.js
│   ├── bridge/
│   │   └── CombatBridge.js         # seam duy nhất
│   ├── views/
│   │   ├── EntityView.js
│   │   ├── EntityViewManager.js
│   │   ├── ProjectileView.js
│   │   └── AuraView.js
│   ├── vfx/
│   │   ├── VFXManager.js
│   │   ├── FloatingTextManager.js
│   │   ├── CameraFX.js
│   │   └── ScreenFX.js
│   ├── config/
│   │   ├── AnimationConfig.js
│   │   ├── VFXConfig.js
│   │   └── ArchetypeConfig.js
│   └── debug/
│       └── DebugOverlay.js
└── main.js                         # bootstrap: start core + mount Vue + start Phaser
17. Bootstrap (main.js)
js
// main.js
import { createApp } from 'vue';
import { EventBus } from './core/EventBus.js';
import { startGameLoop } from './core/TickManager.js';
import { combatManager } from './modules/combat/CombatManager.js';
import './modules/combat/DamageService.js';
import './audio/AudioManager.js';
import App from './vue/App.vue';
import Phaser from 'phaser';
import { CombatScene } from './phaser/scenes/CombatScene.js';

// 1. Start core
combatManager.registerEntity({ /* player */ });
EventBus.emit('START_COMBAT');
startGameLoop();

// 2. Mount Vue UI
const vueApp = createApp(App);
vueApp.mount('#app');

// 3. Start Phaser (sau khi Vue mount để canvas nằm dưới UI)
const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser-container',
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [CombatScene],
  scale: { mode: Phaser.Scale.RESIZE },
  backgroundColor: '#1a1a2e',
});
Thứ tự quan trọng: Core → Vue → Phaser. Vì:

Core phải sẵn sàng trước khi Vue/Phaser listen.

Vue mount trước để UI layer sẵn sàng.

Phaser mount sau cùng để canvas nằm dưới DOM UI.

18. Roadmap triển khai (revised)
Phase	Deliverable	Layer
P0	EventBus, TickManager, CombatManager, DamageEngine, DamageService	Core ✅
P1	Vue composables (useCombat, useEventBus) + components cơ bản (HP bar, skill bar)	Vue
P2	EntityView + EntityViewManager (idle, attack, hit, death)	Phaser
P3	CombatBridge + CombatScene wiring	Phaser
P4	VFXManager + FloatingTextManager + pool	Phaser
P5	Projectile + AOE + Composite VFX	Phaser
P6	CameraFX + ScreenFX	Phaser
P7	Vue buff row, damage log, settings, offline popup	Vue
P8	Idle-specific: speed sync, offline, ascension	All
P9	Debug overlay (Vue + Phaser riêng)	All
P10	Test suite + performance tuning	All
Điểm khác biệt: Vue và Phaser có thể phát triển song song từ P1 và P2, không block nhau. Core (P0) là nền tảng chung.

19. Câu hỏi mở (updated)
State management: Vue dùng Pinia hay chỉ composable? Nếu Pinia → Core state có nên sync vào store không?

Vue ↔ Core reactivity: Có nên dùng shallowRef cho entity list để tránh deep reactivity không?

Vue UI framework: Dùng Tailwind, UnoCSS, hay CSS thuần?

Phaser scale mode: RESIZE (responsive) hay FIT (letterbox)?

Multi-scene Phaser: Chỉ CombatScene, hay có TownScene, BossScene riêng?

Ngôn ngữ: JS thuần hay TS? TS sẽ giúp contract rõ ràng hơn nhiều.

Audio ở đâu: Core module hay Vue?

Offline popup: Vue tự tính hay Core cung cấp summary?

20. Tóm tắt những gì thay đổi so với v1.0
Hạng mục	v1.0	v1.1
UI	Phaser vẽ (mục 10)	Vue vẽ
HP bar HUD	Phaser	Vue
Skill bar	Phaser	Vue
Buff icon row	Phaser	Vue
Boss HP bar	Phaser	Vue
Damage number	Phaser	Phaser (giữ)
HP bar floating trên entity	Phaser	Phaser (giữ)
Cast bar trên entity	Phaser	Phaser (giữ)
Camera shake	Phaser	Phaser (giữ)
Screen flash	Phaser	Phaser (world) + Vue (overlay toàn màn hình nếu cần)
Bridge	1 (CombatBridge)	2 (CombatBridge + Vue composables)
Bootstrap	Phaser only	Core → Vue → Phaser
Nguyên tắc cốt lõi mới: World-space visual → Phaser. Screen-space UI → Vue. Không có ngoại lệ.