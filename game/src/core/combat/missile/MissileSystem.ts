import type { CombatEntity } from '../CombatEntity'
import type { Missile, MissileDamageInfo, ProjectileBehavior } from './Missile'
import { MissileManager } from './MissileManager'
import type { EventBus } from '../../events/EventBus'

// Export để view (MainScene.ts) tính đúng thời gian bay hiển thị —
// dùng CHUNG 1 con số, tránh 2 bên tự định nghĩa lệch nhau.
export const MISSILE_SPEED = 500

// 1 mục tiêu CÒN SỐNG khả dụng cho Pierce/Bounce/AOE re-target — chỉ
// cần id + x, không cần cả CombatEntity (MissileSystem không nên biết
// về stats/HP, chỉ cần vị trí để bay).
export interface MissileTarget {
  id: string

  x: number
}

export class MissileSystem {
  constructor(
    private readonly manager: MissileManager,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Bắn missile — emit 'attack' NGAY LÚC NÀY (không phải lúc trúng,
   * xem CombatSystem.resolveMissileHit()) vì đó là lúc hành động tấn
   * công thực sự xảy ra. PassiveSystem (passiveTrigger: 'attack') và
   * MainScene (hiệu ứng vung vũ khí) đều nghe event này.
   *
   * `behavior` — Phase 3 (Pierce/Bounce/Homing/AOE), optional. Không
   * truyền = Normal, hành vi hệt như trước khi có tham số này.
   */
  fire(
    source: CombatEntity,
    target: CombatEntity,
    damage: MissileDamageInfo,
    critical: boolean,
    skillId?: string,
    behavior?: ProjectileBehavior,
  ): Missile {
    const direction: 1 | -1 = target.x >= source.x ? 1 : -1

    this.eventBus.emit('attack', {
      type: 'attack',
      sourceId: source.id,
      targetId: target.id,
    })

    const missile: Missile = {
      id: crypto.randomUUID(),

      sourceId: source.id,

      targetId: target.id,

      x: source.x,

      // Hỏa Tu (Plans/FirePath, "Tật Hỏa" minor) — % cộng thêm từ
      // source.stats.projectileSpeedPercent, nền 0 nên missile bay
      // đúng MISSILE_SPEED gốc nếu chưa có nguồn cấp nào.
      speed: MISSILE_SPEED * (1 + source.stats.projectileSpeedPercent),

      direction,

      damage,

      critical,

      skillId,

      hitEntityIds: [],

      behavior,

      pierceRemaining: behavior?.pierceCount,

      bounceRemaining: behavior?.bounceCount,
    }

    this.manager.add(missile)

    this.eventBus.emit('projectile_spawned', {
      projectileId: missile.id,
      sourceId: missile.sourceId,
      targetId: missile.targetId,
      speed: missile.speed,
      // Phaser cần biết ngay lúc spawn để quyết định bay THẲNG (velocity
      // tính 1 lần) hay bám đuổi (tính lại moveToObject mỗi frame) — xem
      // CombatScene.ts's updateProjectiles().
      homing: missile.behavior?.homing ?? false,
    })

    return missile
  }

  impact(
    missileId: string,
    targetId: string,
    getTargets: (sourceId: string) => MissileTarget[],
    resolveHit: (missile: Missile, targetId: string, isPrimary: boolean) => void,
  ) {
    const missile = this.manager.get(missileId)

    if (!missile || missile.targetId !== targetId) {
      return false
    }

    const targets = getTargets(missile.sourceId)
    const target = targets.find(candidate => candidate.id === targetId)

    if (!target) {
      this.removeMissile(missile.id)
      return false
    }

    this.resolveArrival(missile, target, targets, resolveHit)
    return true
  }

  private removeMissile(missileId: string) {
    this.manager.remove(missileId)
    this.eventBus.emit('projectile_destroyed', { projectileId: missileId })
  }

  /**
   * Quét TOÀN BỘ missile đang bay, chủ động dọn/retarget missile có
   * targetId không còn trong getTargets() (mục tiêu chết/despawn giữa
   * chừng, KHÔNG phải do chính missile này bắn trúng). BattleSystem gọi
   * method này SỚM mỗi tick 'fighting' (trước resolveMissilesHeadless()
   * ở cuối update()), để 1 missile mất mục tiêu ở tick trước được
   * retarget/dọn NGAY, phản ánh đúng trong snapshot emitPositions() gửi
   * Phaser cùng tick đó thay vì trễ thêm 1 tick.
   */
  pruneDeadTargets(getTargets: (sourceId: string) => MissileTarget[]) {
    // Nhiều missile cùng sourceId (Pierce/multi-shot) trỏ về CÙNG danh
    // sách mục tiêu còn sống trong 1 lần quét này (không missile nào ở
    // đây gây damage/giết ai) — cache theo sourceId để khỏi rebuild
    // filter+map của getTargets() lặp lại cho mỗi missile.
    const targetsCache = new Map<string, MissileTarget[]>()

    for (const missile of this.manager.getAll()) {
      let targets = targetsCache.get(missile.sourceId)

      if (!targets) {
        targets = getTargets(missile.sourceId)
        targetsCache.set(missile.sourceId, targets)
      }

      const stillAlive = targets.some(target => target.id === missile.targetId)

      if (stillAlive) {
        continue
      }

      this.retargetOrRemove(missile, targets)
    }
  }

  // Mục tiêu hiện tại của missile không còn khả dụng — đạn homing tự
  // đổi sang mục tiêu còn sống GẦN NHẤT (2026-08-22, "nếu mục tiêu chết
  // trước khi chạm tới, thay đổi mục tiêu khác gần nhất"); đạn thường
  // (hoặc không còn mục tiêu nào khác) huỷ như hành vi gốc trước đây.
  // Trả về mục tiêu MỚI nếu retarget thành công, undefined nếu đã huỷ.
  private retargetOrRemove(missile: Missile, allTargets: MissileTarget[]): MissileTarget | undefined {
    if (missile.behavior?.homing) {
      const next = this.findNearestTarget(missile, allTargets)

      if (next) {
        missile.targetId = next.id
        this.eventBus.emit('projectile_retargeted', { projectileId: missile.id, targetId: next.id })

        return next
      }
    }

    this.removeMissile(missile.id)

    return undefined
  }

  clear() {
    for (const missile of this.manager.getAll()) {
      this.eventBus.emit('projectile_destroyed', { projectileId: missile.id })
    }

    this.manager.clear()
  }

  /**
   * Di chuyển toàn bộ missile đang bay, gọi `resolveHit` cho mục tiêu
   * vừa bị trúng rồi remove missile trừ khi Pierce/Bounce còn lượt (
   * missile đó bay tiếp, KHÔNG bị remove). `getTargets` trả về TOÀN
   * BỘ mục tiêu còn sống mà `sourceId` có thể nhắm (BattleSystem trả
   * enemies cho missile của player, hoặc [player] cho missile của
   * enemy) — không giữ tham chiếu Battle trực tiếp, vì entity sống có
   * thể đổi (chết/despawn) trong lúc đạn đang bay.
   */
  update(
    deltaSeconds: number,
    getTargets: (sourceId: string) => MissileTarget[],
    // Thổ Tu Pure (Plans/EarthPath mục XVI, 2026-08-21) — `isPrimary`
    // phân biệt mục tiêu TRÚNG TRỰC TIẾP (true) với mục tiêu PHỤ trúng
    // qua behavior.aoeRadius (false), để caller (BattleSystem) áp
    // aoeSecondaryDamagePercent đúng chỗ — xem resolveArrival().
    resolveHit: (missile: Missile, targetId: string, isPrimary: boolean) => void,
  ) {
    for (const missile of this.manager.getAll()) {
      const targets = getTargets(missile.sourceId)
      let currentTarget = targets.find(target => target.id === missile.targetId)

      if (!currentTarget) {
        // Mục tiêu chết/biến mất giữa chừng (không phải do chính
        // missile này bắn trúng) — đạn homing tự đổi mục tiêu, đạn
        // thường huỷ như cũ (xem retargetOrRemove()).
        currentTarget = this.retargetOrRemove(missile, targets)

        if (!currentTarget) {
          continue
        }
      }

      // Homing — tính lại hướng bay MỖI TICK theo vị trí hiện tại của
      // mục tiêu, thay vì giữ hướng cố định lúc bắn/lúc retarget.
      if (missile.behavior?.homing) {
        missile.direction = currentTarget.x >= missile.x ? 1 : -1
      }

      missile.x += missile.speed * missile.direction * deltaSeconds

      const reached = missile.direction === 1
        ? missile.x >= currentTarget.x
        : missile.x <= currentTarget.x

      if (!reached) {
        continue
      }

      this.resolveArrival(missile, currentTarget, targets, resolveHit)
    }
  }

  /**
   * Missile vừa chạm đích — tính AOE (nếu có) rồi quyết định Pierce/
   * Bounce retarget hay remove hẳn. Tách riêng khỏi update() vì logic
   * khá dài, không phải vì tái dùng ở nơi khác.
   */
  private resolveArrival(
    missile: Missile,
    hitTarget: MissileTarget,
    allTargets: MissileTarget[],
    resolveHit: (missile: Missile, targetId: string, isPrimary: boolean) => void,
  ) {
    // impact() (đường tắt Phaser phát 'projectile_impact' khi overlap ở
    // frame render, xem BattleSystem's constructor) có thể resolve missile
    // này TRƯỚC khi update() kịp tăng dần missile.x tới đúng điểm va chạm
    // trong tick hiện tại — cập nhật NGAY tại điểm va chạm thật để
    // findBounceTarget()/findPierceTarget() bên dưới tính khoảng cách từ
    // đúng vị trí trúng, không phải vị trí cũ của tick trước.
    missile.x = hitTarget.x

    resolveHit(missile, hitTarget.id, true)

    missile.hitEntityIds.push(hitTarget.id)

    const behavior = missile.behavior

    if (behavior?.aoeRadius) {
      for (const target of allTargets) {
        if (missile.hitEntityIds.includes(target.id)) {
          continue
        }

        if (Math.abs(target.x - hitTarget.x) <= behavior.aoeRadius) {
          resolveHit(missile, target.id, false)

          missile.hitEntityIds.push(target.id)
        }
      }
    }

    // Pierce trước Bounce — 1 missile đủ cả 2 lượt thì xuyên trước,
    // nảy sau (thứ tự tuỳ chọn thiết kế, không có ý nghĩa cơ chế bắt
    // buộc vì thực tế content sẽ không kết hợp cả 2 cùng lúc).
    if (missile.pierceRemaining && missile.pierceRemaining > 0) {
      const next = this.findPierceTarget(missile, hitTarget, allTargets)

      if (next) {
        missile.targetId = next.id
        missile.pierceRemaining -= 1
        this.eventBus.emit('projectile_retargeted', { projectileId: missile.id, targetId: next.id })

        return
      }
    }

    if (missile.bounceRemaining && missile.bounceRemaining > 0) {
      const next = this.findNearestTarget(missile, allTargets)

      if (next) {
        missile.targetId = next.id
        missile.direction = next.x >= missile.x ? 1 : -1
        missile.bounceRemaining -= 1
        this.eventBus.emit('projectile_retargeted', { projectileId: missile.id, targetId: next.id })

        return
      }
    }

    this.removeMissile(missile.id)
  }

  // Mục tiêu CHƯA bị trúng, nằm xa hơn theo ĐÚNG hướng đang bay, GẦN
  // NHẤT theo hướng đó — giữ tinh thần "xuyên thẳng", không đổi hướng.
  private findPierceTarget(missile: Missile, hitTarget: MissileTarget, allTargets: MissileTarget[]): MissileTarget | undefined {
    const candidates = allTargets.filter(target =>
      !missile.hitEntityIds.includes(target.id) &&
      (missile.direction === 1 ? target.x > hitTarget.x : target.x < hitTarget.x),
    )

    if (candidates.length === 0) {
      return undefined
    }

    return candidates.reduce((closest, target) =>
      Math.abs(target.x - hitTarget.x) < Math.abs(closest.x - hitTarget.x) ? target : closest,
    )
  }

  // Mục tiêu CHƯA bị trúng, GẦN missile nhất bất kể hướng nào — dùng
  // cho cả Bounce (resolveArrival()) lẫn homing retarget-on-death
  // (retargetOrRemove()).
  private findNearestTarget(missile: Missile, allTargets: MissileTarget[]): MissileTarget | undefined {
    const candidates = allTargets.filter(target => !missile.hitEntityIds.includes(target.id))

    if (candidates.length === 0) {
      return undefined
    }

    return candidates.reduce((closest, target) =>
      Math.abs(target.x - missile.x) < Math.abs(closest.x - missile.x) ? target : closest,
    )
  }
}
