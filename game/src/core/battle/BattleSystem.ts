import type { Battle, BattleEnemy, PendingEnemySpawn } from './Battle'

import type { CombatSystem } from '../combat/CombatSystem'

import { BuffManager } from '../buff/BuffManager'

import { BuffSystem } from '../buff/BuffSystem'

import type { BuffRegistry } from '../buff/BuffRegistry'

import { AilmentManager } from '../ailment/AilmentManager'

import { AilmentSystem } from '../ailment/AilmentSystem'

import type { AilmentRegistry } from '../ailment/AilmentRegistry'

import { calculateStats, type StatModifier } from '../stats/StatCalculator'

import type { SkillManager } from '../skill/SkillManager'

import type { SkillSystem } from '../skill/SkillSystem'

import type { SkillEffectSystem, SkillEffectContext } from '../skill/SkillEffectSystem'
import { SkillTriggerRunner } from '../skill/SkillTriggerRunner'

import type { Skill } from '../skill/Skill'
import type { SkillExecutionPolicy } from '../skill/Skill'
import type { SkillEffect } from '../skill/SkillEffect'
import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'

import type { CombatEntity } from '../combat/CombatEntity'

import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'

import type { EventBus } from '../events/EventBus'

import { ReactionManager } from '../element/ReactionManager'

import { HERO_COLUMN, HERO_LANE_INDEX, SPAWN_COLUMN, VISIBLE_MAX_COLUMN } from './BattleLane'

import { resolveEnemySpawnPosition } from './EnemySpawnPlacement'
import type { EnemySpawnVfxPresetId } from './CombatAction'
import { entityGridPosition, worldToGridPosition } from './BattleGrid'

import {
  canEnemyReachGate,
  canPlayerReachTarget,
  collectAffected,
  findBattleEnemy,
  selectAttackableTarget,
  selectTeleportTarget,
  areaFor,
} from './ActionTargetingSystem'
import {
  DEFAULT_COMBAT_AI_STRATEGY,
  type CombatAiStrategy,
} from './CombatAiStrategy'

import {
  ActionImpactSystem,
  type ActionDamageInfo,
  type HitResolveOptions,
} from './ActionImpactSystem'

import { targetingForSkill, vfxPresetForSkill, type EffectScope } from './CombatAction'
import {
  MAX_SWORD_INTENT,
  MAX_MOMENTUM,
} from '../combat/CombatTypes'
import {
  gainPhapTuCastResources,
  updatePhapTuBattleResources,
} from './PhapTuBattleResourceSystem'
import {
  advanceChain,
  canCastChainSkill,
  initChainState,
  resetChainOnKill,
  type ChainDefinition,
  type ChainRuntimeState,
} from './ChainStateSystem'
import { gainTheOnChainLink } from './TheResourceSystem'
import {
  gainKiemTheOnFormationCast,
  gainKiemYTempOnChannelTick,
  gainKiemYTempOnDamageTaken,
  initKiemTuBattleResources,
  kiemTheDamageBonusPercent,
} from './KiemTuResourceSystem'
import { autoUltimateDecision, triggerUltimate } from './UltimateSystem'
import { resolveOnHitEffects } from './KiemTranOnHitSystem'
import { getFormationSwordCount } from '../../data/progression/KiemTuNodes'
import { getHuyKiemFlatDamageBonus } from '../skill/SkillSystem'

import { getAttackIntervalSeconds } from '../combat/AttackTiming'

import type { BattlePositionsEvent, PlayerTeleportedEvent } from './BattleEvents'

import type { LavaZone } from './LavaZone'
import type { SwordZone } from './SwordZone'

import type { ElementType } from '../element/ElementType'
import type { ArtifactRuntime } from '../artifact/ArtifactRuntime'
import { onArtifactHitResolved, updateArtifactActivation, type ArtifactSystemDeps } from '../artifact/ArtifactSystem'

// Skill execution policy rework (plan §8) — windup "đòn thường" của
// player basic attack KHÔNG CÒN TỒN TẠI: mọi đòn chủ động của Player là
// skill auto-cast đi qua pipeline impact riêng của skill.

const ENEMY_MELEE_WINDUP_SECONDS = 0.15

const ENEMY_RANGED_WINDUP_SECONDS = 0.3

// Enemy attackRange từ mức này trở lên coi như "ranged" (chọn preset VFX

// impact phép + windup dài hơn).

// Core Loop Foundation checklist (Mục MONSTER) — 'ranged' giữ khoảng

// cách bằng % attackRange (không đứng sát mép tầm đánh như melee).

const RANGED_PREFERRED_DISTANCE_RATIO = 0.6

// 'caster' có 1 khoảng "khoảng lặng" ngắn trước khi đòn thực sự bắn

// ra (telegraph) — khác melee/ranged bắn ngay khi tới lượt.

const CASTER_CAST_DELAY_SECONDS = 0.6

// Pháp Tu (Thổ Tu, 2026-08-15) — Ward chỉ bắt đầu hồi sau khi không

// bị đánh trúng liên tục đủ số giây này, xem updateRegen().

const WARD_REGEN_DELAY_SECONDS = 3

// Countdown trước trận (2026-08-22) — giống vạch xuất phát đua xe:

// quái đầu tiên đã spawn/hiển thị (xem start()) nhưng combat logic

// đóng băng cho tới khi đếm về 0 (xem update()'s 'countdown' branch).

const BATTLE_COUNTDOWN_SECONDS = 3

// Spawn telegraph (2026-08-24) — thời gian "telegraph → xuất hiện" theo
// cấp bậc quái. Đây là TRẠNG THÁI GAMEPLAY THẬT: trong thời gian này quái
// chưa nằm trong battle.enemies (không target/đỡ đòn/đánh được), giving
// người chơi thời gian cảnh báo công bằng vì attackRange quái hiện lớn
// hơn chiều rộng grid (spawn trong sân có thể đánh ngay sau materialize).
const SPAWN_TELEGRAPH_SECONDS = {
  normal: 0.75,
  elite: 1.0,
  boss: 1.4,
} as const

// Player spawn telegraph (plan §5.3) — avatar cũng đi qua "telegraph →
// materialize" giống quái (preset riêng 'player_spawn'). Countdown 3s >
// 1s nên bình thường Player hiện hình trước khi trận bắt đầu; nếu animation
// dài hơn countdown, battle tiếp tục chờ cả hai phía hoàn tất.
const PLAYER_SPAWN_TELEGRAPH_SECONDS = 1.0

// Teleport AI (plan §2.5/§7.3) — internal cooldown ĐÚNG 1 giây giữa 2
// lần đổi row. Trong ICD Player vẫn cast/đánh mục tiêu đang trong tầm.
const PLAYER_TELEPORT_ICD_SECONDS = 1

// Kiếm Tu Bạt Kiếm (2026-08-28, Task 4) — amp "nhận→gây": mỗi kỳ tụ lực
// phát quạt được khuếch đại theo % maxHP Player mất TRONG kỳ đó (spec
// §4.2). Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 3.4 — nerf giai đoạn
// đầu): hạ 1.0 → 0.3 vì BKT giờ còn hưởng tier kiếm ý vĩnh viễn (base
// 0.6 + 0.02×tầng) + hồi sinh + ult; đường về 1.0 phải qua node BK
// riêng (+0.1/level). Hệ số chỉnh qua playtest.
const BAT_KIEM_AMP_PER_DAMAGE_TAKEN = 0.3

// Kiếm Ý nerf BKT (spec 2026-08-29 mục 3.4) — base theo tầng vĩnh viễn:
// 0 tầng chỉ 60% value, +2%/tầng (~tầng 20 về 100%, vô hạn về sau).
const BAT_KIEM_BASE_AT_TIER_0 = 0.6
const BAT_KIEM_BASE_PER_KIEM_Y_TIER = 0.02
// tier = vĩnh viễn / KIEM_Y_PER_TIER (10 kiếm ý mỗi tầng) — local alias
// tránh import cycle KiemYSystem → BattleSystem (dùng getKiemYTier bên
// dưới cho phần nguyên tầng, hệ số hằng số giữ tại đây).
const KIEM_Y_PER_TIER_LOCAL = 10

// Final review fix (Critical #2, spec §4.2) — "Sát thương dựa vào thời
// gian tụ: multiplier phát quạt tăng theo x (nền: ×1 tại 3s → ×3 tại 9s,
// tuyến tính)". Baseline tick = 3s (khớp UI slider's min, xem
// useCombatSkillPresentation.ts's batKiemTickSeconds default); mỗi giây
// vượt baseline cộng thêm 1/3 multiplier để chạm đúng ×3 tại 9s.
const BAT_KIEM_TICK_BASELINE_SECONDS = 3

const BAT_KIEM_TICK_DAMAGE_PER_SECOND_OVER_BASELINE = 1 / 3

function batKiemTickLengthMultiplier(tickSeconds: number): number {
  return 1 + Math.max(0, tickSeconds - BAT_KIEM_TICK_BASELINE_SECONDS) * BAT_KIEM_TICK_DAMAGE_PER_SECOND_OVER_BASELINE
}

function spawnTelegraphSeconds(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): number {
  if (entity.isBoss) {
    return SPAWN_TELEGRAPH_SECONDS.boss
  }

  if (entity.isElite) {
    return SPAWN_TELEGRAPH_SECONDS.elite
  }

  return SPAWN_TELEGRAPH_SECONDS.normal
}

function spawnPresetId(entity: Pick<CombatEntity, 'isBoss' | 'isElite'>): EnemySpawnVfxPresetId {
  if (entity.isBoss) {
    return 'boss_spawn'
  }

  if (entity.isElite) {
    return 'elite_spawn'
  }

  return 'enemy_spawn'
}

function scopeForEffect(effect: SkillEffect): EffectScope {
  if (effect.scope) {
    return effect.scope
  }

  return effect.type === 'heal' || effect.type === 'buff' ? 'source' : 'affected_targets'
}

export class BattleSystem {
  private battle: Battle | null = null

  private readonly reactionManager: ReactionManager

  // Kiếm Tu Bạt Kiếm (Task 4) — id skill channel đang equip lúc start()
  // (undefined = không có skill channel nào trong loadout, updateChanneling
  // no-op). Override tickSeconds theo skillId, đọc bởi Task 7 UI slider
  // qua setChannelTickSeconds() — có hiệu lực ngay cả giữa kỳ tụ đang dở.
  private channelSkillId: string | undefined

  private readonly channelTickSecondsOverrides = new Map<string, number>()

  // Trigger/Action rework (2026-08-31 spec) — engine for skills migrated
  // to `triggers` (Task 3/4); fired from resolveSkillEffects below.
  private readonly skillTriggerRunner = new SkillTriggerRunner()

  // Ult Kiếm Tu auto-AI (spec 2026-08-29 mục 3.4) — tích giây giữa 2 lần
  // check autoUltimateDecision (1s/lần), reset mỗi trận. ultAutoEnabled
  // là UI toggle (CombatControlBar) — tắt = chỉ manual bấm nút.
  private ultAutoCheckTimer = 0
  ultAutoEnabled = true

  // Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §7) — chuỗi combo
  // Thuần hệ: GameManager gọi setChainDefinition() khi start battle cho
  // Pháp Tu đã chốt Thuần (đọc CHAIN_SKILL_IDS theo hành đã chọn).
  // undefined = không gate (mọi test/path cũ giữ nguyên hành vi).
  // KHÔNG reset currentThe ở start() — Thế tích xuyên kill trong phiên
  // farm (spec §2.3), chỉ tiêu hao qua ult.
  private chain?: { definition: ChainDefinition; state: ChainRuntimeState }

  setChainDefinition(definition: ChainDefinition | undefined): void {
    this.chain = definition ? { definition, state: initChainState() } : undefined
  }

  constructor(
    private readonly combat: CombatSystem,

    private readonly skillManager: SkillManager,

    private readonly skillSystem: SkillSystem,

    private readonly skillEffectSystem: SkillEffectSystem,

    private readonly buffRegistry: BuffRegistry,

    private readonly ailmentRegistry: AilmentRegistry,

    private readonly eventBus: EventBus,

    /** Combat Grid Rework — thay hoàn toàn MissileSystem. */

    readonly actionImpact: ActionImpactSystem,

    /** Modifier hiện hành bên ngoài battle buffs (thuốc, socket). */
    private readonly getPlayerRuntimeModifiers: () => StatModifier[] = () => [],

    /**
     * AI target strategy hiện hành (plan §7/§10) — PlayerData là authority,
     * GameManager inject closure đọc live để đổi strategy giữa trận có
     * hiệu lực ngay. Test không quan tâm AI dùng default 'nearest'.
     */
    private readonly getAiStrategy: () => CombatAiStrategy = () => DEFAULT_COMBAT_AI_STRATEGY,

    /**
     * Thiên phú Phản Phác (talent-direction-choice-plan §6) — xác suất giữ
     * ailment khi kích Reaction (nhánh consume chuẩn), đọc LIVE từ thiên
     * phú player đang hoạt động. Nền 0 = không có thiên phú.
     */
    private readonly getReactionKeepChance: () => number = () => 0,

    /**
     * Final review fix (Important #6) — Bạt Kiếm channel activation
     * (initChannelState()) và channel UI (CombatControlBar.vue/
     * useCombatSkillPresentation.ts's tuLucState/KiemTuCombatHud.vue)
     * PHẢI cùng nguồn sự thật `player.kiemTuRoute === 'bat_kiem'`, không
     * chỉ "có channel skill trong loadout" (skill này có thể bị equip
     * thủ công qua Loadout UI ngay khi bat_kiem_an mở, trước cả khi
     * bat_kiem_thuc — full route-switch gate — tồn tại). Đọc LIVE giống
     * mọi closure PlayerData khác ở trên.
     */
    private readonly getKiemTuRoute: () => 'kiem_tran' | 'bat_kiem' | undefined = () => undefined,

    /**
     * Kiếm Ý vĩnh viễn (spec 2026-08-29-kiem-the-kiem-y mục 3) —
     * Kiếm Ý nền đầu trận route Bạt Kiếm (tầng boss × 10) + nguồn
     * tier cho nerf BKT (base 0.6 + 0.02×tier). GameManager inject
     * closure đọc live từ KiemYSystem.getKiemYPermanent(player.
     * bossKillCount). Nền 0 = không có.
     */
    private readonly getKiemYPermanent: () => number = () => 0,

    /**
     * Hấp thụ Huy Kiếm (spec mục 3.4) — tổng số lần trảm của tram,
     * dùng cho flat bonus floor(casts/10) cộng vào Bạt Kiếm Thức
     * ("10 năm trảm có giá trị"). GameManager inject closure đọc
     * skillManager.get('tram')?.totalExperience.
     */
    private readonly getTramTotalCasts: () => number = () => 0,

    /**
     * On-hit kiếm trận (spec mục 4) — cấp các node on-hit đã mua (đọc
     * PlayerData.nodeLevels lọc qua registry), inject bởi GameManager.
     */
    private readonly getOnHitNodeLevels: () => Record<string, number> = () => ({}),
  ) {
    this.reactionManager = new ReactionManager(eventBus)

    // Kiếm Tu Bạt Kiếm (Task 4) — nguồn DUY NHẤT tích tuLucDamageTakenPercent:
    // bất kỳ đòn nào làm currentHp Player giảm (đánh trúng/DoT/reaction/…)
    // trong lúc đang tụ lực đều tính vào % maxHP mất của kỳ hiện tại. Reuse
    // event bus 'entity_vitals_changed' (đã là nguồn phát duy nhất mọi thay
    // đổi HP/Mana/Ward, xem EntityVitalsSystem.ts) thay vì móc riêng vào
    // applyActionHit — DoT/lava zone/tribulation không đi qua applyActionHit.
    this.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) =>
      this.onEntityVitalsChanged(event),
    )

    // Pháp Tu Đạo Sắc (spec §7) — quái chết → chuỗi combo reset về A.
    // CombatSystem.killIfDead phát 'kill' cho MỌI entity chết; lọc
    // targetId ≠ player id (player chết thì trận kết thúc, chain vô nghĩa).
    this.eventBus.on<{ type: 'kill'; sourceId: string; targetId: string }>('kill', (event) => {
      if (this.chain && this.battle && event.targetId !== this.battle.player.id) {
        resetChainOnKill(this.chain.state)
      }
    })
  }

  private onEntityVitalsChanged(event: EntityVitalsChangedEvent) {
    const battle = this.battle

    if (!battle || event.entityId !== battle.player.id) {
      return
    }

    if (event.maxHp <= 0 || event.hpAfter >= event.hpBefore) {
      return
    }

    const maxHpPercentLost = (event.hpBefore - event.hpAfter) / event.maxHp

    // Kiếm Ý tạm (spec 2026-08-29 mục 3.2) — route Bạt Kiếm: MỌI sát
    // thương nhận vào (không chỉ lúc đang tụ lực) +1 kiếm ý tạm mỗi
    // 5% maxHP mất — "nén lực bị đánh" đối xứng amp dmg-taken.
    if (this.getKiemTuRoute() === 'bat_kiem') {
      gainKiemYTempOnDamageTaken(battle.player, maxHpPercentLost)
    }

    // Amp channel (Task 4) — chỉ tích khi đang tụ lực.
    if (battle.player.tuLucActive) {
      battle.player.tuLucDamageTakenPercent += maxHpPercentLost
    }
  }

  private aiStrategy(): CombatAiStrategy {
    return this.getAiStrategy() ?? DEFAULT_COMBAT_AI_STRATEGY
  }

  start(
    player: CombatEntity,

    firstEnemy: CombatEntity,
  ) {
    this.actionImpact.clear()

    // Player spawn (plan §5.3) — đặt avatar logic tại (4,1), tạo telegraph
    // spawn, CHƯA công bố materialized: enemy chưa thể target, Player
    // chưa cast được cho tới khi telegraph chạy xong.
    player.x = HERO_COLUMN

    player.row = HERO_LANE_INDEX

    // Cadence timer theo slot là runtime-only — trận mới bắt đầu sạch.
    player.skillCadenceRemainingBySlot = {}

    this.battle = {
      id: crypto.randomUUID(),

      player,

      enemies: [],

      state: 'countdown',

      countdownSecondsRemaining: BATTLE_COUNTDOWN_SECONDS,

      playerTeleport: { remainingSeconds: 0 },

      pendingPlayerSpawn: {
        position: { row: HERO_LANE_INDEX, column: HERO_COLUMN },
        remainingSeconds: PLAYER_SPAWN_TELEGRAPH_SECONDS,
        totalSeconds: PLAYER_SPAWN_TELEGRAPH_SECONDS,
        presetId: 'player_spawn',
      },

      playerMaterialized: false,

      playerBuffs: new BuffManager(),

      playerAilments: new AilmentManager(),

      elapsedSeconds: 0,

      pendingSummons: [],

      lavaZones: [],

      swordZones: [],

      pendingEnemySpawns: [],

      // Trận mới reset vòng xoay về slot đầu (plan §5).
      nextSkillSlotIndexCursor: 0,

      // Bản Mệnh Pháp Bảo — GameManager gọi setArtifactRuntime() NGAY
      // SAU start() (cùng pattern battleLoot.setSession()) nếu player
      // có artifact; undefined mặc định = không tick gì cả.
      artifactRuntime: undefined,
    }

    this.initChannelState(player)

    // Quái đầu tiên cũng đi qua "telegraph → xuất hiện → tham chiến".
    // Overlap hợp lệ nên queue luôn thành công.
    this.queueEnemySpawn(this.battle, firstEnemy)

    // Auto: trận mới có thể bắt đầu lại NGAY trong cùng 1 tick tick()

    // (App.vue thấy battle vừa 'victory'/'defeat' thì tự fightStage()

    // luôn) — Vue/registry không kịp thấy state 'fighting' rớt xuống

    // rồi lên lại, nên isFighting (MainScene.ts) không đổi giá trị và

    // KHÔNG re-trigger applyLayout()/resetVisual(). Emit event riêng,

    // MainScene subscribe thẳng qua EventBus (như các event combat

    // khác) để luôn reset hình ảnh (xoay/mờ do chết) mỗi khi trận thật

    // sự bắt đầu, không phụ thuộc Vue có quan sát kịp hay không.

    this.eventBus.emit('battle_start', { type: 'battle_start' })

    // Emit SAU 'battle_start' — MainScene reset visual trước, có data

    // vẽ khung hình đầu ngay sau (snapshot chứa CẢ HAI telegraph:
    // playerSpawn + spawningEnemies), khỏi phải đợi tick kế tiếp.

    this.emitPositions(this.battle)
  }

  /**
   * Final review fix (Important #5 + #6) — trước đây CHỈ start() khởi
   * trạng thái tụ lực; startTribulation() (Đột Phá, trận thật ở mọi đại
   * cảnh giới) bỏ sót hoàn toàn khối này nên Bạt Kiếm player vào Kiếp
   * không có main skill nào chạy. Gộp lại 1 helper dùng chung, VÀ thêm
   * gate `kiemTuRoute === 'bat_kiem'` (Important #6) khớp đúng điều kiện
   * channel UI đang đọc (CombatControlBar.vue/useCombatSkillPresentation.ts's
   * tuLucState) — trước đây start() chỉ xét "có channel skill trong
   * loadout", desync được với UI nếu bat_kiem_thuat bị equip thủ công
   * trước khi đổi route.
   */
  private initChannelState(player: CombatEntity) {
    const channelEntry = this.skillManager
      .getLoadoutEntries()
      .find((entry) => entry.skill.execution?.kind === 'channel')

    const isBatKiemRoute = this.getKiemTuRoute() === 'bat_kiem'

    this.channelSkillId = channelEntry && isBatKiemRoute ? channelEntry.skill.id : undefined

    player.tuLucActive = channelEntry !== undefined && isBatKiemRoute
    player.tuLucElapsed = 0
    player.tuLucDamageTakenPercent = 0

    // Kiếm Thế / Kiếm Ý (spec 2026-08-29 mục 2/3.2) — reset 2 pool đầu
    // trận cùng lúc với channel state: KT Kiếm Thế về 0 (tích trong
    // trận theo cast), BK kiếm ý tạm khởi đầu = vĩnh viễn.
    initKiemTuBattleResources(player, this.getKiemTuRoute(), this.getKiemYPermanent())

    this.ultAutoCheckTimer = 0
  }

  /**

   * Quái mới vào trận GIỮA CHỪNG (wave spawn, không đợi quái cũ chết

   * hết) — gọi từ GameManager theo nhịp spawnIntervalSeconds. Không

   * đụng gì tới battle.player (HP/vị trí giữ nguyên, sinh tồn xuyên

   * suốt nhiều wave đúng yêu cầu).

   */

  spawnEnemyInto(battle: Battle, newEnemy: CombatEntity) {
    newEnemy.x = SPAWN_COLUMN

    battle.enemies.push(this.createBattleEnemy(newEnemy))

    this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: newEnemy.id })

    // Quái mới có vị trí ngay, khỏi đợi tick kế tiếp mới xuất hiện.

    this.emitPositions(battle)
  }

  /**

   * Spawn telegraph (plan §5.2) — ĐẶT LỊCH spawn: roll vị trí ĐÚNG MỘT

   * LẦN (row 0..9, column 7..15; Boss luôn row 4), đẩy entity vào

   * `pendingEnemySpawns` với thời gian đếm ngược theo cấp bậc. Trong thời

   * gian telegraph, entity CHƯA nằm trong `battle.enemies` — không thể bị

   * target, không đỡ đòn, không tấn công. Overlap HOỢP LỆ (nhiều quái

   * được trùng hoàn toàn một ô) nên luôn schedule thành công — không còn

   * occupied/reserved gate, không retry vì "hết chỗ".

   */

  queueEnemySpawn(battle: Battle, entity: CombatEntity): void {
    const position = resolveEnemySpawnPosition({
      isBoss: entity.isBoss ?? false,

      random: Math.random,
    })

    const totalSeconds = spawnTelegraphSeconds(entity)

    battle.pendingEnemySpawns.push({
      entity,

      position,

      remainingSeconds: totalSeconds,

      totalSeconds,

      presetId: spawnPresetId(entity),
    })

    // Snapshot ngay để renderer vẽ telegraph trong chính tick này (không

    // đợi tick kế — quan trọng cho quái đầu tiên lúc countdown 3s).

    this.emitPositions(battle)
  }

  /**

   * Đếm ngược CẢ HAI telegraph Player + quái mỗi tick (chạy ở CẢ
   * 'countdown' lẫn 'fighting'): hết thời gian → materialize. Player

   * materialize = pendingPlayerSpawn xoá + playerMaterialized true (plan
   * §5.4). Hai bên materialize trong countdown đứng yên (combat logic

   * đóng băng) — đúng ý "người chơi thấy hai bên xuất hiện trước khi

   * trận chính thức bắt đầu".

   */

  updatePendingSpawns(battle: Battle, deltaSeconds: number) {
    let changed = false

    if (battle.pendingPlayerSpawn) {
      battle.pendingPlayerSpawn.remainingSeconds -= deltaSeconds

      if (battle.pendingPlayerSpawn.remainingSeconds <= 0) {
        battle.pendingPlayerSpawn = undefined

        battle.playerMaterialized = true

        changed = true
      }
    }

    if (battle.pendingEnemySpawns.length > 0) {
      let materialized = false

      for (const pending of [...battle.pendingEnemySpawns]) {
        pending.remainingSeconds -= deltaSeconds

        if (pending.remainingSeconds > 0) {
          continue
        }

        battle.pendingEnemySpawns = battle.pendingEnemySpawns.filter((entry) => entry !== pending)

        this.materializePendingSpawn(battle, pending)

        materialized = true
      }

      changed ||= materialized
    }

    if (changed) {
      this.emitPositions(battle)
    }
  }

  private materializePendingSpawn(battle: Battle, pending: PendingEnemySpawn) {
    pending.entity.row = pending.position.row

    pending.entity.x = pending.position.column

    battle.enemies.push(this.createBattleEnemy(pending.entity))

    this.eventBus.emit('enemy_spawned', { type: 'enemy_spawned', targetId: pending.entity.id })
  }

  /**

   * Materialize TOÀN BỘ pending (Player + quái) ngay (bỏ qua telegraph) —
   * dùng cho test cần trạng thái tức thời sau start(); runtime không gọi.

   */

  flushPendingSpawns() {
    const battle = this.battle

    if (!battle) {
      return
    }

    for (const pending of [...battle.pendingEnemySpawns]) {
      this.materializePendingSpawn(battle, pending)
    }

    battle.pendingEnemySpawns = []

    if (battle.pendingPlayerSpawn) {
      battle.pendingPlayerSpawn = undefined

      battle.playerMaterialized = true
    }

    this.emitPositions(battle)
  }

  /**

   * Nguồn DUY NHẤT Phaser (MainScene.ts) biết vị trí player/quái —

   * core ↔ Phaser chỉ giao tiếp qua EventBus, không cầm tham chiếu

   * GameManager/BattleSystem trực tiếp (xem ghi chú kiến trúc trong

   * kế hoạch). Chỉ gồm quái CÒN SỐNG, xem BattlePositionsEvent.

   */

  private emitPositions(battle: Battle) {
    const event: BattlePositionsEvent = {
      type: 'positions',

      mode: battle.mode,

      playerX: battle.player.x,

      // Row thật của avatar (plan §2.2) + cờ targetability — renderer
      // snap sprite khi row đổi và ẩn sprite khi chưa materialize.

      playerRow: battle.player.row,

      playerMaterialized: battle.playerMaterialized,

      playerCurrentHp: battle.player.currentHp,

      playerMaxHp: battle.player.maxHp,

      // Telegraph spawn của Player — renderer vẽ telegraph tại projected
      // cell rồi materialize sprite khi biến mất khỏi snapshot.

      playerSpawn: battle.pendingPlayerSpawn
        ? {
            row: battle.pendingPlayerSpawn.position.row,
            column: battle.pendingPlayerSpawn.position.column,
            progress: battle.pendingPlayerSpawn.totalSeconds > 0
              ? Math.min(
                  1,
                  Math.max(
                    0,
                    1 -
                      battle.pendingPlayerSpawn.remainingSeconds /
                        battle.pendingPlayerSpawn.totalSeconds,
                  ),
                )
              : 1,
            presetId: battle.pendingPlayerSpawn.presetId,
          }
        : undefined,

      enemies: battle.enemies

        .filter((battleEnemy) => battleEnemy.entity.alive)

        .map((battleEnemy) => ({
          id: battleEnemy.entity.id,

          name: battleEnemy.entity.name,

          x: battleEnemy.entity.x,

          row: battleEnemy.entity.row,

          currentHp: battleEnemy.entity.currentHp,

          maxHp: battleEnemy.entity.maxHp,

          isBoss: battleEnemy.entity.isBoss ?? false,
        })),

      // Snapshot telegraph spawn — renderer reconcile theo id (id biến

      // mất = materialize xong). progress ∈ [0,1] cho VFX đếm ngược.

      spawningEnemies: battle.pendingEnemySpawns.map((pending) => ({
        id: pending.entity.id,

        name: pending.entity.name,

        row: pending.position.row,

        column: pending.position.column,

        progress:
          pending.totalSeconds > 0
            ? Math.min(1, Math.max(0, 1 - pending.remainingSeconds / pending.totalSeconds))
            : 1,

        isBoss: pending.entity.isBoss ?? false,

        presetId: pending.presetId,
      })),
    }

    this.eventBus.emit('positions', event)
  }

  private createBattleEnemy(entity: CombatEntity): BattleEnemy {
    return {
      entity,

      attackTimer: 0,

      buffs: new BuffManager(),

      ailments: new AilmentManager(),

      rewardGranted: false,
    }
  }

  getBattle() {
    return this.battle
  }

  /**
   * Bản Mệnh Pháp Bảo — GameManager gọi ngay sau start()/startBattle()
   * (cùng pattern battleLoot.setSession()), truyền undefined nếu
   * player không có artifact (Kiếm Tu/chưa Trúc Cơ) — no-op an toàn
   * nếu chưa có battle nào đang chạy.
   */
  setArtifactRuntime(runtime: ArtifactRuntime | undefined) {
    if (!this.battle) {
      return
    }

    this.battle.artifactRuntime = runtime
  }

  private artifactSystemDeps(): ArtifactSystemDeps {
    return {
      actionImpact: this.actionImpact,
      ailmentRegistry: this.ailmentRegistry,
      getAilmentsFor: (battle, entity) => this.getAilmentsFor(battle, entity),
      getBuffsFor: (battle, entity) => this.getBuffsFor(battle, entity),
      aiStrategy: () => this.aiStrategy(),
    }
  }

  update(deltaSeconds: number) {
    const battle = this.battle

    if (!battle) {
      return
    }

    // Countdown trước trận (2026-08-22) — quái đầu tiên đã spawn +

    // emitPositions() đã chạy trong start(), nên chỉ cần TIẾP TỤC emit

    // vị trí mỗi tick (Phaser vẽ đúng quái đứng yên trong lúc đếm),

    // KHÔNG chạy movement/attack/spawn-tiếp-theo cho tới khi đếm về 0.

    if (battle.state === 'countdown') {
      battle.countdownSecondsRemaining = Math.max(
        0,
        (battle.countdownSecondsRemaining ?? 0) - deltaSeconds,
      )

      // Telegraph spawn (Player + quái đầu tiên) chạy cả trong countdown —
      // hai bên hiện hình TRƯỚC khi trận chính thức bắt đầu (đứng yên,
      // combat đóng băng). Plan §5.3: chỉ chuyển 'fighting' khi countdown
      // về 0 VÀ Player materialize VÀ quái đã materialize; animation dài
      // hơn countdown thì battle tiếp tục chờ.

      this.updatePendingSpawns(battle, deltaSeconds)

      this.emitPositions(battle)

      if (
        battle.countdownSecondsRemaining <= 0 &&
        !battle.pendingPlayerSpawn &&
        battle.pendingEnemySpawns.length === 0
      ) {
        battle.state = 'fighting'
      }

      return
    }

    if (battle.state !== 'fighting') {
      return
    }

    // [1] Telegraph spawn giữa trận — hết đếm ngược mới materialize (xem

    // updatePendingSpawns()). Đặt TRƯỚC combat logic: quái vừa hiện

    // có thể bị target ngay tick này nhưng chưa từng tồn tại trước đó;

    // entity pending spawn KHÔNG tham gia combat (plan §14).

    this.updatePendingSpawns(battle, deltaSeconds)

    // [3] Boss phases/enrage

    // Trước updateStatsFromModifiers() để buff phase mới áp (nếu có)

    // được recompute vào stats hiệu lực NGAY trong tick này, không

    // trễ 1 tick.

    this.updateTribulationPhases(battle)

    this.updateEnrage(battle, deltaSeconds)

    const dotStatusesBefore = this.snapshotDotStatuses(battle)

    // [4][5] Recompute modifiers → Ailment/DoT/Lava/Regen

    this.updateStatsFromModifiers(
      battle,

      deltaSeconds,
    )

    this.updateAilments(
      battle,

      deltaSeconds,
    )

    this.updateLavaZones(
      battle,

      deltaSeconds,
    )

    this.updateSwordZones(
      battle,

      deltaSeconds,
    )

    this.updateRegen(
      battle,

      deltaSeconds,
    )

    updatePhapTuBattleResources(battle.player, deltaSeconds)

    // Kiếm Tu Bạt Kiếm (Task 4) — TỤ LỰC: tick độc lập với cast/cadence
    // scheduler bên dưới (channel skill KHÔNG đi qua beginPlayerCast, xem
    // ghi chú tại case 'channel' của beginPlayerCast()).
    this.updateChanneling(battle, deltaSeconds)

    // [6] Tick skill timers: cadence Attack Speed theo slot (policy
    // attack_speed/attack_speed_cast) + enemy attack timer. Cooldown CDR
    // chạy ở GameManager.update() qua skillSystem.update(). Timer KHÔNG
    // trừ trong lúc Choáng/Đóng Băng — "dừng nhịp" thay vì mất tempo.

    this.updateSkillCadence(battle, deltaSeconds)

    for (const battleEnemy of battle.enemies) {
      if (!this.isIncapacitated(battleEnemy.ailments)) {
        battleEnemy.attackTimer -= deltaSeconds
      }
    }

    // [6b] Bản Mệnh Pháp Bảo — timer ĐỘC LẬP với cast/basic attack và
    // KHÔNG gate isIncapacitated() (player bị CC không dừng artifact,
    // doc §11 điểm 3). No-op nếu battle.artifactRuntime undefined.
    updateArtifactActivation(battle, deltaSeconds, this.artifactSystemDeps())

    // [7] Teleport ICD tick — luôn trôi trong fighting, độc lập stun.

    battle.playerTeleport.remainingSeconds = Math.max(
      0,
      battle.playerTeleport.remainingSeconds - deltaSeconds,
    )

    // [8] Enemy movement tới cổng (plan §13).

    this.resolveMovement(
      battle,

      deltaSeconds,
    )

    // [9] Emit NGAY SAU resolveMovement(), TRƯỚC cast/attack bên dưới —
    // EventBus.emit() đồng bộ, nên renderer có snapshot MỚI của tick này
    // trước khi windup action nào hoàn tất cùng tick.

    this.emitPositions(battle)

    // [10] Resolve cast đang niệm.

    this.updateCasting(
      battle,

      deltaSeconds,
    )

    // [11]-[13] Acquire target theo AI → teleport nếu cần → start TỐI ĐA
    // MỘT Player skill (scheduler thống nhất, plan §8.4).

    this.updatePlayerSkills(battle)

    // Ult Kiếm Tu auto (spec 2026-08-29 mục 3.4) — AI check 1 lần/giây,
    // TTKT auto khi đủ Kiếm Thế, KKTM auto khi boss + ngưỡng 500 kiếm ý.
    // Toggle UI tắt = giữ tài nguyên cho manual.
    this.ultAutoCheckTimer += deltaSeconds
    if (this.ultAutoCheckTimer >= 1 && this.ultAutoEnabled) {
      this.ultAutoCheckTimer = 0
      const route = this.getKiemTuRoute()
      if (route) {
        const decision = autoUltimateDecision(battle, route, this.getHighestFormationSwordCount())
        if (decision) {
          this.tryPlayerUltimate()
        }
      }
    } else if (this.ultAutoCheckTimer >= 1) {
      this.ultAutoCheckTimer = 0
    }

    // [14] Enemy attacks.

    this.updateEnemyAttacks(
      battle,

      deltaSeconds,
    )

    // [15] Tick các impact đang windup, hết giờ thì snapshot anchor +
    // resolve + emit action_impact.

    this.actionImpact.tick(
      battle,
      deltaSeconds,
      (battleRef, hitSource, hitTarget, hitDamage, hitOptions) => {
        return this.applyActionHit(battleRef, hitSource, hitTarget, hitDamage, hitOptions)
      },
    )

    // [16] Status VFX diff.

    this.emitStatusVfxDiff(battle, dotStatusesBefore)

    // [17] Check defeat.

    this.checkBattleEnd(battle)

    // [18] Snapshot sau khi toàn bộ damage/regen/thorns/ward-break của tick đã

    // hoàn tất. Snapshot đầu tick vẫn cần cho vị trí bắt đầu windup; snapshot

    // này bảo đảm UI không bị giữ ở lượng HP của tick trước, kể cả đòn kết liễu.
    // ([19][20] loot/stage/victory do GameManager xử lý sau khi update() trả về.)

    this.emitPositions(battle)
  }

  /**

   * Độ Kiếp (mục 12 spec `breakthrough`) — quái Kiếp leo thang sức

   * mạnh giữa trận qua các mốc HP (entity.tribulationPhases, sắp XUỐNG

   * DẦN theo hpThresholdPercent). Dùng while thay vì if để bắt kịp

   * TRƯỜNG HỢP 1 đòn to rớt qua nhiều mốc cùng lúc — áp hết các phase

   * đã đạt trong CÙNG 1 tick thay vì rải mỗi tick 1 phase.

   */

  private updateTribulationPhases(battle: Battle) {
    for (const battleEnemy of battle.enemies) {
      const phases = battleEnemy.entity.tribulationPhases

      if (!phases || !battleEnemy.entity.alive) {
        continue
      }

      let appliedCount = battleEnemy.appliedTribulationPhaseCount ?? 0

      const hpPercent = battleEnemy.entity.currentHp / battleEnemy.entity.maxHp

      while (
        appliedCount < phases.length &&
        hpPercent <= phases[appliedCount]!.hpThresholdPercent
      ) {
        const phase = phases[appliedCount]!

        new BuffSystem(battleEnemy.buffs).apply(phase.buff)

        // Boss Mechanics (Phase 4) — Attack Pattern: đổi hẳn archetype

        // TRỰC TIẾP (không qua Buff, archetype không phải stat).

        if (phase.archetypeOverride) {
          battleEnemy.entity.archetype = phase.archetypeOverride
        }

        // Boss Mechanics (Phase 4) — Summon: chỉ ĐẨY yêu cầu, GameManager

        // tự spawn thật (xem ghi chú Battle.pendingSummons).

        if (phase.summonEnemyIds) {
          battle.pendingSummons.push(...phase.summonEnemyIds)
        }

        appliedCount++
      }

      battleEnemy.appliedTribulationPhaseCount = appliedCount
    }
  }

  /**

   * Boss Mechanics (Phase 4) — DPS check: trận kéo dài quá

   * entity.enrage.afterSeconds thì áp buff enrage MỘT LẦN, cùng cơ chế

   * "permanent buff qua BuffSystem" như updateTribulationPhases().

   * elapsedSeconds đếm CHUNG cho cả trận (không phải riêng từng quái)

   * — enrage là DPS check của TOÀN BỘ cuộc chiến, không phải của

   * riêng 1 con quái.

   */

  private updateEnrage(battle: Battle, deltaSeconds: number) {
    battle.elapsedSeconds += deltaSeconds

    for (const battleEnemy of battle.enemies) {
      const enrage = battleEnemy.entity.enrage

      if (!enrage || battleEnemy.enrageApplied || !battleEnemy.entity.alive) {
        continue
      }

      if (battle.elapsedSeconds < enrage.afterSeconds) {
        continue
      }

      new BuffSystem(battleEnemy.buffs).apply(enrage.buff)

      battleEnemy.enrageApplied = true
    }
  }

  private isIncapacitated(ailments: AilmentManager): boolean {
    const system = new AilmentSystem(ailments)

    return system.isStunned() || system.isFrozen()
  }

  /**

   * Enemy KHÔNG THỂ vừa di chuyển vừa tấn công (yêu cầu sản phẩm
   * 2026-08-26): tiến về cổng cho tới khi vào đúng tầm đánh của CHÍNH nó
   * (canEnemyReachGate) rồi DỨNG LẠI bắn — điểm dừng là biên range, và

   * KHÔNG BAO GIỜ vượt qua cổng (clamp HERO_COLUMN). Balance pass: 

   * attackRange quái bị chặn tối đa MAX_ENEMY_ATTACK_RANGE_RANKS = 5 ở
   * normalizeEnemyStats nên điểm dừng xa nhất là cột 1+5=6 — luôn trong
   * tầm với tới của avatar (base range 5). 'ranged'/'caster' giữ khoảng

   * cách kiting: bị ép sát hơn preferred thì lùi ra (plan §13 bullet 3).

   * Row avatar Player KHÔNG ảnh hưởng việc quái di chuyển. Quái Đóng

   * Băng/Trói Chân đứng yên tại chỗ.

   */

  private resolveMovement(battle: Battle, deltaSeconds: number) {
    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const battleEnemyAilments = new AilmentSystem(battleEnemy.ailments)

      // Thổ Tu ("Trói Chân", Plans/EarthPath mục VI) — Root chặn di

      // chuyển giống Đóng Băng nhưng KHÔNG chặn attack/cast (xem

      // isIncapacitated() — cố ý KHÔNG gộp isRooted() vào đó).

      if (battleEnemyAilments.isFrozen() || battleEnemyAilments.isRooted()) {
        continue
      }

      // Khoảng cách đo TỚI CỔNG theo cột (canEnemyReachGate semantics),
      // không phải tới avatar row.

      const distance = Math.abs(battleEnemy.entity.x - HERO_COLUMN)

      const range = battleEnemy.entity.stats.attackRange

      const isKiter =
        battleEnemy.entity.archetype === 'ranged' || battleEnemy.entity.archetype === 'caster'

      // Combat Grid Rework (2026-08-24) — còn off-screen thì tiến tối

      // thiểu 0.5 cột mỗi tick cho tới khi VÀO màn hình, bất kể range.

      if (battleEnemy.entity.x > VISIBLE_MAX_COLUMN) {
        const step = Math.min(
          battleEnemy.entity.stats.movementSpeed * deltaSeconds,
          Math.max(battleEnemy.entity.x - VISIBLE_MAX_COLUMN, 0.5),
        )

        const nextX = battleEnemy.entity.x + (battleEnemy.entity.x >= HERO_COLUMN ? -step : step)

        battleEnemy.entity.x = Math.max(HERO_COLUMN, nextX)

        continue
      }

      // Core Loop Foundation checklist (Mục MONSTER) — 'ranged'/'caster'
      // thích giữ khoảng cách với CỔNG: bị ép sát hơn preferred thì lùi

      // ra thay vì đứng ì hoặc tiến tiếp (kiting).

      if (isKiter && distance < range * RANGED_PREFERRED_DISTANCE_RATIO) {
        const step = Math.min(
          battleEnemy.entity.stats.movementSpeed * deltaSeconds,
          range * RANGED_PREFERRED_DISTANCE_RATIO - distance,
        )

        battleEnemy.entity.x += battleEnemy.entity.x >= HERO_COLUMN ? step : -step

        continue
      }

      // Ngoài tầm của chính nó → tiến về cổng; đã trong tầm → DỨNG YÊN
      // ở biên range bắn (điểm dừng xa nhất = cột 1 + trần range 5 = 6).

      if (distance > range) {
        const step = Math.min(
          battleEnemy.entity.stats.movementSpeed * deltaSeconds,
          distance - range,
        )

        const nextX = battleEnemy.entity.x + (battleEnemy.entity.x >= HERO_COLUMN ? -step : step)

        // Không đi qua cổng (plan §13): clamp tại HERO_COLUMN.

        battleEnemy.entity.x = Math.max(HERO_COLUMN, nextX)
      }
    }
  }

  private findNearestAliveEnemy(battle: Battle): CombatEntity | undefined {
    let nearest: CombatEntity | undefined

    let nearestDistance = Infinity

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const distance = Math.abs(battleEnemy.entity.x - HERO_COLUMN)

      if (distance < nearestDistance) {
        nearestDistance = distance

        nearest = battleEnemy.entity
      }
    }

    return nearest
  }

  private getBuffsFor(battle: Battle, entity: CombatEntity): BuffManager {
    if (entity.id === battle.player.id) {
      return battle.playerBuffs
    }

    return (
      battle.enemies.find((battleEnemy) => battleEnemy.entity.id === entity.id)?.buffs ??
      new BuffManager()
    )
  }

  private getAilmentsFor(battle: Battle, entity: CombatEntity): AilmentManager {
    if (entity.id === battle.player.id) {
      return battle.playerAilments
    }

    return (
      battle.enemies.find((battleEnemy) => battleEnemy.entity.id === entity.id)?.ailments ??
      new AilmentManager()
    )
  }

  /**

   * Combat Grid Rework — resolve MỘT hit của action impact qua pipeline

   * đầy đủ (accuracy → realm pressure → armor/resist → crit → block →

   * endurance → ward/mana-shield → HP) + toàn bộ on-hit hooks giữ nguyên

   * hành vi cũ: roll on-hit ailment proc, Kiếm Ý/Momentum/Break theo

   * skillId, knockback đẩy target còn sống ra xa nguồn.

   */

  private applyActionHit(
    battle: Battle,

    source: CombatEntity,

    target: CombatEntity,

    damage: ActionDamageInfo,

    options: HitResolveOptions,
  ) {
    if (!target.alive || !source.alive) {
      return { landed: false }
    }

    const result = this.combat.resolveActionHit(source, target, damage, options.critical)

    // Bản Mệnh Pháp Bảo — attribution + dispatch milestone theo hướng
    // active. `element` suy từ chính damage vừa resolve (artifact luôn
    // gửi ĐÚNG 1 component/hit, xem ArtifactSystem.buildArtifactDamage()).
    if (options.origin?.kind === 'artifact') {
      const firstComponent = damage.kind === 'elemental' ? damage.components[0] : undefined
      const element = firstComponent?.kind === 'element' ? firstComponent.element : undefined

      onArtifactHitResolved(battle, source, target, !result.dodged, element, this.artifactSystemDeps())
    }

    // Thổ Tu (Thạch Hóa) — MỌI đòn đánh TRÚNG roll on-hit-proc đang

    // active trên target (AilmentSystem.rollOnHitEffects()).

    if (!result.dodged && target.alive) {
      new AilmentSystem(this.getAilmentsFor(battle, target)).rollOnHitEffects(
        source,
        target,
        this.ailmentRegistry,
      )
    }

    if (options.skillId) {
      const firedSkill = this.skillManager.get(options.skillId)

      // Chỉ build context (allocate BuffSystem/AilmentSystem/closures) khi
      // skill THỰC SỰ có binding onHit/onCrit/onEvade — tránh allocation vô
      // ích trên mọi hit của basic attack (vd Huy Kiếm/`tram` chỉ có
      // onCast, không nên trả giá allocation của nhánh này).
      const hasReactiveTrigger = firedSkill?.triggers?.some(
        (binding) => binding.trigger === 'onHit' || binding.trigger === 'onCrit' || binding.trigger === 'onEvade',
      )

      if (firedSkill && hasReactiveTrigger) {
        const hitCtx: SkillEffectContext = {
          combatSystem: this.combat,
          // Reactive trigger (onHit/onCrit/onEvade) fire từ BÊN TRONG hit
          // đang resolve — fireHit ở đây KHÔNG được re-enter applyActionHit
          // (chính applyActionHit là nơi bắn onHit/onCrit/onEvade, nên
          // re-enter sẽ đệ quy vô hạn). Action nào cần deal damage phải
          // gắn vào onCast, không phải các reactive trigger này — cảnh báo
          // loud thay vì âm thầm no-op nếu bị dùng sai.
          fireHit: () => {
            console.warn(
              '[SkillTriggerRunner] fireHit called from a reactive trigger (onHit/onCrit/onEvade) context — this is a no-op by design; use onCast for damage-dealing actions.',
            )
            return { landed: true }
          },
          buffRegistry: this.buffRegistry,
          ailmentRegistry: this.ailmentRegistry,
          sourceBuffs: new BuffSystem(this.getBuffsFor(battle, source)),
          targetBuffs: new BuffSystem(this.getBuffsFor(battle, target)),
          targetAilments: new AilmentSystem(this.getAilmentsFor(battle, target)),
          reactionManager: this.reactionManager,
          reactionKeepChance: this.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),
          skillId: firedSkill.id,
          skillExperience: firedSkill.totalExperience ?? firedSkill.experience ?? 0,
          eventBus: this.eventBus,
        }

        if (!result.dodged) {
          const hitContext = { source, target, skill: firedSkill, damageDealt: result.finalDamage, isCrit: result.critical }

          this.skillTriggerRunner.fire('onHit', hitContext, firedSkill.triggers, source, target, hitCtx)

          if (result.critical) {
            this.skillTriggerRunner.fire('onCrit', hitContext, firedSkill.triggers, source, target, hitCtx)
          }
        } else {
          // onEvade fires trên skill của NGƯỜI TẤN CÔNG khi đòn đánh của
          // họ bị né ("đòn của tôi bị né") — KHÔNG phải trên skill của
          // người phòng thủ cho "tôi vừa né được đòn đánh" (chưa có firing
          // site cho hướng đó).
          this.skillTriggerRunner.fire(
            'onEvade',
            { source, target, skill: firedSkill },
            firedSkill.triggers,
            source, target, hitCtx,
          )
        }
      }
    }

    if (!result.dodged && options.skillId) {
      const skill = this.skillManager.get(options.skillId)

      if (skill?.grantsSwordIntentPerHit) {
        source.currentSwordIntent = Math.min(MAX_SWORD_INTENT, source.currentSwordIntent + 1)
      }

      if (skill?.grantsMomentumPerHit) {
        source.currentMomentum = Math.min(
          MAX_MOMENTUM,
          source.currentMomentum + skill.grantsMomentumPerHit,
        )
      }

      if (
        skill?.breakDamagePerHit &&
        target.breakGaugeMax !== undefined &&
        target.currentBreakGauge !== undefined
      ) {
        target.currentBreakGauge -= skill.breakDamagePerHit

        if (target.currentBreakGauge <= 0) {
          const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, target))

          targetAilments.apply(
            this.ailmentRegistry.get('choang'),
            source,
            target,
            this.ailmentRegistry,
          )

          target.currentBreakGauge = target.breakGaugeMax
        }
      }
    }

    if (options.knockbackDistance && target.alive) {
      const direction = target.x >= source.x ? 1 : -1

      // Player column LUÔN là cổng (plan §2.2), enemy không bị đẩy qua
      // cổng (plan §13) — clamp cả hai phía tại HERO_COLUMN.
      target.x =
        target.id === battle.player.id
          ? HERO_COLUMN
          : Math.max(HERO_COLUMN, target.x + direction * options.knockbackDistance)
    }

    return { landed: !result.dodged }
  }
  /**

   * Hết hạn buff/debuff của player + từng quái rồi recompute `stats`

   * hiệu lực từ `baseStats` + modifier đang active (buff THẬT + Làm

   * Chậm từ AilmentSystem.getActiveModifiers(), hoà chung 1 pool —

   * xem StatCalculator.calculateStats()) — phải chạy TRƯỚC attack

   * timer trong cùng tick để damage/heal dùng đúng buff/ailment mới

   * nhất.

   */

  private updateStatsFromModifiers(battle: Battle, deltaSeconds: number) {
    const playerBuffSystem = new BuffSystem(battle.playerBuffs)

    playerBuffSystem.update(deltaSeconds)

    const playerAilmentSystem = new AilmentSystem(battle.playerAilments)

    battle.player.stats = calculateStats(
      battle.player.baseStats,

      [
        ...this.getPlayerRuntimeModifiers(),
        ...playerBuffSystem.getActiveModifiers(),
        ...playerAilmentSystem.getActiveModifiers(),
      ],
    )

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      const enemyBuffSystem = new BuffSystem(battleEnemy.buffs)

      enemyBuffSystem.update(deltaSeconds)

      const enemyAilmentSystem = new AilmentSystem(battleEnemy.ailments)

      battleEnemy.entity.stats = calculateStats(
        battleEnemy.entity.baseStats,

        [...enemyBuffSystem.getActiveModifiers(), ...enemyAilmentSystem.getActiveModifiers()],
      )
    }
  }

  /**

   * Hết hạn + tick DoT cho player + từng quái — gọi NGAY SAU

   * updateStatsFromModifiers() (đã recompute stats mới nhất, DoT tính

   * theo damagePerSecond đã snapshot sẵn lúc áp dụng nên không cần

   * đọc lại stats ở đây, chỉ cần entity còn sống).

   */

  private updateAilments(battle: Battle, deltaSeconds: number) {
    // Combat Grid Rework (§3, 2026-08-24) — DOT là persistent VFX gắn
    // theo target: dedupe khoá (targetId + ailmentId), reapply = refresh,
    // hết/cleanse/chết = remove. Diff BEFORE/AFTER mỗi tick tại ĐÂY (một
    // điểm phát duy nhất cho mọi nguồn gây ailment). Resolver DoT biết
    // entity NGUỒN thật (Kim Thế penetration/Poison Recovery), sourceId
    // có thể không còn tồn tại — trả undefined an toàn.
    const resolveSource = (id: string): CombatEntity | undefined => {
      if (id === battle.player.id) {
        return battle.player
      }

      return battle.enemies.find((battleEnemy) => battleEnemy.entity.id === id)?.entity
    }

    new AilmentSystem(battle.playerAilments).update(
      deltaSeconds,
      battle.player,
      this.combat,
      this.ailmentRegistry,
      resolveSource,
    )

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      new AilmentSystem(battleEnemy.ailments).update(
        deltaSeconds,
        battleEnemy.entity,
        this.combat,
        this.ailmentRegistry,
        resolveSource,
      )
    }
  }

  /** Snapshot trạng thái DoT toàn trận, khoá `targetId:ailmentId`. */
  private snapshotDotStatuses(
    battle: Battle,
  ): Map<string, { targetId: string; dotType: string; stacks: number; remainingTime: number }> {
    const snapshot = new Map<
      string,
      { targetId: string; dotType: string; stacks: number; remainingTime: number }
    >()

    const collect = (manager: AilmentManager, targetId: string) => {
      for (const ailment of manager.getAll()) {
        if (ailment.category !== 'dot') {
          continue
        }

        snapshot.set(`${targetId}:${ailment.id}:${ailment.sourceId}`, {
          targetId,
          dotType: ailment.id,
          stacks: ailment.stacks,
          remainingTime: ailment.remainingTime,
        })
      }
    }

    collect(battle.playerAilments, battle.player.id)

    for (const battleEnemy of battle.enemies) {
      collect(battleEnemy.ailments, battleEnemy.entity.id)
    }

    return snapshot
  }

  /** Phát status_vfx_attached/updated/removed theo diff — decay tự nhiên KHÔNG emit updated. */
  private emitStatusVfxDiff(
    battle: Battle,
    before: Map<
      string,
      { targetId: string; dotType: string; stacks: number; remainingTime: number }
    >,
  ) {
    const after = this.snapshotDotStatuses(battle)

    for (const [key, current] of after) {
      const previous = before.get(key)
      if (!previous) {
        this.eventBus.emit('status_vfx_attached', {
          type: 'status_vfx_attached',
          statusInstanceId: key,
          targetId: current.targetId,
          dotType: current.dotType,
          stacks: current.stacks,
          durationSeconds: current.remainingTime,
        })
      } else if (
        current.stacks !== previous.stacks ||
        current.remainingTime >= previous.remainingTime
      ) {
        this.eventBus.emit('status_vfx_updated', {
          type: 'status_vfx_updated',
          statusInstanceId: key,
          stacks: current.stacks,
          durationSeconds: current.remainingTime,
        })
      }
    }

    for (const [key, previous] of before) {
      if (after.has(key)) {
        continue
      }

      const alive =
        previous.targetId === battle.player.id
          ? battle.player.alive
          : (battle.enemies.find((entry) => entry.entity.id === previous.targetId)?.entity.alive ??
            false)

      this.eventBus.emit('status_vfx_removed', {
        type: 'status_vfx_removed',
        statusInstanceId: key,
        reason: alive ? 'expired' : 'target_dead',
      })
    }
  }

  /**

   * Plans/magicpathgeneral Phase 12 (2026-08-21) — Lava Zone, xem

   * LavaZone.ts. Gọi bởi Reaction (thach_hoa+bong "Dung Nham", xem

   * ReactionManager.ts) qua context truyền vào SkillEffectSystem —

   * `battle` bind sẵn ở call site (castSkill()), zone tồn tại ĐỘC LẬP

   * với entity đã kích hoạt nó sau khi spawn.

   */

  spawnLavaZone(
    battle: Battle,

    spec: {
      ownerId: string
      row: number
      column: number
      laneRadius: number
      columnRadius: number

      duration: number

      tickInterval: number

      damagePerTick: number

      element: ElementType | 'physical'
    },
  ) {
    battle.lavaZones.push({
      id: crypto.randomUUID(),

      ownerId: spec.ownerId,

      row: spec.row,

      column: spec.column,

      laneRadius: spec.laneRadius,

      columnRadius: spec.columnRadius,

      remainingTime: spec.duration,

      tickInterval: spec.tickInterval,

      timeSinceLastTick: 0,

      damagePerTick: spec.damagePerTick,

      element: spec.element,
    })
  }

  /**

   * Tick từng Lava Zone — vòng lặp `while` (không phải `if`) để bắt

   * kịp nếu 1 deltaSeconds bất thường lớn hơn tickInterval, cùng gotcha

   * đã gặp ở Kim Thế decay ([[tienhiep-kimpath-kim]]). Entity phe đối

   * lập với `zone.ownerId` đứng trong bán kính LÚC TICK đều bị trúng,

   * kể cả entity spawn sau khi zone đã tồn tại — không snapshot danh

   * sách mục tiêu lúc spawn.

   */

  private updateLavaZones(battle: Battle, deltaSeconds: number) {
    for (const zone of battle.lavaZones) {
      zone.remainingTime -= deltaSeconds

      zone.timeSinceLastTick += deltaSeconds

      // Guard tickInterval > 0 — interval 0/âm làm timeSinceLastTick không
      // bao giờ giảm dưới ngưỡng, vòng lặp thành vô hạn.
      while (zone.tickInterval > 0 && zone.timeSinceLastTick >= zone.tickInterval) {
        zone.timeSinceLastTick -= zone.tickInterval

        this.tickLavaZone(battle, zone)
      }
    }

    battle.lavaZones = battle.lavaZones.filter((zone) => zone.remainingTime > 0)
  }

  private tickLavaZone(battle: Battle, zone: LavaZone) {
    const isPlayerOwned = zone.ownerId === battle.player.id

    const owner = isPlayerOwned
      ? battle.player
      : battle.enemies.find((battleEnemy) => battleEnemy.entity.id === zone.ownerId)?.entity

    const targets: CombatEntity[] = isPlayerOwned
      ? battle.enemies
          .filter((battleEnemy) => battleEnemy.entity.alive)
          .map((battleEnemy) => battleEnemy.entity)
      : battle.player.alive
        ? [battle.player]
        : []

    for (const target of targets) {
      const inArea =
        target.row >= zone.row - zone.laneRadius &&
        target.row <= zone.row + zone.laneRadius &&
        Math.round(target.x) >= zone.column - zone.columnRadius &&
        Math.round(target.x) <= zone.column + zone.columnRadius

      if (!inArea) {
        continue
      }

      this.combat.applyDotDamage({
        sourceId: zone.ownerId,

        source: owner,

        target,

        rawDamage: zone.damagePerTick,

        element: zone.element,

        effectId: zone.id,
      })
    }
  }

  /**
   * Task 8 (Kiếm Trận keystone, 2026-08-28) — spawn SwordZone. KHÁC
   * spawnLavaZone: gọi trực tiếp từ SkillEffectSystem's case 'damage'
   * (SkillEffect.grantsSwordZone), KHÔNG đi qua ReactionManager. Element
   * luôn 'metal' (Kiếm Trận).
   */
  spawnSwordZone(
    battle: Battle,

    spec: {
      ownerId: string
      row: number
      column: number
      laneRadius: number
      columnRadius: number

      charges: number

      tickInterval: number

      damagePerTick: number
    },
  ) {
    battle.swordZones.push({
      id: crypto.randomUUID(),

      ownerId: spec.ownerId,

      row: spec.row,

      column: spec.column,

      laneRadius: spec.laneRadius,

      columnRadius: spec.columnRadius,

      remainingCharges: spec.charges,

      tickInterval: spec.tickInterval,

      timeSinceLastTick: 0,

      damagePerTick: spec.damagePerTick,

      // Kiếm Trận LUÔN metal — không lấy từ spec (SkillEffectContext's
      // spawnSwordZone không có field element).
      element: 'metal',
    })
  }

  /**
   * Tick từng Sword Zone — vòng lặp `while` (bắt kịp overshoot, cùng
   * pattern updateLavaZones()), nhưng mỗi tick THẬT SỰ trôi qua trừ 1
   * `remainingCharges` thay vì trừ `deltaSeconds` khỏi remainingTime —
   * zone hết hạn theo SỐ TICK ĐÃ LAND, không theo thời gian.
   */
  private updateSwordZones(battle: Battle, deltaSeconds: number) {
    for (const zone of battle.swordZones) {
      zone.timeSinceLastTick += deltaSeconds

      // Guard tickInterval > 0 — interval 0/âm làm timeSinceLastTick không
      // bao giờ giảm dưới ngưỡng, vòng lặp thành vô hạn.
      while (
        zone.tickInterval > 0 &&
        zone.timeSinceLastTick >= zone.tickInterval &&
        zone.remainingCharges > 0
      ) {
        zone.timeSinceLastTick -= zone.tickInterval

        zone.remainingCharges -= 1

        this.tickSwordZone(battle, zone)
      }
    }

    battle.swordZones = battle.swordZones.filter((zone) => zone.remainingCharges > 0)
  }

  private tickSwordZone(battle: Battle, zone: SwordZone) {
    const isPlayerOwned = zone.ownerId === battle.player.id

    const owner = isPlayerOwned
      ? battle.player
      : battle.enemies.find((battleEnemy) => battleEnemy.entity.id === zone.ownerId)?.entity

    const targets: CombatEntity[] = isPlayerOwned
      ? battle.enemies
          .filter((battleEnemy) => battleEnemy.entity.alive)
          .map((battleEnemy) => battleEnemy.entity)
      : battle.player.alive
        ? [battle.player]
        : []

    for (const target of targets) {
      const inArea =
        target.row >= zone.row - zone.laneRadius &&
        target.row <= zone.row + zone.laneRadius &&
        Math.round(target.x) >= zone.column - zone.columnRadius &&
        Math.round(target.x) <= zone.column + zone.columnRadius

      if (!inArea) {
        continue
      }

      this.combat.applyDotDamage({
        sourceId: zone.ownerId,

        source: owner,

        target,

        rawDamage: zone.damagePerTick,

        element: zone.element,

        effectId: zone.id,
      })
    }
  }

  /**

   * HP/Mana/Ward regen mỗi tick — `hpRegenPerSecond` đã có field từ

   * đợt revamp trước nhưng chưa từng được tick ở đâu (dead stat), giờ

   * chạy cùng nhịp với DoT ở trên. Chỉ entity còn sống mới regen.

   * `wardRegenPerSecond` (Pháp Tu Thổ Tu, 2026-08-15) CÙNG tình trạng

   * — thêm gate WARD_REGEN_DELAY_SECONDS (chỉ hồi sau khi không bị

   * đánh trúng đủ lâu, đúng mô tả stat sẵn có trong CharacterPanel.vue).

   */

  private updateRegen(battle: Battle, deltaSeconds: number) {
    if (battle.player.alive) {
      this.regenEntityVitals(battle.player, deltaSeconds)
    }

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      this.regenEntityVitals(battleEnemy.entity, deltaSeconds)
    }
  }

  /**
   * Regen HP/Mana/Ward của 1 entity — HP đi qua applyHealing(); Mana/Ward
   * cũng phát 'entity_vitals_changed' qua emitCurrent() để HUD/consumer
   * thấy thay đổi thật (trước đây mutate thẳng currentMp/currentWard không
   * event). Bỏ qua emit khi không có gì thay đổi — phần lớn entity không
   * có manaRegenPerSecond/wardRegenPerSecond, tránh noise mỗi tick.
   */
  private regenEntityVitals(entity: CombatEntity, deltaSeconds: number) {
    const hpRegen = entity.stats.hpRegenPerSecond * deltaSeconds

    if (hpRegen > 0) {
      this.combat.applyHealing(entity, hpRegen, entity.id, 'regen')
    }

    const before = { hp: entity.currentHp, ward: entity.currentWard, mp: entity.currentMp }

    entity.currentMp = Math.min(
      entity.stats.maxMp,
      entity.currentMp + entity.stats.manaRegenPerSecond * deltaSeconds,
    )

    entity.timeSinceLastHitTaken += deltaSeconds

    if (entity.timeSinceLastHitTaken >= WARD_REGEN_DELAY_SECONDS) {
      entity.currentWard = Math.min(
        entity.stats.wardMax,
        entity.currentWard + entity.stats.wardRegenPerSecond * deltaSeconds,
      )
    }

    const changed = entity.currentMp - before.mp + (entity.currentWard - before.ward)

    if (changed !== 0) {
      this.combat.vitals.emitCurrent(entity, 'regen', changed, before, entity.id)
    }
  }

  /**

   * [6] Cadence Attack Speed THEO TỪNG SLOT (plan §4.4/§8.2) — clock ĐỘC

   * LẬP với cooldown CDR của SkillSystem. Policy 'attack_speed'/

   * 'attack_speed_cast' dùng slot timer này; 'cooldown'/'cast_time' dùng

   * remainingCooldownBySlot (tick ở GameManager qua skillSystem.update()).

   */

  private updateSkillCadence(battle: Battle, deltaSeconds: number) {
    const cadence = battle.player.skillCadenceRemainingBySlot

    if (!cadence) {
      return
    }

    for (const slot of Object.keys(cadence)) {
      const slotIndex = Number(slot)

      cadence[slotIndex] = Math.max(0, (cadence[slotIndex] ?? 0) - deltaSeconds)
    }
  }

  private cadenceRemaining(player: CombatEntity, slotIndex: number | undefined): number {
    if (slotIndex === undefined) {
      return 0
    }

    return player.skillCadenceRemainingBySlot?.[slotIndex] ?? 0
  }

  /** Giây giữa 2 lần kích hoạt theo Attack Speed × multiplier của policy. */
  private cadenceInterval(
    player: CombatEntity,
    execution: Extract<SkillExecutionPolicy, { kind: 'attack_speed' | 'attack_speed_cast' }>,
  ): number {
    return getAttackIntervalSeconds(player.stats.attackSpeed * (execution.attackSpeedMultiplier ?? 1))
  }

  /**
   * Scheduler thống nhất (plan §8.4) — thay HẲN pipeline basic attack +
   * auto-cast cũ: KHÔNG còn basic attack pipeline, mọi đòn chủ động
   * của Player là active skill auto-cast từ Loadout.
   *
   * Invariant:
   * - Không có skill chạy ngoài scheduler; không fallback physical attack.
   * - Mỗi fixed-step bắt đầu TỐI ĐA MỘT skill.
   * - Chỉ MỘT channeled cast tồn tại (castingSkillId).
   * - Instant skill khác có thể bắt đầu ở fixed-step kế tiếp nếu ready.
   */
  private updatePlayerSkills(battle: Battle) {
    if (!battle.playerMaterialized) {
      return
    }

    if (!battle.player.alive) {
      return
    }

    if (this.isIncapacitated(battle.playerAilments)) {
      return
    }

    // Cast Time — đang niệm dở 1 skill thì KHÔNG chọn skill mới
    // (updateCasting() sẽ tự resolve khi niệm xong).
    if (battle.player.castingSkillId) {
      return
    }

    const strategy = this.aiStrategy()

    // Bước 11 — acquire target trong Chebyshev range hiện tại.
    let primary: CombatEntity | null = selectAttackableTarget(battle, strategy)

    // Bước 12 — teleport AI: KHÔNG có target trong tầm và ICD hết →
    // pre-position ngay trên hàng của mục tiêu tốt nhất (yêu cầu sản
    // phẩm 2026-08-26 — không đứng đợi quái tới trước).
    if (!primary && battle.playerTeleport.remainingSeconds <= 0) {
      primary = this.tryTeleportToTarget(battle, strategy) ?? null
    }

    // Vẫn không có mục tiêu nào trong tầm — bỏ tick, không tốn nhịp
    // cadence/cooldown của skill nào (đánh được NGAY khi vừa vào tầm).

    // Bước 13 — Round-robin theo slot (plan §5, 2026-08-26): duyệt
    // loadout VÒNG TRÒN bắt đầu từ con trỏ runtime (không tự reset về
    // slot 0 mỗi fixed-step), bỏ qua entry thiếu policy/đang cooldown/
    // thiếu resource/không có target; bắt đầu TỐI ĐA 1 skill và CHỈ dời
    // con trỏ sau khi begin-cast thành công. Hết vòng không bắt đầu được
    // cái nào → giữ nguyên con trỏ.
    const loadoutEntries = this.skillManager.getLoadoutEntries()

    if (loadoutEntries.length === 0) {
      return
    }

    const cursor = battle.nextSkillSlotIndexCursor ?? 0

    for (let step = 0; step < loadoutEntries.length; step++) {
      const position = (cursor + step) % loadoutEntries.length

      const { skill, slotIndex } = loadoutEntries[position]!

      if (!skill.execution) {
        continue
      }

      // Final review fix (Important #4) — channel skill KHÔNG đi qua
      // scheduler round-robin này (runtime thật sống ở updateChanneling()/
      // resolveChannelTick(), tự tick theo tickSeconds độc lập). Trước
      // đây beginPlayerCast() bên dưới vẫn gọi beginCastInSlot() (trừ
      // resource + gán castingSlotIndex) TRƯỚC khi switch dispatch chạm
      // `case 'channel': return false` — castingSlotIndex bị set nhưng
      // không bao giờ được finishPlayerCastTransaction() dọn (channel
      // không đi qua đường finish nào), kẹt vĩnh viễn.
      if (skill.execution.kind === 'channel') {
        continue
      }

      if (this.cadenceRemaining(battle.player, slotIndex) > 0) {
        continue
      }

      if (!this.skillSystem.canUseInSlot(skill.id, slotIndex, battle.player)) {
        continue
      }

      // Pháp Tu Đạo Sắc (spec §7) — chuỗi combo Thuần hệ: skill thuộc
      // chuỗi chỉ cast khi ĐÚNG vị trí next của chain state (cast A mới
      // mở B). Skill ngoài chuỗi tự do. loadoutEntries.length khóa phần
      // chuỗi vượt slot mở theo realm (spec §6).
      if (
        this.chain &&
        !canCastChainSkill(this.chain.definition, this.chain.state, skill.id, loadoutEntries.length)
      ) {
        continue
      }

      // Primary đã qua range gate chung; skill self-target dùng Player.
      const target = skill.target === 'self' ? battle.player : primary

      if (!target) {
        continue
      }

      if (!this.beginPlayerCast(skill, battle.player, target, battle, slotIndex, strategy)) {
        continue
      }

      // Chỉ SAU khi bắt đầu thành công mới dời con trỏ tới slot kế tiếp.
      battle.nextSkillSlotIndexCursor = (position + 1) % loadoutEntries.length

      break
    }
  }

  /**
   * Thực thi teleport (plan §7.3 + yêu cầu sản phẩm 2026-08-26): chọn
   * mục tiêu tốt nhất theo strategy (selectTeleportTarget — xếp hạng
   * TOÀN BỘ enemy sống, KHÔNG đợi quái đi vào tầm), gán row giữ
   * column = HERO_COLUMN, set ICD 1s, emit positions + player_teleported
   * NGAY (trước attack/cast cùng tick). Player pre-position trên đúng
   * hàng sớm để đánh được ngay khi quái đi vào tầm theo cột.
   */
  private tryTeleportToTarget(
    battle: Battle,
    strategy: CombatAiStrategy,
  ): CombatEntity | undefined {
    const player = battle.player
    const teleportTarget = selectTeleportTarget(battle, strategy)

    if (!teleportTarget) {
      return undefined
    }

    // Đã đứng đúng hàng của mục tiêu tốt nhất → KHÔNG làm gì cả: không
    // reset ICD, không emit event (tránh vòng "nhấp nháy" teleport mỗi
    // lần ICD hết khi đang chờ quái đi vào tầm theo cột).
    if (teleportTarget.row === player.row) {
      return undefined
    }

    const from = entityGridPosition(player)

    player.row = teleportTarget.row

    player.x = HERO_COLUMN

    battle.playerTeleport.remainingSeconds = PLAYER_TELEPORT_ICD_SECONDS

    const to = entityGridPosition(player)

    // Emit positions ngay để renderer snap sprite TRƯỚC khi windup action
    // nào của cùng tick hoàn tất (EventBus.emit() đồng bộ).

    this.emitPositions(battle)

    this.eventBus.emit<PlayerTeleportedEvent>('player_teleported', {
      type: 'player_teleported',
      sourceId: player.id,
      from,
      to,
    })

    // TODO(renderer hook): VFX teleport gắn sau này qua event
    // player_teleported — đợt này KHÔNG tự thiết kế VFX (plan §2.5).

    return selectAttackableTarget(battle, strategy) ?? undefined
  }

  /**
   * Commit resource/timer (plan §8.5 + combat-skill-flow-element-power-dot-plan.md
   * §4.1/§4.2) — CHỈ gọi khi đã đạt đủ mọi điều kiện (learned/equipped/
   * realm/unreleased/timer ready/đủ resource/primary target trong range).
   * TRANSACTION 2 NỬA: tài nguyên trừ NGAY lúc bắt đầu; cooldown chỉ
   * commit lúc HOÀN TẤT (kể cả fizzle) với skill niệm, hoặc ngay sau
   * resolve với skill tức thời. Trả true nếu bắt đầu thành công (scheduler
   * chỉ dời con trỏ khi nhận true).
   */
  private beginPlayerCast(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
    slotIndex: number,
    _strategy: CombatAiStrategy,
  ): boolean {
    const execution = skill.execution!

    // Transaction nửa 1 — trừ tài nguyên MỘT LẦN lúc bắt đầu (§4.1);
    // chưa commit cooldown ở bước này nữa.
    const begun = this.skillSystem.beginCastInSlot(skill.id, slotIndex, source)

    if (!begun) {
      return false
    }

    // Snapshot slot của lần niệm — completion/fizzle commit đúng slot này
    // dù loadout có đổi giữa chừng (§4.1).
    source.castingSlotIndex = slotIndex

    switch (execution.kind) {
      case 'attack_speed': {
        // Resolve tức thời; cadence tái kích hoạt theo Attack Speed,
        // không internal cooldown, không chịu CDR.
        this.resolvePlayerSkillEffects(skill, source, target, battle)
        this.setSlotCadence(source, slotIndex, this.cadenceInterval(source, execution))
        this.finishPlayerCastTransaction(source, skill.id, slotIndex)
        return true
      }

      case 'attack_speed_cast': {
        if (execution.castTime > 0) {
          this.startChannel(skill, source, execution.castTime, target.id)
          return true
        }

        this.resolvePlayerSkillEffects(skill, source, target, battle)
        this.setSlotCadence(source, slotIndex, this.cadenceInterval(source, execution))
        this.finishPlayerCastTransaction(source, skill.id, slotIndex)
        return true
      }

      case 'cast_time': {
        if (execution.castTime > 0) {
          this.startChannel(skill, source, execution.castTime, target.id)
          return true
        }

        // Tức thời: begin và complete trong CÙNG fixed-step (§4.2).
        this.resolveSkillEffects(skill, source, target, battle)
        this.finishPlayerCastTransaction(source, skill.id, slotIndex)
        return true
      }

      case 'cooldown': {
        this.resolveSkillEffects(skill, source, target, battle)
        this.finishPlayerCastTransaction(source, skill.id, slotIndex)
        return true
      }

      // Kiếm Tu Bạt Kiếm (2026-08-28, Task 4) — 'channel' runtime thật
      // SỐNG Ở updateChanneling()/resolveChannelTick(), KHÔNG đi qua
      // beginPlayerCast: channel không có resource/cooldown transaction
      // theo LƯỢT cast (nó tự tick theo tickSeconds độc lập, xem
      // update()). Case này giữ nguyên là no-op CHỦ Ý — nếu 1 channel
      // skill lỡ nằm trong loadoutEntries (updatePlayerSkills() vẫn
      // duyệt qua nó), trả về false khiến scheduler bỏ qua slot này và
      // thử slot kế tiếp trong CÙNG fixed-step, đúng hành vi "channel
      // không tranh lượt với slot khác". Không cần sửa gì thêm ở đây —
      // xem case dispatch quyết định KHÔNG dời scheduler cursor tới
      // slot channel.
      case 'channel': {
        return false
      }
    }
  }

  /**
   * Transaction nửa 2 cho skill TỨC THỜI (§4.2: "cooldown bắt đầu ngay
   * sau khi effect resolve") — commit cooldown rồi dọn snapshot cast
   * state. Skill niệm dùng chung hàm này tại updateCasting().
   */
  private finishPlayerCastTransaction(source: CombatEntity, skillId: string, slotIndex: number) {
    this.skillSystem.commitSlotCooldown(skillId, slotIndex)

    if (source.castingSlotIndex === slotIndex && !source.castingSkillId) {
      source.castingSlotIndex = undefined
    }

    this.advanceChainAndGainThe(source, skillId)
  }

  private setSlotCadence(player: CombatEntity, slotIndex: number, intervalSeconds: number) {
    player.skillCadenceRemainingBySlot ??= {}

    player.skillCadenceRemainingBySlot[slotIndex] = intervalSeconds
  }

  /** Bật channel: cast time chịu Cast Speed (scale lúc tick, xem updateCasting). */
  private startChannel(skill: Skill, source: CombatEntity, castTime: number, targetId: string) {
    source.castingSkillId = skill.id

    // Ghi nhớ target GỐC — completion validate đúng target này (§8.5).
    source.castTargetId = targetId

    source.castTimeRemaining = castTime

    source.castTimeTotal = castTime

    // MainScene/CombatScene vẽ cast bar + nảy tên skill qua event này —

    // xem CombatScene.ts's onCastStart(). skillName gửi kèm THẲNG (thay

    // vì chỉ skillId) vì CombatScene chỉ giao tiếp qua EventBus, không

    // cầm tham chiếu skillManager để tự tra tên (đúng nguyên tắc "core ↔

    // Phaser CHỈ giao tiếp qua EventBus" đã ghi ở đầu CombatScene.ts).

    this.eventBus.emit('cast_start', {
      type: 'cast_start',

      sourceId: source.id,

      skillId: skill.id,

      skillName: skill.name,

      castTimeSeconds: castTime,
    })
  }

  /**
   * Cast Time — tick castTimeRemaining mỗi frame, resolve hiệu ứng thật
   * khi về 0. CHỈ player dùng cơ chế Skill-based casting (enemy có
   * telegraph riêng, xem battleEnemy.castTimer ở updateEnemyAttacks() —
   * KHÁC hẳn, không đi qua Skill Loadout). Completion VALIDATE LẠI
   * target/range (plan §8.5): fizzle thì KHÔNG hoàn resource/cooldown
   * (đã tiêu lúc bắt đầu niệm).
   */

  private updateCasting(battle: Battle, deltaSeconds: number) {
    const player = battle.player

    // Audit P0-2 (dead-cast guard) — DoT/Ailment tick CHẠY TRƯỚC
    // updateCasting() trong cùng frame. Nếu Player chết ở tick đó,
    // cast đang niệm phải HỦY NGAY: clear toàn bộ cast state + phát
    // tín hiệu để CombatScene gỡ cast bar (không kẹt trên unit đã
    // chết), TUYỆT ĐỐI không resolveSkillEffects cho xác chết.
    // checkBattleEnd() chạy sau cùng trong update() sẽ xử lý defeat.
    if (!player.alive) {
      this.cancelPlayerCast(player)

      return
    }

    if (!player.castingSkillId || player.castTimeRemaining === undefined) {
      return
    }

    // Timer đúc KHÔNG trừ trong lúc Choáng/Đóng Băng — "dừng nhịp",
    // KHÔNG huỷ cast đang dở.

    if (this.isIncapacitated(battle.playerAilments)) {
      return
    }

    player.castTimeRemaining -=
      deltaSeconds * (1 + Math.min(3, Math.max(0, player.stats.castSpeedPercent)))

    if (player.castTimeRemaining > 0) {
      return
    }

    const skillId = player.castingSkillId

    // Slot SNAPSHOT lúc bắt đầu niệm (§4.1) — không tra ngược loadout:
    // đổi loadout giữa chừng không làm cooldown gắn nhầm slot.
    const castSlotIndex = player.castingSlotIndex

    player.castingSkillId = undefined

    player.castTimeRemaining = undefined

    player.castTimeTotal = undefined

    // MainScene/CombatScene ẩn cast bar qua event này — phát LUÔN kể cả
    // fizzle để cast bar không kẹt trên đầu unit.

    this.eventBus.emit('cast_complete', {
      type: 'cast_complete',

      sourceId: player.id,

      skillId,
    })

    const skill = this.skillManager.get(skillId)

    if (!skill) {
      this.finishChannelledCastTransaction(player, skillId, castSlotIndex)

      return
    }

    // Fizzle check (plan §8.5): validate ĐÚNG target GỐC lúc bắt đầu
    // niệm — target chết/ra khỏi range trước completion → cast fizzle,
    // KHÔNG re-target sang enemy khác (review 2026-08-26).
    const castTargetId = player.castTargetId

    player.castTargetId = undefined

    if (skill.target === 'self') {
      this.resolveSkillEffects(skill, player, player, battle)

      this.finishChannelledCastTransaction(player, skillId, castSlotIndex)

      this.rearmChannelCadence(skill, player, castSlotIndex)

      return
    }

    const originalTarget = castTargetId
      ? findBattleEnemy(battle, castTargetId)?.entity
      : undefined

    if (
      !originalTarget ||
      !originalTarget.alive ||
      !canPlayerReachTarget(player, originalTarget)
    ) {
      // Fizzle (§4.2 + Combat Balance Pass 2026-08-29, plan §3.5): cast
      // bị hủy vì target chết/ra khỏi tầm — KHÔNG phải lỗi của người
      // chơi, idle game không thể phản ứng → hoàn 100% tài nguyên đã trừ
      // lúc begin, chỉ commit 50% cooldown (đủ chặn vòng lặp cast lỗi
      // liên tục nhưng nhẹ hơn penalty đầy đủ).
      this.skillSystem.refundResource(skill, player)
      this.finishChannelledCastTransaction(player, skillId, castSlotIndex, 0.5)

      return
    }

    this.resolveSkillEffects(skill, player, originalTarget, battle)

    this.finishChannelledCastTransaction(player, skillId, castSlotIndex)

    this.rearmChannelCadence(skill, player, castSlotIndex)
  }

  /**
   * Commit transaction cho lần niệm CÓ THỜI GIAN lúc HOÀN TẤT/FIZZLE
   * (§4.2) — cooldown (x fraction, plan §3.5: fizzle = 0.5) cho slot đã
   * snapshot + dọn castingSlotIndex.
   */
  private finishChannelledCastTransaction(
    player: CombatEntity,
    skillId: string,
    slotIndex: number | undefined,
    cooldownFraction = 1,
  ) {
    if (slotIndex !== undefined) {
      this.skillSystem.commitSlotCooldown(skillId, slotIndex, cooldownFraction)
    }

    player.castingSlotIndex = undefined

    // Pháp Tu Đạo Sắc (spec §2.3) — chỉ lần niệm HOÀN TẤT THẬT (fraction
    // 1) mới tính là link chuỗi + tích Thế; fizzle (0.5) là cast hỏng,
    // KHÔNG advance chuỗi.
    if (cooldownFraction >= 1) {
      this.advanceChainAndGainThe(player, skillId)
    }
  }

  /**
   * Pháp Tu Đạo Sắc (spec §2.1/§2.3) — 1 link chuỗi cast hoàn tất:
   * advance chain state (A mở B, E quay về A) + tích Thế (+10 link,
   * +20 finisher E — skill CUỐI chuỗi). No-op khi không có chain hoặc
   * skill ngoài chuỗi/sai vị trí.
   */
  private advanceChainAndGainThe(source: CombatEntity, skillId: string) {
    if (!this.chain) {
      return
    }

    const { definition, state } = this.chain
    const wasNext = canCastChainSkill(definition, state, skillId, definition.skillIds.length)

    if (!wasNext) {
      return
    }

    advanceChain(definition, state, skillId)

    const isFinisher = skillId === definition.skillIds[definition.skillIds.length - 1]
    gainTheOnChainLink(source, isFinisher)
  }

  /**
   * HỦY cast (audit P0-2 — Player chết giữa lúc niệm): clear toàn bộ
   * cast state KHÔNG commit cooldown (không phải một lần niệm hoàn tất),
   * vẫn emit 'cast_complete' để CombatScene gỡ cast bar khỏi unit.
   */
  private cancelPlayerCast(player: CombatEntity) {
    if (!player.castingSkillId) {
      return
    }

    player.castingSkillId = undefined

    player.castTimeRemaining = undefined

    player.castTimeTotal = undefined

    player.castTargetId = undefined

    player.castingSlotIndex = undefined

    this.eventBus.emit('cast_complete', {
      type: 'cast_complete',

      sourceId: player.id,

      skillId: '',
    })
  }

  /** attack_speed_cast: cadence tái kích hoạt SAU khi niệm xong (không CDR). */
  private rearmChannelCadence(skill: Skill, player: CombatEntity, slotIndex?: number) {
    const execution = skill.execution

    if (!execution || execution.kind !== 'attack_speed_cast' || slotIndex === undefined) {
      return
    }

    this.setSlotCadence(player, slotIndex, this.cadenceInterval(player, execution))
  }


  /**

   * Phần "hiệu ứng thật" của 1 lần cast — TÁCH khỏi castSkill() (Cast

   * Time, 2026-08-21) để beginCast()/updateCasting() dùng chung: skill

   * castTime=0 gọi NGAY qua castSkill(), skill castTime>0 gọi hàm này

   * SAU khi đếm ngược xong (use() đã chạy từ lúc beginCast(), KHÔNG gọi

   * lại ở đây để tránh trừ cooldown/resource 2 lần).

   */

  /**
   * Kiếm Thế (spec 2026-08-29-kiem-the-kiem-y mục 2) — wrapper cho
   * resolveSkillEffects với skill CỦA PLAYER: cast kiếm trận
   * (kiem_tran_*) +số kiếm của trận vào pool (cap 100), và mọi hit
   * kiếm trận được cộng +1% sát thương mỗi 2 điểm Kiếm Thế hiện có
   * (đầy 100 = +50%) qua cùng đường finalDamagePercent snapshot như
   * amp Bạt Kiếm. Ult TTKT KHÔNG đi qua đây (nút manual riêng).
   */
  private resolvePlayerSkillEffects(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
  ) {
    const isFormation = skill.id.startsWith('kiem_tran_')
    const route = this.getKiemTuRoute()

    if (!isFormation || route !== 'kiem_tran') {
      this.resolveSkillEffects(skill, source, target, battle)
      return
    }

    const swordCount = getFormationSwordCount(skill.id) ?? 0

    const originalFinalDamagePercent = source.stats.finalDamagePercent

    // +1% mỗi 2 điểm Kiếm Thế (đầy 100 = +50%) — quy về FRACTION cùng
    // thang finalDamagePercent (0.5 = +50%).
    const kiemTheBonus = kiemTheDamageBonusPercent(source.currentKiemThe ?? 0) / 100

    if (kiemTheBonus > 0) {
      source.stats.finalDamagePercent = originalFinalDamagePercent + kiemTheBonus
    }

    try {
      this.resolveSkillEffects(skill, source, target, battle)
    } finally {
      source.stats.finalDamagePercent = originalFinalDamagePercent
    }

    // On-hit kiếm trận (spec 2026-08-29 mục 4) — roll sau mỗi cast,
    // áp lên MỌI địch còn sống trong trận (hit kiếm trận là AoE theo
    // targeting; ult TTKT nuke/zone cũng đi qua wrapper này).
    if (battle.enemies.some((enemy) => enemy.entity.alive)) {
      this.resolveOnHitForBattle(battle, source, swordCount)
    }

    // Gain SAU resolve: pool tăng theo cast vừa tung, hưởng từ cast kế.
    gainKiemTheOnFormationCast(source, swordCount)
  }

  /** Roll + dispatch on-hit kiếm trận lên mọi địch còn sống. */
  private resolveOnHitForBattle(battle: Battle, source: CombatEntity, swordCount: number) {
    const nodeLevels = this.getOnHitNodeLevels()
    if (Object.keys(nodeLevels).length === 0) {
      return
    }

    for (const enemy of battle.enemies) {
      if (!enemy.entity.alive) {
        continue
      }

      resolveOnHitEffects(
        nodeLevels,
        Math.random,
        source,
        enemy.entity,
        swordCount,
        (kind, _source, target, swords) => this.dispatchOnHitEffect(kind, _source, target, swords),
      )
    }
  }

  /** Map từng kind on-hit vào hệ thống sẵn có (spec mục 4 — qua pipeline). */
  private dispatchOnHitEffect(
    kind: import('../progression/ProgressionNode').OnHitEffectKind,
    source: CombatEntity,
    target: CombatEntity,
    swordCount: number,
  ) {
    const battle = this.battle
    if (!battle) {
      return
    }

    switch (kind) {
      case 'khiem_khi_dmg': {
        // Kiếm khí bổ sung — bonus damage kim qua applyModifiedDirectDamage
        // (pipeline CombatSystem sẵn có, KHÔNG hack trực tiếp).
        const bonus = 0.5 * swordCount * source.stats.attack
        this.combat.applyModifiedDirectDamage(target, bonus, source, 'damage')
        break
      }
      case 'xuat_huyet_dot': {
        // Chảy máu — tái dùng ailment van_kiem_vu sẵn có.
        const ailment = this.ailmentRegistry.get('van_kiem_vu')
        if (ailment) {
          new AilmentSystem(this.getAilmentsFor(battle, target)).apply(
            ailment,
            source,
            target,
            this.ailmentRegistry,
          )
        }
        break
      }
      case 'tran_tru_cc': {
        // Trói chân/choáng — ailment sẵn có theo roll phụ.
        const ccId = Math.random() < 0.5 ? 'troi_chan' : 'choang'
        const ailment = this.ailmentRegistry.get(ccId)
        if (ailment) {
          new AilmentSystem(this.getAilmentsFor(battle, target)).apply(
            ailment,
            source,
            target,
            this.ailmentRegistry,
          )
        }
        break
      }
      case 'hap_linh_leech': {
        // Hút máu theo sát thương ước lượng (leechPercent pipeline).
        const heal = source.stats.attack * 0.2 * swordCount * 0.1
        if (heal > 0 && source.alive) {
          this.combat.applyHealing(source, heal, source.id, 'healing')
        }
        break
      }
      case 'khiem_phong_haste':
      case 'phan_kich_dodge':
      case 'pha_giap_pen':
      case 'quang_crit':
      case 'than_ngu_hanh': {
        // Stat-based kinds — buff stack tạm trong trận qua BuffManager
        // sẵn có (tự hết khi trận kết thúc vì battle buff managers là
        // runtime-per-battle). Modifier pipeline là nguồn tính lại
        // stats (calculateStats chạy mỗi update).
        const statByKind: Record<string, StatModifier['stat']> = {
          khiem_phong_haste: 'attackSpeed',
          phan_kich_dodge: 'evasionRate',
          pha_giap_pen: 'metalPenetration',
          quang_crit: 'criticalRate',
          than_ngu_hanh: 'metalPower',
        }
        const statKey = statByKind[kind] as (typeof statByKind)[string] | undefined
        if (statKey) {
          const buffManager = this.getBuffsFor(battle, source)
          const buffId = `onhit_${kind}`
          const existing = buffManager.get(buffId)
          if (existing) {
            existing.stacks += 1
          } else {
            buffManager.add({
              id: buffId,
              name: `On-hit ${kind}`,
              category: 'buff',
              stacks: 1,
              stackMode: 'stack',
              modifiers: [{ id: `${buffId}:${statKey}`, sourceId: buffId, sourceType: 'buff', stat: statKey, percent: 0.02 }],
            })
          }
        }
        break
      }
    }
  }

  private resolveSkillEffects(
    skill: Skill,
    source: CombatEntity,
    target: CombatEntity,
    battle: Battle,
  ) {
    gainPhapTuCastResources(skill, source)

    // Nguồn duy nhất emit 'cast' — PassiveSystem dùng event này cho

    // passive có trigger 'cast'.

    this.eventBus.emit('cast', {
      type: 'cast',

      sourceId: source.id,

      targetId: target.id,

      skillId: skill.id,

      skillName: skill.name,
    })

    const sourceBuffs = new BuffSystem(this.getBuffsFor(battle, source))

    // Đọc qua getEffectiveSkill() để tôn trọng Specialization đã

    // chọn (behavior-changing node) + effect 'damage' đã scale theo

    // level hiện tại.

    const effective = this.skillSystem.getEffectiveSkill(skill, source.skillLevels?.[skill.id])

    // Combat Grid Rework — MỘT action = MỘT impact VFX: mở batch trước

    // vòng lặp, đóng sau; mọi fireHit trong lúc đó đăng ký target vào

    // cùng event action_impact neo tại ô PRIMARY target.

    const earthPureActive =
      effective.effects.some((effect) => effect.earthPureAreaBehavior === true) &&
      getSkillRuntimeStat(source, 'earthAoeRadius') > 0

    const baseTargeting = targetingForSkill(skill)
    const laneRadius = earthPureActive
      ? Math.max(1, Math.round(getSkillRuntimeStat(source, 'earthAoeRadius')))
      : (baseTargeting.laneRadius ?? 0)
    const columnRadius = earthPureActive ? laneRadius : (baseTargeting.columnRadius ?? 0)
    const targeting = earthPureActive
      ? { ...baseTargeting, shape: 'area' as const, laneRadius, columnRadius }
      : baseTargeting
    const anchorCell = worldToGridPosition(target.x, target.row + 0.5)
    const affectedArea = areaFor(target.row, anchorCell.column, targeting)

    if (!affectedArea) {
      return
    }

    this.actionImpact.beginSkillBatch({
      actionId: skill.id,

      sourceId: source.id,

      primaryTargetId: target.id,

      presetId: vfxPresetForSkill(skill),

      anchorCell,
      area: { ...affectedArea, shape: targeting.shape },
      hitCount: effective.effects.some((effect) => effect.hitCountByRealm)
        ? source.realmIndex + 1
        : 1,

      secondaryPercent: earthPureActive
        ? getSkillRuntimeStat(source, 'earthAoeSecondaryDamagePercent')
        : undefined,

      knockbackDistance: earthPureActive
        ? getSkillRuntimeStat(source, 'earthKnockbackDistance')
        : undefined,
    })

    const targets =
      skill.target === 'self'
        ? [source]
        : collectAffected(battle, source, target.id, target.row, anchorCell.column, targeting)

    const applyEffects = (effects: SkillEffect[], oneTarget: CombatEntity) => {
      let landedHit = false
      const targetBuffs = new BuffSystem(this.getBuffsFor(battle, oneTarget))

      const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, oneTarget))

      this.skillEffectSystem.applyAll(effects, source, oneTarget, {
        combatSystem: this.combat,
        fireHit: (hitTarget, damageInfo) => {
          const result = this.actionImpact.fireSkillHit(
            battle,

            source,

            hitTarget,

            damageInfo,

            { skillId: skill.id },

            (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) => {
              return this.applyActionHit(
                battleRef,
                hitSource,
                hitTargetEntity,
                hitDamage,
                hitOptions,
              )
            },
          )

          landedHit ||= result.landed
          return result
        },
        didLandHit: () => landedHit,
        buffRegistry: this.buffRegistry,

        ailmentRegistry: this.ailmentRegistry,

        sourceBuffs,

        targetBuffs,

        targetAilments,

        reactionManager: this.reactionManager,

        reactionKeepChance: this.getReactionKeepChance(),

        spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),

        spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),

        skillId: skill.id,

        skillExperience: skill.totalExperience ?? skill.experience ?? 0,

        eventBus: this.eventBus,
      })
    }

    const sourceEffects = effective.effects.filter((effect) => scopeForEffect(effect) === 'source')
    const primaryEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'primary_target',
    )
    const areaEffects = effective.effects.filter(
      (effect) => scopeForEffect(effect) === 'affected_targets',
    )

    if (sourceEffects.length > 0) {
      applyEffects(sourceEffects, source)
    }

    if (primaryEffects.length > 0) {
      applyEffects(primaryEffects, target)
    }

    for (const oneTarget of targets) {
      applyEffects(areaEffects, oneTarget)
    }

    // Trigger/Action rework (2026-08-31 spec) — skills fully migrated to
    // `triggers` (effective.effects === []) fire onCast here instead.
    // Reuses the SAME batch (beginSkillBatch() already ran above) so
    // ctx.fireHit still lands inside one action_impact VFX event.
    if (effective.triggers?.length) {
      for (const oneTarget of targets) {
        let landedHit = false
        const targetBuffs = new BuffSystem(this.getBuffsFor(battle, oneTarget))
        const targetAilments = new AilmentSystem(this.getAilmentsFor(battle, oneTarget))

        const triggerCtx: SkillEffectContext = {
          combatSystem: this.combat,
          fireHit: (hitTarget, damageInfo) => {
            const result = this.actionImpact.fireSkillHit(
              battle,
              source,
              hitTarget,
              damageInfo,
              { skillId: skill.id },
              (battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions) =>
                this.applyActionHit(battleRef, hitSource, hitTargetEntity, hitDamage, hitOptions),
            )
            landedHit ||= result.landed
            return result
          },
          didLandHit: () => landedHit,
          buffRegistry: this.buffRegistry,
          ailmentRegistry: this.ailmentRegistry,
          sourceBuffs,
          targetBuffs,
          targetAilments,
          reactionManager: this.reactionManager,
          reactionKeepChance: this.getReactionKeepChance(),
          spawnLavaZone: (spec) => this.spawnLavaZone(battle, spec),
          spawnSwordZone: (spec) => this.spawnSwordZone(battle, spec),
          skillId: skill.id,
          skillExperience: skill.totalExperience ?? skill.experience ?? 0,
          eventBus: this.eventBus,
        }

        this.skillTriggerRunner.fire(
          'onCast',
          { source, skill },
          effective.triggers,
          source,
          oneTarget,
          triggerCtx,
        )
      }
    }

    this.actionImpact.endSkillBatch(battle)
  }

  /**
   * Kiếm Tu Bạt Kiếm (Task 4, spec §4.2) — TỤ LỰC: tick độc lập, KHÔNG
   * qua beginPlayerCast/cadence/CDR. `tuLucElapsed` đếm dồn mỗi frame;
   * `while` (không `if`) để bắt kịp trường hợp deltaSeconds lớn bất
   * thường bỏ qua nhiều kỳ liền — cùng gotcha đã gặp ở Kim Thế/Lava Zone.
   * Chết/khống chế cứng cắt NGAY, huỷ tiến độ kỳ đang dở (không nổ phát
   * dở dang) — kiểm tra TRƯỚC khi cộng dồn elapsed của tick này.
   */
  private updateChanneling(battle: Battle, deltaSeconds: number) {
    const player = battle.player

    if (!player.tuLucActive) {
      return
    }

    if (this.isChannelInterrupted(battle)) {
      player.tuLucActive = false
      player.tuLucElapsed = 0
      player.tuLucDamageTakenPercent = 0

      return
    }

    if (!this.channelSkillId) {
      return
    }

    const skill = this.skillManager.get(this.channelSkillId)

    if (!skill || skill.execution?.kind !== 'channel') {
      return
    }

    player.tuLucElapsed += deltaSeconds

    const execution = skill.execution

    const tickSeconds = this.channelTickSecondsOverrides.get(skill.id) ?? execution.tickSeconds

    while (tickSeconds > 0 && player.tuLucElapsed >= tickSeconds) {
      player.tuLucElapsed -= tickSeconds

      // Review fix (Important #1) — snapshot TRƯỚC lệnh gọi, trừ ĐÚNG
      // snapshot đó sau (KHÔNG `= 0`): resolveChannelTick() chạy đồng bộ
      // qua CombatSystem pipeline, và target trúng đòn có thể phản
      // damage NGƯỢC lại Player (thornsPercent/wardBreakDamagePercent,
      // xem CombatSystem.ts applyModifiedDirectDamage) NGAY TRONG lệnh
      // gọi này — onEntityVitalsChanged() sẽ cộng thêm phần phản đó vào
      // tuLucDamageTakenPercent trước khi resolveChannelTick() trả về.
      // `= 0` sẽ xoá mất phần vừa cộng thêm đó; trừ snapshot giữ lại nó
      // cho kỳ KẾ TIẾP.
      const ampSnapshot = player.tuLucDamageTakenPercent

      this.resolveChannelTick(battle, skill, ampSnapshot, tickSeconds)

      player.tuLucDamageTakenPercent -= ampSnapshot

      // Kiếm Ý tạm (spec 2026-08-29 mục 3.2) — mỗi tick tụ lực +1,
      // cap vĩnh viễn + 900 (đã hấp thụ qua init đầu trận).
      gainKiemYTempOnChannelTick(player, this.getKiemYPermanent())
    }
  }

  /** Chết hoặc khống chế cứng (Choáng/Thạch Hóa/Trói Chân, spec §4.2) cắt tụ lực. */
  private isChannelInterrupted(battle: Battle): boolean {
    const player = battle.player

    if (!player.alive) {
      return true
    }

    const ailments = battle.playerAilments

    return ailments.has('choang') || ailments.has('thach_hoa') || ailments.has('troi_chan')
  }

  /**
   * Một kỳ tụ lực nổ — resolve qua ĐÚNG đường cast tức thời sẵn có
   * (`resolveSkillEffects`), target = enemy gần nhất bất kỳ (shape thật
   * sự của skill 'all_lanes' do `targetingForSkill()` tự quyết theo
   * `skill.target === 'all_enemies'`, KHÔNG phụ thuộc primary chọn ai —
   * xem CombatAction.ts:44). Amp "nhận→gây": khuếch đại tạm thời qua
   * đúng multiplier path sẵn có (`finalDamagePercent`, đã được
   * CombatSystem.resolveAttack() nhân vào MỌI đòn của nguồn) — KHÔNG
   * đụng CombatSystem.ts. Trả `stats.finalDamagePercent` về giá trị gốc
   * NGAY sau lệnh gọi đồng bộ này (fireSkillHit trong resolveSkillEffects
   * resolve hit ngay tại chỗ, không qua windup queue) để không rò rỉ amp
   * sang các đòn khác trong cùng frame (vd enemy attack cùng lúc, dù
   * multiplier chỉ đọc phía attacker nên rủi ro rò rỉ gần như không có,
   * vẫn khôi phục cho sạch).
   *
   * `tickSeconds` (Critical #2 review fix, spec §4.2) — cùng đường
   * finalDamagePercent với amp "nhận→gây": multiplier phát quạt
   * (batKiemTickLengthMultiplier, ×1@3s → ×3@9s tuyến tính) quy về
   * percent-point CỘNG THÊM (M - 1), giữ cùng ngữ nghĩa cộng dồn với
   * damage-taken amp thay vì bọc thêm 1 lớp nhân riêng.
   */
  private resolveChannelTick(battle: Battle, skill: Skill, damageTakenPercent: number, tickSeconds: number) {
    const target = this.findNearestAliveEnemy(battle)

    if (!target) {
      return
    }

    const player = battle.player

    const originalFinalDamagePercent = player.stats.finalDamagePercent

    const tickLengthBonus = batKiemTickLengthMultiplier(tickSeconds) - 1

    // Kiếm Ý nerf BKT (spec 2026-08-29 mục 3.4) — base theo tầng vĩnh
    // viễn (10 kiếm ý/tầng): 0.6 + 0.02×tier, tầng 20 về 1.0. Tier là
    // multiplier NHÂN vào tổng (tickLength + amp) — KHÔNG cộng thẳng
    // fDP (cộng sẽ phá tỷ lệ tickLength ×3@9s: (2−0.4) thay vì 2×0.6),
    // xem BattleSystem.batKiem.test.ts "tick 9s ~3x".
    const kiemYPermanent = this.getKiemYPermanent()
    const tier = Math.floor(kiemYPermanent / KIEM_Y_PER_TIER_LOCAL)
    const tierMultiplier = BAT_KIEM_BASE_AT_TIER_0 + BAT_KIEM_BASE_PER_KIEM_Y_TIER * tier

    const combinedMultiplier =
      (1 + tickLengthBonus + damageTakenPercent * BAT_KIEM_AMP_PER_DAMAGE_TAKEN) * tierMultiplier

    player.stats.finalDamagePercent = originalFinalDamagePercent + (combinedMultiplier - 1)

    // Hấp thụ Huy Kiếm (spec mục 3.4) — flat floor(tramCasts/10) cộng
    // thẳng vào value damage đầu tiên của skill qua bản effective tạm
    // ( KHÔNG mutate skill template dùng chung): resolveSkillEffects
    // đọc skill.effects — tạo shallow copy với value + huyKiemBonus.
    const huyKiemBonus = getHuyKiemFlatDamageBonus(this.getTramTotalCasts())
    const effectiveSkill: Skill = huyKiemBonus > 0
      ? { ...skill, effects: skill.effects.map((effect, index) =>
          index === 0 && effect.type === 'damage' && effect.value !== undefined
            ? { ...effect, value: effect.value + huyKiemBonus }
            : effect,
        ) }
      : skill

    try {
      this.resolveSkillEffects(effectiveSkill, player, target, battle)
    } finally {
      player.stats.finalDamagePercent = originalFinalDamagePercent
    }
  }

  /**
   * Task 7 UI slider (spec §4.2, 3–9s) gọi — có hiệu lực TỪ KỲ TỤ KẾ
   * TIẾP đúng nghĩa đen (Review fix, Important #2): nếu đang tụ lực
   * ĐÚNG skill này, reset `tuLucElapsed` về 0 luôn — bỏ tiến độ dở dang
   * theo nhịp CŨ thay vì diễn giải lại số giây đã tích dồn theo nhịp
   * MỚI (nhịp mới nhỏ hơn nhịp cũ có thể khiến 1 frame nổ 2 lần nếu
   * không reset, vì `tuLucElapsed` đã tích theo nhịp cũ chưa từng được
   * "tiêu" ở nhịp mới). tuLucDamageTakenPercent GIỮ NGUYÊN — amp đã tích
   * trong kỳ dở dang không phải lỗi của người chơi, không có lý do mất.
   */
  setChannelTickSeconds(skillId: string, seconds: number): void {
    this.channelTickSecondsOverrides.set(skillId, seconds)

    if (this.channelSkillId === skillId && this.battle?.player.tuLucActive) {
      this.battle.player.tuLucElapsed = 0
    }
  }

  /**
   * Ult Kiếm Tu (spec 2026-08-29 mục 2/3.4) — nút manual từ UI gọi
   * trực tiếp; auto-check 1 lần/giây từ update() (timer riêng dưới).
   * Trả 'ttkt'/'kktm' nếu ult đã nổ, null nếu không đủ điều kiện.
   * Ult KHÔNG đi qua loadout scheduler (như channel).
   */
  tryPlayerUltimate(): 'ttkt' | 'kktm' | null {
    const battle = this.battle
    const route = this.getKiemTuRoute()

    if (!battle || battle.state !== 'fighting' || !route) {
      return null
    }

    const swordCount = this.getHighestFormationSwordCount()

    const nukeResolver = (target: CombatEntity) => {
      // Đòn nuke đơn giản: dùng effective stats + resolveSkillEffects
      // với ult skill tương ứng route (đã đăng ký qua node unlock).
      const ultSkillId = route === 'kiem_tran' ? 'tru_tien_kiem_tran' : 'kiem_khai_thien_mon'
      const ultSkill = this.skillManager.get(ultSkillId)

      const targetHpBefore = target.currentHp

      if (ultSkill) {
        this.resolveSkillEffects(ultSkill, battle.player, target, battle)
      }

      // Ước lượng total damage cho overkill KKTM: phần HP target mất.
      return targetHpBefore - Math.max(0, target.currentHp)
    }

    const triggered = triggerUltimate(battle, route, swordCount, { resolveNuke: nukeResolver })

    if (!triggered) {
      return null
    }

    return route === 'kiem_tran' ? 'ttkt' : 'kktm'
  }

  /** Cấp trận cao nhất đã mở (số kiếm cho cost ult TTKT). */
  private getHighestFormationSwordCount(): number {
    let highest = 2
    for (const entry of this.skillManager.getLoadoutEntries()) {
      const swordCount = getFormationSwordCount(entry.skill.id)
      if (swordCount !== undefined && swordCount > highest) {
        highest = swordCount
      }
    }
    return highest
  }

  /**
   * Enemy đã ở THẾ ĐỨNG BẮN: trong tầm của chính nó tới cổng VÀ không
   * còn di chuyển nữa (kiter lùi về preferred thì coi như đang di chuyển).
   * Yêu cầu sản phẩm 2026-08-26 — KHÔNG bắn khi đang đi bộ; quái chỉ mở
   * hỏa lực sau khi dừng ở biên range.
   */
  private isEnemyInPosition(entity: CombatEntity): boolean {
    if (!canEnemyReachGate(entity, HERO_COLUMN)) {
      return false
    }

    const isKiter = entity.archetype === 'ranged' || entity.archetype === 'caster'

    if (isKiter) {
      return Math.abs(entity.x - HERO_COLUMN) >= entity.stats.attackRange * RANGED_PREFERRED_DISTANCE_RATIO
    }

    return true
  }

  private updateEnemyAttacks(
    battle: Battle,

    deltaSeconds: number,
  ) {
    // Targetability (plan §5.4/§13): Player và enemy ĐỀU phải materialize
    // + còn sống thì enemy mới có target (cổng) để đánh.
    if (!battle.playerMaterialized || !battle.player.alive) {
      return
    }

    for (const battleEnemy of battle.enemies) {
      if (!battleEnemy.entity.alive) {
        continue
      }

      if (this.isIncapacitated(battleEnemy.ailments)) {
        continue
      }

      // Core Loop Foundation checklist (Mục MONSTER) — 'caster' đang

      // trong khoảng lặng telegraph, đếm ngược riêng, KHÔNG đụng

      // attackTimer cho tới khi bắn xong.

      if (battleEnemy.castTimer !== undefined) {
        battleEnemy.castTimer -= deltaSeconds

        if (battleEnemy.castTimer > 0) {
          continue
        }

        battleEnemy.castTimer = undefined

        this.fireEnemyAttack(battleEnemy, battle)

        continue
      }

      if (battleEnemy.attackTimer > 0) {
        continue
      }

      // "Đứng lại rồi mới đánh" (yêu cầu sản phẩm 2026-08-26): quái còn
      // off-screen hoặc CHƯA dừng ở biên range của chính nó thì KHÔNG tiêu
      // attack timer, không mở telegraph — di chuyển và tấn công loại trừ
      // nhau.

      if (
        !this.isEnemyInPosition(battleEnemy.entity) ||
        battleEnemy.entity.x > VISIBLE_MAX_COLUMN
      ) {
        continue
      }

      if (battleEnemy.entity.archetype === 'caster') {
        // Bắt đầu telegraph thay vì bắn ngay — attackTimer CHƯA reset

        // (làm ở nhánh trên khi khoảng lặng kết thúc), tránh 2 lần

        // trừ tempo cho cùng 1 đòn.

        battleEnemy.castTimer = CASTER_CAST_DELAY_SECONDS

        continue
      }

      this.fireEnemyAttack(battleEnemy, battle)
    }
  }

  private fireEnemyAttack(battleEnemy: Battle['enemies'][number], battle: Battle) {
    const attackSpeed = battleEnemy.entity.stats.attackSpeed

    battleEnemy.attackTimer = getAttackIntervalSeconds(attackSpeed)

    // Combat Grid Rework — enemy attack cũng là action impact: ranged

    // "bắn phép" = impact TẠI target (không vật thể bay), windup dài hơn.

    const isRanged =
      battleEnemy.entity.archetype === 'ranged' || battleEnemy.entity.archetype === 'caster'

    // Combat Balance Pass (2026-08-29, plan §3.6) — action đặc biệt data-
    // driven: đếm attack 1-based, mỗi attack MỚI thứ `everyNth` (khớp
    // spec ĐẦU TIÊN trong danh sách) thay basic bằng impact với
    // damageMultiplier/presetId riêng. Đếm qua field runtime trên
    // battleEnemy — không mutate data gốc.
    const specialCount = (battleEnemy.specialAttackCounter ?? 0) + 1

    battleEnemy.specialAttackCounter = specialCount

    const special = battleEnemy.entity.specialAttacks?.find(
      candidate => specialCount % candidate.everyNth === 0,
    )

    if (special) {
      this.actionImpact.scheduleBasic({
        actionId: `${battleEnemy.entity.id}:special`,
        sourceId: battleEnemy.entity.id,
        targetId: battle.player.id,
        damage: { kind: 'physical', multiplier: special.damageMultiplier },
        presetId: special.presetId ?? 'boss_ground_slam',
        windupSeconds: special.windupSeconds ?? ENEMY_MELEE_WINDUP_SECONDS,
      })

      return
    }

    this.actionImpact.scheduleBasic({
      actionId: `${battleEnemy.entity.id}:basic`,

      sourceId: battleEnemy.entity.id,

      targetId: battle.player.id,

      damage: { kind: 'physical', multiplier: 1 },

      presetId:
        battleEnemy.entity.archetype === 'caster'
          ? 'arcane_impact'
          : isRanged
            ? 'arcane_impact'
            : 'claw',

      windupSeconds:
        battleEnemy.entity.archetype === 'caster' || isRanged
          ? ENEMY_RANGED_WINDUP_SECONDS
          : ENEMY_MELEE_WINDUP_SECONDS,
    })
  }

  /**

   * CHỈ quyết 'defeat' (player chết) — 'victory' giờ do GameManager

   * quyết (cần biết tiến độ Stage: đã spawn đủ + hết quái sống chưa,

   * thứ BattleSystem không nên biết, xem GameManager.updateStageProgress()).

   */

  private checkBattleEnd(battle: Battle) {
    if (!battle.player.alive) {
      battle.state = 'defeat'

      // Chỉ chạy tới đây đúng 1 lần — update() early-return ngay từ

      // đầu khi battle.state !== 'fighting' ở tick kế, nên khỏi cần

      // cờ chống emit lặp.

      this.eventBus.emit('battle_end', { type: 'battle_end', state: 'defeat' })
    }
  }

  stop() {
    this.actionImpact.clear()

    this.battle = null
  }
}
