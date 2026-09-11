<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref, watch } from 'vue'
import type Phaser from 'phaser'
import type { MainScene } from '@/game/scenes/MainScene'
import type { CombatScene } from '@/game/scenes/CombatScene'
import type { TribulationScene } from '@/game/scenes/TribulationScene'
import {
  PHASER_SCENE_ADAPTER_KEY,
  ASSET_BUNDLE_MANAGER_KEY,
} from '@/presentation/PresentationContracts'
import { useGameManager } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import { assertGateSeeded, writeGate } from '@/presentation/gate/PresentationGate'
import {
  resolvePlayerVisualProfileId,
  type PlayerVisualProfileId,
} from '@/game/support/PlayerVisualProfiles'
import { makeKiemBarReader, registerKiemBarReader } from '@/game/support/kiemBarBridge'

const gameManager = useGameManager()
const player = usePlayerStore()
const sceneAdapter = inject(PHASER_SCENE_ADAPTER_KEY, null)
const bundleManager = inject(ASSET_BUNDLE_MANAGER_KEY, null)

const containerRef = ref<HTMLDivElement | null>(null)

let game: Phaser.Game | null = null
let resizeObserver: ResizeObserver | null = null
let hostPublished = false
let positionsCleanup: (() => void) | null = null
let isAlive = false

// Task 4 (perf-optimize-pass, phần 3) — bootstrap error boundary.
// bootError expose ra ngoài (defineExpose) cho parent/test kiểm tra;
// fallback UI CHỈ hiển thị CỤC BỘ ngay trong container canvas rỗng
// (đoạn <p> tối giản dưới template) — KHÔNG route qua errorStore/
// ErrorScreen.vue toàn app (đó là overlay full-screen chặn CẢ app,
// dành cho lỗi thật sự chết cây component; bootstrap Phaser lỗi (vd.
// chunk-load tạm thời) không nên khóa menu/stats/hệ thống khác đang
// hoạt động bình thường — xem code review Task 4 finding 2).
const bootError = ref<string | null>(null)

onMounted(() => {
  // T6.4 code-split — Phaser + 3 scene classes load qua dynamic import
  // (chunk riêng ~1.2MB, không chặn entry). Toàn bộ logic mount chuyển
  // sang setupGame() async; isAlive guard chống unmount giữa chừng
  // (async resolve sau khi component đã hủy → không tạo game mồ côi).
  const container = containerRef.value

  if (!container) {
    return
  }

  isAlive = true

  void (async () => {
    try {
      const [
        { default: Phaser },
        { AssetLoaderScene: AssetLoaderSceneClass },
        { MainScene: MainSceneClass },
        { CombatScene: CombatSceneClass },
        { TribulationScene: TribulationSceneClass },
      ] = await Promise.all([
        import('phaser'),
        import('@/game/scenes/AssetLoaderScene'),
        import('@/game/scenes/MainScene'),
        import('@/game/scenes/CombatScene'),
        import('@/game/scenes/TribulationScene'),
      ])

      if (!isAlive || !containerRef.value) {
        return
      }

      setupGame(Phaser, [AssetLoaderSceneClass, MainSceneClass, CombatSceneClass, TribulationSceneClass])
    } catch (error) {
      // Component đã unmount trước khi bootstrap xong (cleanup thật đã
      // chạy ở onUnmounted) — không báo lỗi/không đụng state nữa.
      if (!isAlive) {
        return
      }

      const message = error instanceof Error ? error.message : String(error)

      console.error('[PhaserCanvas] Bootstrap thất bại:', error)

      // Dọn dẹp mọi thứ có thể đã đăng ký trước khi lỗi xảy ra (ví dụ
      // new Phaser.Game() throw SAU khi setupGame đã kịp gắn
      // positionsCleanup/resizeObserver) — cùng bộ dọn dẹp với
      // onUnmounted bên dưới, tránh handler/observer/global mồ côi.
      positionsCleanup?.()
      positionsCleanup = null

      resizeObserver?.disconnect()
      resizeObserver = null

      ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = undefined

      game?.destroy(true)
      game = null

      bootError.value = message
    }
  })()
})

function setupGame(
  Phaser: typeof import('phaser'),
  scenes: [
    typeof import('@/game/scenes/AssetLoaderScene').AssetLoaderScene,
    typeof import('@/game/scenes/MainScene').MainScene,
    typeof import('@/game/scenes/CombatScene').CombatScene,
    typeof import('@/game/scenes/TribulationScene').TribulationScene,
  ],
) {
  const container = containerRef.value!

  // Canvas Phaser thích ứng với container (ResizeObserver bên dưới,
  // không còn frame 16:9 cố định transform:scale() ở GameRoot) — nhưng
  // containerRef.value.clientWidth/Height đọc lúc mount() này ĐÔI KHI vẫn
  // là 0 (race giữa lúc Vue mount component con này và lúc trình duyệt
  // thật sự layout xong style của tổ tiên) — canvas Phaser tạo với
  // width/height 0 thì kẹt luôn 0 vĩnh viễn vì Phaser chỉ đọc config
  // này 1 lần lúc khởi tạo. ResizeObserver ở đây vừa fix race đó (lần
  // gọi đầu tiên luôn có, báo kích thước THẬT ngay sau khi layout xong)
  // vừa là lưới an toàn chung nếu container đổi kích thước vì lý do
  // khác sau này.
  // Combat UI Redesign — 2 scene ĐĂNG KÝ cùng lúc, chỉ MainScene (đầu
  // mảng) tự động active — CombatScene nằm sẵn nhưng dormant tới khi
  // MainScene tự gọi this.scene.start('CombatScene') lúc 'battle_start'
  // (xem MainScene.ts/CombatScene.ts). Chỉ 1 Phaser.Game/canvas DUY
  // NHẤT cho cả 2 — scene chuyển qua lại KHÔNG destroy/tạo lại Game.
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: container.clientWidth,
    height: container.clientHeight,
    transparent: true,
    // roundPixels (fix "nhân vật đôi khi bị blur", 2026-08-26): sprite
    // đứng giữa pixel lẻ (projection tọa độ thập phân + walk sway/bob)
    // bị sample mờ; snap vị trí vẽ về lưới nguyên pixel cho cạnh nét.
    render: { roundPixels: true },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: scenes,
  })

  // Expose cho e2e/visual gate — đọc battlefieldGeometry qua registry
  // mà không cần chạm canvas pixel. Không có code gameplay dùng nó.
  ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = game

  // MainScene.ts/CombatScene.ts CHỈ giao tiếp với core qua EventBus
  // này (không cầm tham chiếu GameManager trực tiếp) — mọi thứ chúng
  // cần (vị trí player/quái, animation attack/critical/hit/dodge/cast/
  // death/battle_start/battle_end/combat_scene_exit) đều tới qua đây.
  writeGate(game.registry, 'eventBus', gameManager.eventBus)
  writeGate(game.registry, 'gameManager', gameManager)
  if (sceneAdapter) {
    writeGate(game.registry, 'sceneAdapter', sceneAdapter)
  }
  // AssetLoaderScene picks this up in its own create() and registers itself -
  // see the note there on why the host cannot fetch the scene directly.
  if (bundleManager) {
    writeGate(game.registry, 'bundleManager', bundleManager)
  }

  // Seed-time validation (spec §4.2). Every read site downstream degrades
  // rather than throws - deliberately, and with a regression test protecting
  // it - so this is the one place a missing required key can still be reported
  // as what it is: a wiring bug at the host, named, before a scene runs.
  assertGateSeeded(game.registry)

  // Late-join replay (fix spawn animation lần đầu, lớp bảo hiểm thứ 2
  // bên cạnh eager preload) — giữ snapshot 'positions' MỚI NHẤT trong
  // registry để CombatScene.create() start muộn có thể fast-forward thay
  // vì đứng ngoài phase spawn telegraph. Clear khi trận kết thúc/thoát
  // để không phát lại snapshot STALE của trận cũ.
  let lastPositionsSnapshot: { event: BattlePositionsEvent; at: number } | null = null

  const clearPositionsSnapshot = () => {
    lastPositionsSnapshot = null

    if (game) writeGate(game.registry, 'lastBattlePositionsSnapshot', undefined)
  }

  const positionsHandler = (event: BattlePositionsEvent) => {
    lastPositionsSnapshot = { event, at: performance.now() }

    if (game) writeGate(game.registry, 'lastBattlePositionsSnapshot', lastPositionsSnapshot)
  }

  gameManager.eventBus.on<BattlePositionsEvent>('positions', positionsHandler)

  gameManager.eventBus.on<void>('battle_end', clearPositionsSnapshot)

  gameManager.eventBus.on<void>('combat_scene_exit', clearPositionsSnapshot)

  // 9.4 — Kiếm bar reader (Kiếm Thế / Kiếm Ý tạm) đăng ký từ đây (có
  // gameManager + player store) vào registry; CombatScene poll mỗi frame.
  registerKiemBarReader(
    game.registry,
    makeKiemBarReader(gameManager, () => usePlayerStore()),
  )

  positionsCleanup = () => {
    gameManager.eventBus.off<BattlePositionsEvent>('positions', positionsHandler)
    gameManager.eventBus.off<void>('battle_end', clearPositionsSnapshot)
    gameManager.eventBus.off<void>('combat_scene_exit', clearPositionsSnapshot)
  }

  // Player visual profile bridge (player-body-anchor-reward-gourd-plan
  // §4.2) — snapshot ID vào registry để scene đọc lúc create() (không
  // bỏ lỡ trạng thái khi scene khởi động muộn), và phát event qua EventBus
  // mỗi khi realm/path đổi. Scenes chỉ nhận PROFILE ID.
  const publishProfile = () => {
    const profileId: PlayerVisualProfileId = resolvePlayerVisualProfileId({
      realmId: player.realmId,

      cultivationPath: player.cultivationPath,
    })

    if (game) {
      writeGate(game.registry, 'playerVisualProfileId', profileId)
    }

    gameManager.eventBus.emit('player_visual_profile_changed', {
      type: 'player_visual_profile_changed',

      profileId,
    })
  }

  publishProfile()

  watch(
    () => [player.realmId, player.cultivationPath] as const,

    () => publishProfile(),
  )

  /**
   * Host readiness requires a NONZERO measured size, not just an existing
   * game. The canvas can mount before its ancestors are laid out (now more
   * easily, since it mounts behind a closed curtain), and Phaser locks its
   * drawing-buffer size at construction - handing a 0x0 game to the adapter
   * lets a primary scene start against a zero-sized buffer.
   */
  const publishHostWhenSized = () => {
    if (!game || hostPublished) {
      return
    }

    if (container.clientWidth <= 0 || container.clientHeight <= 0) {
      return
    }

    hostPublished = true
    sceneAdapter?.setGame(game)
  }

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]

    if (!entry || !game) {
      return
    }

    const { width, height } = entry.contentRect

    if (width > 0 && height > 0) {
      game.scale.resize(width, height)
      publishHostWhenSized()
    }
  })

  resizeObserver.observe(container)

  publishHostWhenSized()
  if (!game.isBooted) {
    game.events.once('ready', publishHostWhenSized)
  }
}

onUnmounted(() => {
  isAlive = false
  hostPublished = false

  sceneAdapter?.setGame(null)
  bundleManager?.setLoaderScene(null)

  positionsCleanup?.()

  positionsCleanup = null

  resizeObserver?.disconnect()
  resizeObserver = null

  ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = undefined

  game?.destroy(true)

  game = null
})

// Expose cho test/parent — bootError null nghĩa là bootstrap OK hoặc
// đang chạy; khác null nghĩa là import('phaser')/scenes hoặc
// new Phaser.Game() đã throw và đã dọn dẹp xong.
defineExpose({ bootError })
</script>

<template>
  <div ref="containerRef" class="phaser-canvas">
    <p v-if="bootError" class="phaser-canvas__boot-error">{{ bootError }}</p>
  </div>
</template>

<style scoped>
.phaser-canvas {
  width: 100%;
  height: 100%;
}

/* Task 4 — tín hiệu tối giản tại chỗ khi bootstrap Phaser lỗi (KHÔNG
   route qua errorStore/ErrorScreen.vue toàn app — xem ghi chú ở khai
   báo bootError phía trên); chỉ là fallback text ngay trong container
   canvas rỗng, không thiết kế UI mới. */
.phaser-canvas__boot-error {
  margin: 0;
  padding: 12px;
  color: var(--paper-text-soft, #8a8a8a);
  font-size: var(--text-sm, 0.85rem);
  text-align: center;
}
</style>
