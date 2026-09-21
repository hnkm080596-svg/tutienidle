import type { AlchemySystem } from '../alchemy/AlchemySystem'
import type { BuffPersistence } from '../buff2/BuffPersistence'
import type { Material } from '../material/Material'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { PillBag } from '../pill/PillBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PlayerData } from '../player/Player'
import type { DecomposeSystem, DecomposeOutputEntry } from '../production/DecomposeSystem'
import type { ProductionSystem } from '../production/ProductionSystem'
import { resolveProductionWorkerCapacity } from '../production/WorkerCapacity'
import type { QuestManager } from '../quest/QuestManager'
import type { QuestRegistry } from '../quest/QuestRegistry'
import type { QuestSystem } from '../quest/QuestSystem'
import type { PassiveSystem } from '../skill/PassiveSystem'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import type { TribulationDirector } from '../tribulation/TribulationDirector'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import type { NotificationQueue } from './NotificationQueue'
import type { GameManagerTurnBattleOps } from './GameManagerTurnBattleOps'

/**
 * Per-tick orchestration (App.vue game loop -> GameManager.update).
 * Extracted from GameManager (large-file split); moved verbatim.
 *
 * Owns:
 * - the settle block driven each tick for the active player (timed
 *   effects, body refinement, quest reconciliation/daily reset,
 *   production/alchemy/decompose settle + notifications);
 * - the shared decompose delivery path (online tick + offline restore
 *   both call deliverDecomposeOutput);
 * - the quest realm-transition flag consumed by the next tick;
 * - the fixed-step battle/tribulation tail of the tick.
 *
 * Public access: `gameManager.tickOps.*` (no GameManager facade).
 */
export class GameManagerTickOps {
  constructor(
    private readonly deps: {
      getActivePlayer: () => PlayerData | undefined
      tickTimedEffects: (player: PlayerData) => void
      // P7-M5 - the tick auto-invests the body_refinement chapter through
      // the unified BodyProgression op (Tinh Hoa Pham The -> Luyen The).
      investBodyChapter: (player: PlayerData) => void
      questSystem: QuestSystem
      questRegistry: QuestRegistry
      questManager: QuestManager
      notifyQuestMaterialGained: (materialId: string, amount: number) => void
      notifications: NotificationQueue
      productionSystem: ProductionSystem
      materialBag: MaterialBag
      materialRegistry: MaterialRegistry
      decomposeSystem: DecomposeSystem
      getWorkerAssignments: () => Map<string, number>
      alchemySystem: AlchemySystem
      pillBag: PillBag
      pillRegistry: PillRegistry
      persistentBuffs: BuffPersistence
      passiveSystem: PassiveSystem
      turnBattleOps: GameManagerTurnBattleOps
      tribulationDirector: TribulationDirector
    },
  ) {}

  /**
   * R8.1 (AR-09) - set by the realm-transition writer; consumed and
   * cleared by the next update tick. Lifecycle-owned quest
   * reconciliation must run even though realm changes currently happen
   * outside this manager (R8.2 moved tribulation outcomes into core:
   * TribulationOutcomeService marks the transition via
   * markQuestRealmTransition()).
   */
  private questRealmReconcileNeeded = false

  /** R8.1 (AR-09) - realm-transition writers call this; cheap flag set. */
  markQuestRealmTransition(): void {
    this.questRealmReconcileNeeded = true
  }

  /**
   * R8.1 (AR-09) - lifecycle reconciliation command: activates every
   * eligible quest exactly once (idempotent, cheap registry scan).
   * Called from the tick path (after daily reset / realm transition
   * flag) and from restore. Never from a read/query path.
   */
  reconcileQuestLifecycle(): void {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return
    }

    this.deps.questSystem.reconcileActiveQuests(
      this.deps.questRegistry,
      this.deps.questManager,
      player,
    )
    this.questRealmReconcileNeeded = false
  }

  /**
   * Gọi mỗi tick từ game loop (App.vue) với deltaSeconds đo được
   * từ GameClock. GameManager chỉ forward xuống các system có
   * trạng thái phụ thuộc thời gian — không tự tính thời gian.
   */
  update(deltaSeconds: number) {
    if (deltaSeconds <= 0) {
      return
    }

    const activePlayer = this.deps.getActivePlayer()

    // Timed effect theo thời gian thực — tick expiry ở MỌI update (cả
    // khi pause battle) vì deadline là Date.now() tuyệt đối, không dùng
    // game delta kéo dài buff (plan §5.4). Player reference do App.vue
    // đăng ký qua setActivePlayer() sau boot/load.
    if (activePlayer) {
      this.deps.tickTimedEffects(activePlayer)
      this.deps.investBodyChapter(activePlayer)

      // R8.1 (AR-09) - realm-transition reconciliation: the writer set
      // the flag; activate newly eligible quests on the first tick
      // after the realm change, without any panel read.
      if (this.questRealmReconcileNeeded) {
        this.reconcileQuestLifecycle()
      }

      // Quest daily reset (Quest System plan) — wall-clock day-bucket,
      // check mỗi tick nên vẫn reset kể cả khi panel Nhiệm Vụ đang đóng.
      if (
        this.deps.questSystem.checkAndResetDaily(
          this.deps.questRegistry,
          this.deps.questManager,
          activePlayer,
        )
      ) {
        this.deps.notifications.push({ kind: 'craft', message: 'Nhiệm vụ hằng ngày đã làm mới' })

        // R8.1 (AR-09) - daily reset removes daily entries; the
        // lifecycle command rebuilds today's board immediately so
        // kills/collects keep counting without opening QuestPanel.
        this.reconcileQuestLifecycle()
      }

      // R7 (AR-08) shared worker pool - decompose claims its workers
      // from the CHQ capacity FIRST; production receives the remainder via
      // the ONE split rule (Mission D / spec D5) - the same helper the
      // restore path uses (GameManagerSaveRestore). Capacity is
      // re-supplied every tick so CHQ build/upgrade takes effect without
      // a restart, and stale restored workers clamp down.
      this.deps.decomposeSystem.updateCapacity(activePlayer.autoWorkerCapacity ?? 0)
      const productionCapacity = resolveProductionWorkerCapacity(
        activePlayer.autoWorkerCapacity ?? 0,
        this.deps.decomposeSystem.getSettings().workers,
      )

      this.deps.productionSystem.tickWorkers(
        Date.now(),
        this.deps.materialBag,
        this.deps.materialRegistry,
        activePlayer.realmId,
        productionCapacity,
        this.deps.getWorkerAssignments(),
      )

      for (const event of this.deps.productionSystem.drainSettlementEvents()) {
        const material = this.deps.materialRegistry.has(event.materialId)
          ? this.deps.materialRegistry.get(event.materialId)
          : undefined

        // ARCH-012 (M12) — the settle event is a RECEIPT: `amount` is the
        // rolled/request quantity, `overflow` is what the bag clamp lost.
        // The toast must show DELIVERED (amount - overflow), and the lost
        // part surfaces through the shared bag.overflow notification —
        // never claim the full amount when the bag was full.
        const overflow = event.overflow ?? 0
        const delivered = event.amount - overflow

        // Collect-quest hook (review 2026-08-28) — production settle là
        // nguồn material chính của collect-quest. Chỉ tính lượng thật sự
        // vào túi (trừ overflow).
        this.deps.notifyQuestMaterialGained(event.materialId, delivered)

        if (delivered > 0) {
          this.deps.notifications.push({
            kind: 'loot',
            message: `${material?.name ?? event.materialId} +${delivered}`,
          })
        }

        if (overflow > 0) {
          this.deps.notifications.push(
            createBagOverflowEvent(material?.name ?? event.materialId, overflow),
          )
        }
      }

      // Đan Phòng settle (§8.3). M3 — Hoa Hau Thong Than: x2 pill yield
      // per successful job — read from activePlayer each tick.
      this.deps.alchemySystem.tick(
        Date.now(),
        this.deps.pillBag,
        (pillId) =>
          this.deps.pillRegistry.has(pillId) ? this.deps.pillRegistry.get(pillId) : undefined,
        Math.random,
        0,
        getAlchemyDoublePill(activePlayer.selectedTalentIds)?.yieldMultiplier ?? 1,
      )

      for (const event of this.deps.alchemySystem.drainSettlementEvents()) {
        const pill = this.deps.pillRegistry.has(event.pillId)
          ? this.deps.pillRegistry.get(event.pillId)
          : undefined

        // ARCH-012 (M12) — receipt fields: `pills` = generated, `delivered`
        // = actually added to the PillBag, `overflow` = lost to the stack
        // clamp. Toast DELIVERED and surface the loss through bag.overflow;
        // a fully-overflowed success must not claim "x N" that never landed.
        if (event.success) {
          if (event.delivered > 0) {
            this.deps.notifications.push({
              kind: 'craft',
              message: `${pill?.name ?? event.pillId} x${event.delivered}`,
            })
          }

          if (event.overflow > 0) {
            this.deps.notifications.push(
              createBagOverflowEvent(pill?.name ?? event.pillId, event.overflow),
            )
          }
        } else {
          this.deps.notifications.push({
            kind: 'craft',
            message: `Luyện ${pill?.name ?? event.pillId} thất bại`,
          })
        }
      }

      // Task 14 (rework P4) - Decompose cycle: ore -> refined essence.
      // R7 (AR-08): online tick and offline restore share ONE delivery
      // path (deliverDecomposeOutput) - no duplicated overflow rules.
      this.deps.decomposeSystem.tick(Date.now())

      for (const entry of this.deps.decomposeSystem.drainOutput()) {
        this.deliverDecomposeOutput(entry)
      }
    }

    // R4 (AR-19): Persistent out-of-battle buffs (e.g. Kiếp Thương debuff)
    // decrement duration by deltaSeconds via updateTime().
    // buff2 M4 -- persistent pool lifetime clock (was buffSystem.updateTime).
    this.deps.persistentBuffs.onTimePassed(deltaSeconds)

    this.deps.passiveSystem.tick(deltaSeconds)

    this.updateBattleFixedStep(deltaSeconds)
  }

  /**
   * R7 (AR-08) - single decompose delivery path shared by the online
   * tick and the offline restore settle: toast shows the DELIVERED
   * amount (minus overflow); overflow pushes a bag.overflow event;
   * delivered === 0 skips the craft toast. Extracted verbatim from the
   * old inline tick block.
   */
  deliverDecomposeOutput(entry: DecomposeOutputEntry): void {
    // Registry miss → typed fallback Material (decompose output is
    // produced by buildings; the id doubles as display name).
    const tinhHoa: Material =
      (this.deps.materialRegistry.has(entry.materialId)
        ? this.deps.materialRegistry.get(entry.materialId)
        : undefined) ?? {
        id: entry.materialId,
        name: entry.materialId,
        category: 'other',
        sourceType: 'building',
      }

    const overflow = this.deps.materialBag.add(tinhHoa, entry.amount)

    const delivered = entry.amount - overflow

    if (delivered > 0) {
      this.deps.notifications.push({
        kind: 'craft',
        message: `Phân Giải +${delivered} ${tinhHoa.name}`,
      })
    }

    if (overflow > 0) {
      this.deps.notifications.push(
        createBagOverflowEvent(tinhHoa.name, overflow),
      )
    }
  }

  /**
   * Chia deltaSeconds thành các bước cố định cho nhánh phụ thuộc
   * timer-đếm-ngược-rồi-reset (đòn đánh, spawn quái, phần thưởng) - logic
   * moved into GameManagerTurnBattleOps.updateBattleFixedStep() (C2 split).
   *
   * updateTribulation()/updateTribulationProgress() CHỦ Ý đứng NGOÀI
   * vòng lặp bước nhỏ: updateTribulation() đã tự có vòng lặp catch-up
   * riêng (while nextStrikeInSeconds <= 0) hoạt động đúng với deltaSeconds
   * lớn dạng đóng (không tích luỹ theo bước), gọi 1 lần với deltaSeconds
   * gốc là chính xác. Chia nhỏ nó thành hàng trăm bước 0.1s sẽ CỘNG DỒN
   * sai số dấu phẩy động (0.1 không biểu diễn chẵn nhị phân) vào
   * active.nextStrikeInSeconds, có thể làm lệch 1 lôi kích so với thật.
   */
  private updateBattleFixedStep(deltaSeconds: number) {
    this.deps.turnBattleOps.updateBattleFixedStep(deltaSeconds)

    // Ngoài vòng fixed-step — TribulationDirector tự có catch-up dạng
    // đóng (spec dot-pha-loi-kiep §5.6), chia nhỏ sẽ cộng dồn sai số float.
    this.deps.tribulationDirector.update(deltaSeconds)
  }
}
