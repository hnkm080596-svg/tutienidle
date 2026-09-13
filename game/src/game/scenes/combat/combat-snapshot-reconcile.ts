// combat-snapshot-reconcile (Wave-3 large-file split) — tach tu CombatScene.ts.
// Snapshot→sprite reconciliation: applies 'positions' (legacy real-time) and
// 'turn_battle_entity_snapshot' (turn engine) events to the scene's sprite
// set — spawn telegraph gating, create/update/remove, HP bars, position
// interpolation targets. All state (sprites/entityVisual/knownIds/pending
// positions/telegraph fields) stays on the scene as Internal module-boundary
// members; this module carries the reconcile mechanism only.
import type {
  BattlePositionsEvent,
} from '@/core/battle/BattleEvents'
import type { LaneIndex } from '@/core/battle/BattleLane'
import type { TurnBattleEntitySnapshotEvent } from '@/core/battle/turn/TurnActionPresentationEvents'
import { spawnEnemySpawnVfx } from '@/game/support/EnemySpawnVfx'

import type { CombatScene } from '../CombatScene'
import type { SpawnVfxSnapshot } from './combat-vfx-spawner'
import { planCombatantSpriteReconciliation } from './combat-entity-reconciliation'
import {
  ENEMY_COLOR,
  MAX_SEGMENT_DURATION_MS,
  PLAYER_COLOR,
  PLAYER_ID,
} from './combatConstants'

export class CombatSnapshotReconcile {
  constructor(private readonly scene: CombatScene) {}

  // Combat Grid Rework — COALESCE: nhiều event 'positions' đồng bộ trong
  // 1 frame chỉ giữ snapshot MỚI NHẤT, apply ĐÚNG MỘT lần trong update().
  // Cadence = khoảng cách giữa 2 SNAPSHOT (lastSnapshotAt), clamp
  // [MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS].
  onPositions(event: BattlePositionsEvent) {
    const scene = this.scene
    const now = scene.time.now

    // 6A-T5 — HUD HP fast-path từ positions (khi chưa có vitals event).
    scene.playerHud?.updateHp(event.playerCurrentHp, event.playerMaxHp)

    if (scene.lastSnapshotAt !== undefined) {
      scene.pendingCadence = Math.min(
        MAX_SEGMENT_DURATION_MS,
        Math.max(50, now - scene.lastSnapshotAt),
      )
    }

    scene.lastSnapshotAt = now
    scene.pendingPositions = event
  }

  applyPendingPositions(event: BattlePositionsEvent) {
    const scene = this.scene

    // Spawn VFX reconcile TRƯỚC enemy sprites: id rời spawningEnemies =
    // materialize xong → đánh dấu để sprite mới tạo dưới đây fade-in.
    scene.reconcileSpawnVfx(event)

    // Player spawn reconcile (plan §12.2): entityVisual.playerMaterialized false =
    // ẩn sprite; playerSpawn hiện = vẽ telegraph tại projected cell;
    // telegraph biến mất = materialize → hiện sprite với fade-in.
    scene.reconcilePlayerSpawn(event)

    scene.reconcileEnemySprites(event.enemies)

    // Grid fallback cache (plan §7.1 mức 3) — ô cuối cùng theo snapshot
    // positions, dùng khi cả sprite lẫn screen cache đã mất.
    for (const enemy of event.enemies) {
      scene.trackSourceGridPosition(enemy.id, enemy.row, enemy.x)
    }

    const playerSprite = scene.sprites.get(PLAYER_ID)

    if (playerSprite && playerSprite.row !== event.playerRow) {
      // Teleport qua snapshot (fallback khi lỡ miss event riêng):
      // snap tức thời, KHÔNG tween qua hàng trung gian.
      playerSprite.row = event.playerRow
      scene.positionInterp.snapInterpolationTarget(PLAYER_ID, event.playerX)
      scene.positionSprite(playerSprite, event.playerX)
    }

    scene.positionInterp.setInterpolationTarget(
      PLAYER_ID,
      event.playerX,
      scene.pendingCadence,
      scene.lastSnapshotAt,
    )

    for (const enemy of event.enemies) {
      scene.positionInterp.setInterpolationTarget(
        enemy.id,
        enemy.x,
        scene.pendingCadence,
        scene.lastSnapshotAt,
      )
    }
  }

  // Combat Art Pipeline Task 5 (2026-09-05) — thay thế snapshot ĐÔNG CỨNG
  // (chỉ seed một lần từ 'positions' của legacy engine lúc battle start) bằng
  // dữ liệu SỐNG mỗi fixed step từ turn engine (xem TurnActionPresentationEvents.ts).
  // Tổng quát hoá đúng tinh thần reconcileEnemySprites() cho CẢ HAI phe.
  onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    // Turn-Based Wave Redesign (2026-09-06) — countdown reconcile PHẢI
    // chạy TRƯỚC reconcileCombatantSprites('player', ...): lần đầu 1
    // player/companion id xuất hiện trong event.players (ngay từ tick đầu
    // countdown, KHÔNG như enemy phải chờ pending), nhánh 'create' của
    // reconcileCombatantSprites() sẽ setVisible(true) ngay — cần
    // entityVisual.pending đã có id đó SẴN để nhánh 'create' biết
    // giữ ẩn (xem nhánh 'create').
    this.reconcileTurnCountdownSpawn(event)

    // Turn-Based Wave Redesign (2026-09-06) — enemy wave telegraph: tái dùng
    // đúng reconcileSpawnVfx() của legacy qua SpawnVfxSnapshot (Task 6) —
    // id biến mất khỏi pendingEnemySpawns = materialize → entityVisual.materializing
    // đánh dấu TRƯỚC khi reconcileCombatantSprites tạo sprite (thứ tự giống
    // applyPendingPositions() của legacy: spawn VFX reconcile chạy trước
    // sprite reconcile) để nhánh 'create' kịp consume fade-in materialize.
    this.scene.reconcileSpawnVfx({
      spawningEnemies: event.pendingEnemySpawns.map((pending) => ({
        id: pending.id,
        row: pending.row as LaneIndex,
        column: pending.column,
        progress: pending.progress,
        isBoss: pending.isBoss,
        presetId: pending.presetId,
      })),
    })

    this.reconcileCombatantSprites('player', event.players, PLAYER_COLOR)
    this.reconcileCombatantSprites('enemy', event.enemies, ENEMY_COLOR)
  }

  /**
   * Turn-Based Wave Redesign (2026-09-06) — telegraph đếm 3→2→1 cho CẢ
   * party (player + companion). countdownProgress undefined = countdown
   * hết → flush mọi handle còn treo + hiện sprite từng id. KHÔNG đụng
   * reconcilePlayerSpawn() (legacy real-time).
   *
   * 2026-09-12 fix (user report: player art already on the field before
   * its spawn telegraph ran) — 'intro' ALSO has countdownProgress ===
   * undefined, but it means "countdown has not started", not "countdown
   * done". An intro snapshot used to fall straight into the flush branch
   * (empty pending set -> no-op), then the 'create' branch of
   * reconcileCombatantSprites() saw the id as not pending and called
   * setVisible(true) — the player stayed visible through intro and under
   * its own countdown telegraph. The phase field on the snapshot contract
   * separates the two meanings: intro marks pending so 'create' stays
   * hidden; only the flush reveals.
   */
  reconcileTurnCountdownSpawn(event: TurnBattleEntitySnapshotEvent) {
    const scene = this.scene

    if (event.phase === 'intro') {
      // Pre-combat intro: no telegraph runs yet, but ids already appear in
      // the snapshot — mark them pending so the 'create' branch keeps them
      // hidden until the countdown-end flush. Enemies are marked too: a
      // direct startBattle() may carry pre-materialized enemies in
      // battle.enemies, and "both sides spawn first, then appear" means
      // they stay hidden for the same intro window.
      scene.entityVisual.markPending(event.players.map((state) => state.id))
      scene.entityVisual.markPending(event.enemies.map((state) => state.id))

      return
    }

    if (event.countdownProgress === undefined) {
      // Countdown ended — the gating window is over: complete every hanging
      // handle (materialize flash), then reveal the union of still-pending
      // ids and every materialized id in the snapshot. Pending ids can lack
      // a handle (projection not ready when their telegraph would have
      // spawned, or marked during 'intro') but must still materialize; and
      // a scene that rebinds mid-'fighting' (never saw the gating window)
      // reveals its party through the snapshot ids.
      for (const handle of scene.turnCountdownSpawnVfxHandles.values()) {
        handle.complete()
      }

      scene.entityVisual.revealPending(
        [...event.players, ...event.enemies]
          .filter((state) => state.alive)
          .map((state) => state.id),
      )

      scene.turnCountdownSpawnVfxHandles.clear()

      // Reset interpolation state alongside the handles it drives — a
      // refight's countdown must start its telegraph from 0, not resume
      // from the previous battle's last shown value.
      scene.telegraph.reset()

      return
    }

    // Enemies already materialized in the snapshot (a direct startBattle()
    // that skipped 'intro') join the same hidden window — marked pending so
    // the 'create' branch keeps them hidden until the flush. They get no
    // countdown handle: the enemy telegraph belongs to the wave path
    // (pendingEnemySpawns), these simply materialize at flush.
    scene.entityVisual.markPending(event.enemies.map((state) => state.id))

    for (const player of event.players) {
      scene.entityVisual.markPending([player.id])

      if (scene.turnCountdownSpawnVfxHandles.has(player.id)) {
        continue
      }

      if (!scene.projection) {
        continue
      }

      const handle = spawnEnemySpawnVfx({
        scene,
        projection: scene.projection,
        row: player.row as LaneIndex,
        column: player.column,
        presetId: 'player_spawn',
        uprightDepth: scene.resolveUprightVfxDepth({
          row: player.row as LaneIndex,
          column: player.column,
        }),
      })

      scene.turnCountdownSpawnVfxHandles.set(player.id, handle)
    }

    // The whole party shares ONE countdown progress — set the chase target
    // once per snapshot rather than once per player (telegraph.setTarget is
    // itself a no-op when the target hasn't actually changed).
    scene.telegraph.setTarget(event.countdownProgress)
  }

  reconcileCombatantSprites(
    side: 'player' | 'enemy',
    states: TurnBattleEntitySnapshotEvent['players'],
    color: number,
  ) {
    const scene = this.scene
    const knownIds =
      side === 'player' ? scene.knownTurnBattlePlayerIds : scene.knownTurnBattleEnemyIds
    const actions = planCombatantSpriteReconciliation(knownIds, states)

    for (const action of actions) {
      if (action.type === 'create') {
        // Fix round 1 (Task 5 review, Important) — dùng name/isBoss THẬT từ
        // schema (TurnActionPresentationEvents.toVisualState()) thay vì
        // hardcode false/id. Đây chính là đường tạo sprite ĐẦU TIÊN cho enemy
        // các wave sau wave 1 (getOrCreateSprite no-op nếu id đã có trong
        // scene.sprites) — hardcode isBoss:false ở đây từng làm mất luôn HP
        // bar boss (1.45x width + BOSS_HP_FILL_COLOR, xem combat-grid-view.ts)
        // cho đúng những boss mà task này sinh ra để fix.
        // `action.state.row` đến từ entityGridPosition() — nguồn DUY NHẤT
        // sản xuất LaneIndex hợp lệ cho luồng turn-based này, nên cast an
        // toàn ở biên; không thêm runtime validation (per brief).
        const sprite = scene.getOrCreateSprite(
          action.state.id,
          color,
          action.state.name,
          action.state.row as LaneIndex,
          { currentHp: action.state.currentHp, maxHp: action.state.maxHp, isBoss: action.state.isBoss },
        )

        scene.positionInterp.snapInterpolationTarget(action.state.id, action.state.column)
        scene.positionSprite(sprite, action.state.column, action.state.id)

        // Bug fix (2026-09-06, user report "không thấy nhân vật nào trong
        // combat") — sprite Player được tạo ẨN ở create() (setVisible(false),
        // chờ event 'positions' LEGACY gọi reconcilePlayerSpawn() để hiện lại
        // sau materialize). Turn-based combat không còn tick legacy
        // BattleSystem (xem TurnActionPresentationEvents.ts) nên event đó
        // không bao giờ tới nữa — sprite kẹt vô hình vĩnh viễn. Snapshot
        // turn-based tự lo hiện sprite ngay khi id đó lần đầu xuất hiện.
        // Turn-Based Wave Redesign (2026-09-06) — party countdown telegraph:
        // a pending id in entityVisual means pre-combat gating is NOT
        // finished — keep the sprite hidden; reconcileTurnCountdownSpawn()
        // flips it visible at the countdown-end flush (see that function).
        // The set holds event.players during countdown plus BOTH sides
        // during 'intro' (a direct startBattle() may carry already-
        // materialized enemies — same hidden window as the party); wave
        // enemies come through pendingEnemySpawns instead and never enter
        // this set, so their behaviour is unchanged.
        scene.entityVisual.applyGating(action.state.id, sprite)

        // Materialize từ telegraph (Turn-Based Wave Redesign, 2026-09-06) —
        // đúng cơ chế đã dùng cho legacy enemy (reconcileEnemySprites()).
        scene.entityVisual.consumeMaterializing(action.state.id, sprite)

        if (action.state.id === PLAYER_ID) {
          scene.entityVisual.markPlayerMaterialized()
        }

        continue
      }

      if (action.type === 'update') {
        const sprite = scene.sprites.get(action.state.id)

        if (!sprite) {
          continue
        }

        // `action.state.row` — cùng trust boundary như nhánh 'create' ở trên
        // (entityGridPosition() là nguồn duy nhất).
        sprite.row = action.state.row as LaneIndex
        scene.positionInterp.snapInterpolationTarget(action.state.id, action.state.column)
        scene.positionSprite(sprite, action.state.column, action.state.id)
        scene.updateEnemyHealthBar(sprite, action.state.currentHp, action.state.maxHp)
        continue
      }

      // 'remove' — id alive:false hoặc biến mất khỏi snapshot mà KHÔNG đi
      // qua event 'death' riêng (race/fallback). Nếu onDeath() đang chạy
      // death sequence cho id này (dyingIds/playerDying) thì BỎ QUA — sequence
      // đó tự lo xóa sprite khi xong, chạy thêm ở đây là double-destroy.
      const isDying = action.id === PLAYER_ID ? scene.playerDying : scene.dyingIds.has(action.id)

      if (isDying) {
        continue
      }

      const sprite = scene.sprites.get(action.id)

      if (!sprite) {
        continue
      }

      // Combat Art Pipeline Task 9 (2026-09-05) — đi qua CÙNG death sequence
      // với onDeath() (phát '-death' + hoãn destroy tới khi animation/tween
      // xong) thay vì xóa ngay, để entity chết theo đường fallback này cũng
      // được chơi animation chết đầy đủ (spec §9).
      scene.beginDeathSequence(sprite, action.id)
    }

    const nextKnownIds = new Set(states.map((state) => state.id))

    if (side === 'player') {
      scene.knownTurnBattlePlayerIds = nextKnownIds
    } else {
      scene.knownTurnBattleEnemyIds = nextKnownIds
    }
  }

  reconcileEnemySprites(enemies: BattlePositionsEvent['enemies']) {
    const scene = this.scene
    const currentIds = new Set(enemies.map((enemy) => enemy.id))

    for (const enemy of enemies) {
      if (scene.sprites.has(enemy.id)) {
        continue
      }

      const sprite = scene.getOrCreateSprite(enemy.id, ENEMY_COLOR, enemy.name, enemy.row, enemy)

      // Vừa materialize từ telegraph — fade-in + scale 0.7→1 (bóng/máu/
      // tên chỉ hiện từ khoảnh khắc này, đúng spec spawn mới).
      scene.entityVisual.consumeMaterializing(enemy.id, sprite)
    }

    for (const [id, sprite] of scene.sprites) {
      if (id === PLAYER_ID || currentIds.has(id) || scene.dyingIds.has(id)) {
        continue
      }

      scene.destroyEntitySprite(sprite)
      scene.sprites.delete(id)
      scene.positionInterp.delete(id)
    }
  }
}
