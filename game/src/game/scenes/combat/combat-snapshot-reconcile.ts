// combat-snapshot-reconcile (Wave-3 large-file split) - tach tu CombatScene.ts.
// Snapshot->sprite reconciliation: applies 'positions' (legacy real-time) and
// 'turn_battle_entity_snapshot' (turn engine) events to the scene's sprite
// set - spawn telegraph gating, create/update/remove, HP bars, position
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

  // Combat Grid Rework - COALESCE: nhieu event 'positions' dong bo trong
  // 1 frame chi giu snapshot MOI NHAT, apply DUNG MOT lan trong update().
  // Cadence = khoang cach giua 2 SNAPSHOT (lastSnapshotAt), clamp
  // [MIN_SEGMENT_DURATION_MS, MAX_SEGMENT_DURATION_MS].
  onPositions(event: BattlePositionsEvent) {
    const scene = this.scene
    const now = scene.time.now

    // 6A-T5 - HUD HP fast-path from positions (before any vitals event).
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

    // Spawn VFX reconcile TRUOC enemy sprites: id roi spawningEnemies =
    // materialize xong -> danh dau de sprite moi tao duoi day fade-in.
    scene.reconcileSpawnVfx(event)

    // Player spawn reconcile (plan sec12.2): entityVisual.playerMaterialized false =
    // an sprite; playerSpawn hien = ve telegraph tai projected cell;
    // telegraph bien mat = materialize -> hien sprite voi fade-in.
    scene.reconcilePlayerSpawn(event)

    scene.reconcileEnemySprites(event.enemies)

    // Grid fallback cache (plan sec7.1 muc 3) - o cuoi cung theo snapshot
    // positions, dung khi ca sprite lan screen cache da mat.
    for (const enemy of event.enemies) {
      scene.trackSourceGridPosition(enemy.id, enemy.row, enemy.x)
    }

    const playerSprite = scene.sprites.get(PLAYER_ID)

    if (playerSprite && playerSprite.row !== event.playerRow) {
      // Teleport qua snapshot (fallback khi lo miss event rieng):
      // snap tuc thoi, KHONG tween qua hang trung gian.
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

  // Combat Art Pipeline Task 5 (2026-09-05) - thay the snapshot DONG CUNG
  // (chi seed mot lan tu 'positions' cua legacy engine luc battle start) bang
  // du lieu SONG moi fixed step tu turn engine (xem TurnActionPresentationEvents.ts).
  // Tong quat hoa dung tinh than reconcileEnemySprites() cho CA HAI phe.
  onTurnBattleEntitySnapshot(event: TurnBattleEntitySnapshotEvent) {
    // Turn-Based Wave Redesign (2026-09-06) - countdown reconcile PHAI
    // chay TRUOC reconcileCombatantSprites('player', ...): lan dau 1
    // player/companion id xuat hien trong event.players (ngay tu tick dau
    // countdown, KHONG nhu enemy phai cho pending), nhanh 'create' cua
    // reconcileCombatantSprites() se setVisible(true) ngay - can
    // entityVisual.pending da co id do SAN de nhanh 'create' biet
    // giu an (xem nhanh 'create').
    this.reconcileTurnCountdownSpawn(event)

    // Turn-Based Wave Redesign (2026-09-06) - enemy wave telegraph: tai dung
    // dung reconcileSpawnVfx() cua legacy qua SpawnVfxSnapshot (Task 6) -
    // id bien mat khoi pendingEnemySpawns = materialize -> entityVisual.materializing
    // danh dau TRUOC khi reconcileCombatantSprites tao sprite (thu tu giong
    // applyPendingPositions() cua legacy: spawn VFX reconcile chay truoc
    // sprite reconcile) de nhanh 'create' kip consume fade-in materialize.
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

    // 6A-T5 - HUD HP/MP fast-path from entity snapshot (legacy fast-path
    // positions already carry playerCurrentHp): seed values on the first
    // snapshot instead of waiting for the first 'entity_vitals_changed'
    // (HUD stays blank until then).
    // update* ghi object visibility truc tiep - chi feed khi phase song
    // so mot snapshot tre sau battle_end khong re-show layer da an.
    const playerState = event.players.find((state) => state.id === PLAYER_ID)

    if (playerState && event.phase !== 'victory' && event.phase !== 'defeat') {
      this.scene.playerHud?.updateHp(playerState.currentHp, playerState.maxHp)

      if (playerState.maxMp > 0) {
        this.scene.playerHud?.updateMp(playerState.currentMp, playerState.maxMp)
      }
    }
  }

  /**
   * Turn-Based Wave Redesign (2026-09-06) - telegraph dem 3->2->1 cho CA
   * party (player + companion). countdownProgress undefined = countdown
   * het -> flush moi handle con treo + hien sprite tung id. KHONG dung
   * reconcilePlayerSpawn() (legacy real-time).
   *
   * 2026-09-12 fix (user report: player art already on the field before
   * its spawn telegraph ran) - 'intro' ALSO has countdownProgress ===
   * undefined, but it means "countdown has not started", not "countdown
   * done". An intro snapshot used to fall straight into the flush branch
   * (empty pending set -> no-op), then the 'create' branch of
   * reconcileCombatantSprites() saw the id as not pending and called
   * setVisible(true) - the player stayed visible through intro and under
   * its own countdown telegraph. The phase field on the snapshot contract
   * separates the two meanings: intro marks pending so 'create' stays
   * hidden; only the flush reveals.
   */
  reconcileTurnCountdownSpawn(event: TurnBattleEntitySnapshotEvent) {
    const scene = this.scene

    if (event.phase === 'intro') {
      // Pre-combat intro: no telegraph runs yet, but ids already appear in
      // the snapshot - mark them pending so the 'create' branch keeps them
      // hidden until the countdown-end flush. Enemies are marked too: a
      // direct startBattle() may carry pre-materialized enemies in
      // battle.enemies, and "both sides spawn first, then appear" means
      // they stay hidden for the same intro window.
      scene.entityVisual.markPending(event.players.map((state) => state.id))
      scene.entityVisual.markPending(event.enemies.map((state) => state.id))

      return
    }

    if (event.countdownProgress === undefined) {
      // Countdown ended - the gating window is over: complete every hanging
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

      // Reset interpolation state alongside the handles it drives - a
      // refight's countdown must start its telegraph from 0, not resume
      // from the previous battle's last shown value.
      scene.telegraph.reset()

      return
    }

    // Enemies already materialized in the snapshot (a direct startBattle()
    // that skipped 'intro') join the same hidden window - marked pending so
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

    // The whole party shares ONE countdown progress - set the chase target
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
        // Fix round 1 (Task 5 review, Important) - dung name/isBoss THAT tu
        // schema (TurnActionPresentationEvents.toVisualState()) thay vi
        // hardcode false/id. Day chinh la duong tao sprite DAU TIEN cho enemy
        // cac wave sau wave 1 (getOrCreateSprite no-op neu id da co trong
        // scene.sprites) - hardcode isBoss:false o day tung lam mat luon HP
        // bar boss (1.45x width + BOSS_HP_FILL_COLOR, xem combat-grid-view.ts)
        // cho dung nhung boss ma task nay sinh ra de fix.
        // `action.state.row` den tu entityGridPosition() - nguon DUY NHAT
        // san xuat LaneIndex hop le cho luong turn-based nay, nen cast an
        // toan o bien; khong them runtime validation (per brief).
        const sprite = scene.getOrCreateSprite(
          action.state.id,
          color,
          action.state.name,
          action.state.row as LaneIndex,
          { currentHp: action.state.currentHp, maxHp: action.state.maxHp, isBoss: action.state.isBoss },
        )

        // FE-06 - the player sprite pre-exists (created hidden at scene
        // create()) so getOrCreateSprite is a no-op for it; sync the
        // authored name onto the pre-created label instead of leaving
        // the 'Player' placeholder.
        sprite.label.setText(action.state.name)

        scene.positionInterp.snapInterpolationTarget(action.state.id, action.state.column)
        scene.positionSprite(sprite, action.state.column, action.state.id)

        // Bug fix (2026-09-06, user report "khong thay nhan vat nao trong
        // combat") - sprite Player duoc tao AN o create() (setVisible(false),
        // cho event 'positions' LEGACY goi reconcilePlayerSpawn() de hien lai
        // sau materialize). Turn-based combat khong con tick legacy
        // BattleSystem (xem TurnActionPresentationEvents.ts) nen event do
        // khong bao gio toi nua - sprite ket vo hinh vinh vien. Snapshot
        // turn-based tu lo hien sprite ngay khi id do lan dau xuat hien.
        // Turn-Based Wave Redesign (2026-09-06) - party countdown telegraph:
        // a pending id in entityVisual means pre-combat gating is NOT
        // finished - keep the sprite hidden; reconcileTurnCountdownSpawn()
        // flips it visible at the countdown-end flush (see that function).
        // The set holds event.players during countdown plus BOTH sides
        // during 'intro' (a direct startBattle() may carry already-
        // materialized enemies - same hidden window as the party); wave
        // enemies come through pendingEnemySpawns instead and never enter
        // this set, so their behaviour is unchanged.
        scene.entityVisual.applyGating(action.state.id, sprite)

        // Materialize tu telegraph (Turn-Based Wave Redesign, 2026-09-06) -
        // dung co che da dung cho legacy enemy (reconcileEnemySprites()).
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

        // `action.state.row` - cung trust boundary nhu nhanh 'create' o tren
        // (entityGridPosition() la nguon duy nhat).
        sprite.row = action.state.row as LaneIndex
        scene.positionInterp.snapInterpolationTarget(action.state.id, action.state.column)
        scene.positionSprite(sprite, action.state.column, action.state.id)
        scene.updateEnemyHealthBar(sprite, action.state.currentHp, action.state.maxHp)
        continue
      }

      // 'remove' - id alive:false hoac bien mat khoi snapshot ma KHONG di
      // qua event 'death' rieng (race/fallback). Neu onDeath() dang chay
      // death sequence cho id nay (dyingIds/playerDying) thi BO QUA - sequence
      // do tu lo xoa sprite khi xong, chay them o day la double-destroy.
      const isDying = action.id === PLAYER_ID ? scene.playerDying : scene.dyingIds.has(action.id)

      if (isDying) {
        continue
      }

      const sprite = scene.sprites.get(action.id)

      if (!sprite) {
        continue
      }

      // Combat Art Pipeline Task 9 (2026-09-05) - di qua CUNG death sequence
      // voi onDeath() (phat '-death' + hoan destroy toi khi animation/tween
      // xong) thay vi xoa ngay, de entity chet theo duong fallback nay cung
      // duoc choi animation chet day du (spec sec9).
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

      // Vua materialize tu telegraph - fade-in + scale 0.7->1 (bong/mau/
      // ten chi hien tu khoanh khac nay, dung spec spawn moi).
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
