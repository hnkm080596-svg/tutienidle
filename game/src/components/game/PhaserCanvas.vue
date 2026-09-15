<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import type Phaser from 'phaser'
import {
  PHASER_SCENE_ADAPTER_KEY,
  ASSET_BUNDLE_MANAGER_KEY,
  VUE_ROUTE_ADAPTER_KEY,
} from '@/presentation/PresentationContracts'
import { PRIMARY_SCENE_ROUTES } from '@/presentation/PhaserSceneAdapter'
import { useGameManager } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import { writeGate, type GateRegistry } from '@/presentation/gate/PresentationGate'
import { useDynamicRegion } from '@/presentation/host/useDynamicRegion'
import type { PlayerVisualProfileId } from '@/presentation/art/PlayerVisualProfiles'
import { makeKiemBarReader, registerKiemBarReader } from '@/presentation/bridges/kiemBarBridge'
import { makeTheBarReader, registerTheBarReader } from '@/presentation/bridges/theBarBridge'

const gameManager = useGameManager()
const player = usePlayerStore()
const sceneAdapter = inject(PHASER_SCENE_ADAPTER_KEY, null)
const bundleManager = inject(ASSET_BUNDLE_MANAGER_KEY, null)
const routeAdapter = inject(VUE_ROUTE_ADAPTER_KEY, null)

const containerRef = ref<HTMLDivElement | null>(null)

let hostPublished = false
let hostGame: Phaser.Game | null = null

/**
 * Host readiness requires a NONZERO measured size, not just an existing game.
 * The canvas can mount before its ancestors are laid out (now more easily,
 * since it mounts behind a closed curtain), and Phaser locks its
 * drawing-buffer size at construction - handing a 0x0 game to the adapter lets
 * a primary scene start against a zero-sized buffer.
 */
function publishHostWhenSized(): void {
  const container = containerRef.value

  if (hostPublished || !container || !hostGame) {
    return
  }

  if (container.clientWidth <= 0 || container.clientHeight <= 0) {
    return
  }

  hostPublished = true
  sceneAdapter?.setGame(hostGame)
}

// Seeds everything the scenes read through the gate, and returns the cleanup
// for what it subscribed to. Runs after construction and before any scene's
// create(), which is what makes a late-starting CombatScene able to read a
// snapshot rather than miss it.
function seedRegion(registry: GateRegistry): () => void {
  // MainScene.ts/CombatScene.ts CHỈ giao tiếp với core qua EventBus này (không
  // cầm tham chiếu GameManager trực tiếp) — mọi thứ chúng cần (vị trí
  // player/quái, animation attack/critical/hit/dodge/cast/death/battle_start/
  // battle_end/combat_scene_exit) đều tới qua đây.
  writeGate(registry, 'eventBus', gameManager.eventBus)
  writeGate(registry, 'gameManager', gameManager)

  if (sceneAdapter) {
    writeGate(registry, 'sceneAdapter', sceneAdapter)
  }

  // AssetLoaderScene picks this up in its own create() and registers itself -
  // see the note there on why the host cannot fetch the scene directly.
  if (bundleManager) {
    writeGate(registry, 'bundleManager', bundleManager)
  }

  // Late-join replay seam (legacy): 'lastBattlePositionsSnapshot' let a
  // late-starting CombatScene fast-forward the spawn telegraph phase.
  // ARCH-014 (M12): the 'positions' event has NO live producer (the legacy
  // real-time BattleSystem that emitted it was deleted), so the cache
  // listener is retired. The gate + CombatScene.create() fallback stay as
  // the standalone/legacy-test seam; the clears remain so anything that
  // still writes the gate (tests, restored paths) cannot leak a stale
  // snapshot into the next battle.
  const clearPositionsSnapshot = () => {
    writeGate(registry, 'lastBattlePositionsSnapshot', undefined)
  }

  gameManager.eventBus.on<void>('battle_end', clearPositionsSnapshot)
  gameManager.eventBus.on<void>('combat_scene_exit', clearPositionsSnapshot)

  // 9.4 — Kiếm bar reader (Kiếm Thế / Kiếm Ý tạm) đăng ký từ đây (có
  // gameManager + player store) vào registry; CombatScene poll mỗi frame.
  registerKiemBarReader(registry, makeKiemBarReader(gameManager, () => usePlayerStore()))

  // Task 16 — The bar reader (Pháp Tu) — cùng bridge pattern.
  registerTheBarReader(registry, makeTheBarReader(gameManager, () => usePlayerStore()))

  // Player visual profile bridge (player-body-anchor-reward-gourd-plan §4.2) —
  // snapshot ID vào registry để scene đọc lúc create() (không bỏ lỡ trạng thái
  // khi scene khởi động muộn), và phát event qua EventBus mỗi khi realm/path
  // đổi. Scenes chỉ nhận PROFILE ID.
  const publishProfile = () => {
    const profileId: PlayerVisualProfileId = player.visualProfileId

    writeGate(registry, 'playerVisualProfileId', profileId)

    gameManager.eventBus.emit('player_visual_profile_changed', {
      type: 'player_visual_profile_changed',

      profileId,
    })
  }

  publishProfile()

  // This watch is created after setup has finished, so it is outside the
  // component's effect scope and Vue will not stop it. It used to leak for
  // exactly that reason; the seed cleanup stops it now.
  const stopProfileWatch = watch(
    () => [player.realmId, player.cultivationPath] as const,

    () => publishProfile(),
  )

  return () => {
    stopProfileWatch()

    gameManager.eventBus.off<void>('battle_end', clearPositionsSnapshot)
    gameManager.eventBus.off<void>('combat_scene_exit', clearPositionsSnapshot)
  }
}

// Combat UI Redesign — 2 scene ĐĂNG KÝ cùng lúc, chỉ MainScene (đầu mảng) tự
// động active — CombatScene nằm sẵn nhưng dormant tới khi MainScene tự gọi
// this.scene.start('CombatScene') lúc 'battle_start'. Chỉ 1 Phaser.Game/canvas
// DUY NHẤT cho cả 2 — scene chuyển qua lại KHÔNG destroy/tạo lại Game.
const region = useDynamicRegion({
  container: containerRef,

  // T6.4 code-split — Phaser + 4 scene classes load qua dynamic import (chunk
  // riêng ~1.2MB, không chặn entry).
  load: async () => {
    const [
      { default: Phaser },
      { AssetLoaderScene },
      { MainScene },
      { CombatScene },
      { TribulationScene },
    ] = await Promise.all([
      import('phaser'),
      import('@/game/scenes/AssetLoaderScene'),
      import('@/game/scenes/MainScene'),
      import('@/game/scenes/CombatScene'),
      import('@/game/scenes/TribulationScene'),
    ])

    return { Phaser, scenes: [AssetLoaderScene, MainScene, CombatScene, TribulationScene] }
  },

  config: {
    transparent: true,
    // roundPixels (fix "nhân vật đôi khi bị blur", 2026-08-26): sprite đứng
    // giữa pixel lẻ (projection tọa độ thập phân + walk sway/bob) bị sample
    // mờ; snap vị trí vẽ về lưới nguyên pixel cho cạnh nét.
    render: { roundPixels: true },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
  },

  seed: seedRegion,

  // §4.2 seed-time validation. Every read site downstream degrades rather than
  // throws - deliberately, and with a regression test protecting it - so this
  // is the one place a missing required key is reported as what it is: a wiring
  // bug at the host, named, before a scene runs.
  validateSeed: true,

  onBooted: (game) => {
    hostGame = game

    // Expose cho e2e/visual gate — đọc battlefieldGeometry qua registry mà
    // không cần chạm canvas pixel. Không có code gameplay dùng nó.
    ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = game

    publishHostWhenSized()
  },

  // Boot can finish before the container has a measured size, so 'ready' is a
  // second chance to publish. The region owns the subscription; this shell no
  // longer touches `game.events` at all.
  onReady: publishHostWhenSized,

  // The container's size is what gates readiness, so every resize is another
  // chance to publish a host that was too small to publish before.
  onResized: () => publishHostWhenSized(),

  onTeardown: () => {
    hostPublished = false
    hostGame = null

    sceneAdapter?.setGame(null)
    bundleManager?.setLoaderScene(null)

    ;(window as unknown as { __tutienPhaserGame?: Phaser.Game }).__tutienPhaserGame = undefined
  },
})

onMounted(() => region.start())

// ARCH-013/L04 — host bootstrap retry hook. A failed import/construct leaves
// region.bootError set and NO Phaser.Game behind it, while a failed game-route
// transition keeps this component mounted (useBootFlow's failedRequest clause)
// so the error shell's Retry/Back stay reachable. coordinator.retry() — and
// Back, and any later request — only re-runs the TRANSITION; it cannot
// recreate the game, so without this hook the retried transition would strand
// inside ensureFor's waitForLoaderScene until the asset deadline. Every new
// transition bumps transitionId with targetRoute already set; when that target
// is a Phaser-backed route and this host is down, boot it again. start() is a
// no-op while a game lives or an import for the current generation is in
// flight, so healthy transitions pay nothing.
watch(
  () => routeAdapter?.transitionId.value,
  () => {
    const target = routeAdapter?.targetRoute.value ?? null

    if (region.bootError.value !== null && target !== null && PRIMARY_SCENE_ROUTES[target]) {
      region.start()
    }
  },
)

// Task 4 (perf-optimize-pass, phần 3) — bootstrap error boundary. bootError is
// the region's, and it stays LOCAL: the fallback UI is the <p> below, inside
// the empty canvas container — NOT errorStore/ErrorScreen.vue, which is a
// full-screen overlay that blocks the whole app. A Phaser bootstrap failure
// (e.g. a transient chunk-load error) must not lock the menu, stats and every
// other system that is working fine (code review Task 4 finding 2).
const bootError = region.bootError

// Expose cho test/parent — bootError null nghĩa là bootstrap OK hoặc đang
// chạy; khác null nghĩa là import('phaser')/scenes hoặc new Phaser.Game() đã
// throw và đã dọn dẹp xong.
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
