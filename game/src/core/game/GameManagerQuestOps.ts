import { validMaterialReceipt, type MaterialReceipt, type MaterialGrant } from '../material/MaterialReceipt'
import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'
import type { Quest } from '../quest/Quest'
import type { QuestProgress } from '../quest/QuestProgress'
import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { NotificationQueue } from './NotificationQueue'
import type { Enemy } from '../enemy/Enemy'
import type { PlayerData } from '../player/Player'
import { capturePlayerCheckpoint, restorePlayerCheckpoint } from '../player/PlayerSnapshot'
import {
  betaQuestSurfaceFor,
  type BetaQuestSurfaceDeps,
  type BetaQuestSurfaceModel,
} from '../betaScopeQuestDomain'
import { getCurrentRealm, getRealmIndex } from '../realm/realmSystem'
import type { Stage } from '../stage/Stage'

export interface GameManagerQuestOpsDeps {
  questSystem: QuestSystem
  questRegistry: QuestRegistry
  questManager: QuestManager
  rewardSystem: RewardSystem
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag
  notifications: NotificationQueue
  // sec.4B - enemy display names for kill-quest target labels
  // (catalogOps owns the template lookup; injected to keep the ops
  // deps explicit, same convention as HiddenBeastSystem's binding).
  getEnemyTemplate: (enemyId: string) => Enemy | undefined
  getStage?: (stageId: string) => Stage | undefined
  // GameManager giu activePlayer nhu field mutable (setActivePlayer) - doc
  // LIVE qua closure thay vi snapshot tai constructor time, giong
  // GameManagerBuildingOps.
  getActivePlayer: () => PlayerData | undefined
  // RewardReceiver dung chung cho moi noi cap Reward truc tiep cho player
  // (battle victory, claim quest...) - logic that (insight/Linh Thach) nam
  // ngoai pham vi QUEST section nen GameManager cung cap qua closure thay
  // vi tach theo.
  buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
}

/**
 * Tach khoi GameManager (2026-09-03, task 4 - GameManager split) - toan bo
 * thao tac Quest (collect-quest hook, query active/canClaim, claim). Cung
 * pattern DI voi GameManagerAlchemyOps/GameManagerBuildingOps: constructor
 * nhan dependency tuong minh qua object `deps`, KHONG tu import nguoc
 * GameManager.
 */
export class GameManagerQuestOps {
  constructor(private readonly deps: GameManagerQuestOpsDeps) {
    deps.materialBag.setDeliveryConsumer((grant) => this.deliverMaterialGrant(grant))
  }

  /**
   * Consume an inventory-owned delivery exactly once for the current active
   * quest set. Hydration, starter balances and refunds never issue receipts.
   * Restore may replay the durable outbox using these same receipt identities.
   */
  private deliverMaterialGrant(grant: MaterialGrant): void {
    this.deps.questManager.consumeMaterialGrant(grant, () => {
      if (grant.receipt) this.deps.questSystem.onMaterialCollected(
        this.deps.questRegistry, this.deps.questManager, grant.materialId, grant.receipt.payload.delivered,
      )
    })
  }

  notifyMaterialGained(materialId: string, amount: number, receipt: MaterialReceipt | null): void {
    if (!receipt) { if (amount > 0) throw new Error('Material acquisition requires an inventory receipt'); return }
    if (!validMaterialReceipt(receipt) || receipt.payload.materialId !== materialId || receipt.payload.delivered !== amount) throw new Error('Malformed or mismatched material receipt')
    if (this.deps.materialBag.isRetiredReceipt(receipt)) return
    if (!this.deps.materialBag.ownsReceipt(receipt)) throw new Error('Foreign or mismatched material receipt')
    // credit/withAcquisition already attempted delivery. Pending retry belongs
    // to the next command/tick, never a duplicate callback inside this batch.
  }

  getActiveQuests(): { quest: Quest; progress: QuestProgress }[] {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return []
    }

    return this.deps.questSystem.getActiveQuests(this.deps.questRegistry, this.deps.questManager, player)
  }

  /**
   * BETA FE-CONTRACT (work-order sec.4B) - canonical Quest surface
   * read-model. The frontend renders these rows and never imports
   * ReleasePolicy, never re-derives reward admission, target labels,
   * the collect shortfall, or claimability. Pure query - questOps
   * owns the material/enemy/bag reads; nothing here writes state.
   */
  getBetaQuestSurfaceModels(): BetaQuestSurfaceModel[] {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return []
    }

    const surfaceDeps: BetaQuestSurfaceDeps = {
      materialRegistry: this.deps.materialRegistry,
      materialBag: this.deps.materialBag,
      pillRegistry: this.deps.pillRegistry,
      pillBag: this.deps.pillBag,
      enemyName: (enemyId) => this.deps.getEnemyTemplate(enemyId)?.name,
      stageName: (stageId) => this.deps.getStage?.(stageId)?.name,
      realmName: (realmId) =>
        getRealmIndex(realmId) >= 0 ? getCurrentRealm(realmId).name : undefined,
      // 2026-10-05 reward scaling previews the claim-time band
      // resolution (unlock-chain walk) - same registry claim() sees.
      questRegistry: this.deps.questRegistry,
    }

    const models = this.getActiveQuests()
      .map(({ quest, progress }) =>
        betaQuestSurfaceFor(quest, progress, player, surfaceDeps),
      )

    // Mainline (Chinh Tuyen) ordering: chain members emit first, in
    // unlocksAfterQuestId walk order - the chain is linear so the walk
    // depth IS the display order. Members the walk cannot reach append
    // in registry order (registration is the authored sequence).
    const chainQuests = this.deps.questRegistry
      .getAll()
      .filter((quest) => quest.chainId === 'mainline')
    const byId = new Map(models.map((model) => [model.id, model]))
    const chainOrder = this.mainlineChainOrder(chainQuests)

    const ordered: BetaQuestSurfaceModel[] = []
    for (const quest of chainOrder) {
      const model = byId.get(quest.id)
      if (model) {
        ordered.push(model)
        byId.delete(quest.id)
      }
    }
    for (const model of byId.values()) {
      ordered.push(model)
    }

    // Locked preview (design sec.4): the first chain member that is
    // neither active nor completed renders as a read-only dimmed row at
    // the chain tail, with the gates that still hold it. Pure read -
    // never admits, never mutates.
    const completed = new Set(this.deps.questManager.getCompletedOnceIds())
    const preview = chainOrder.find(
      (quest) => !models.some((model) => model.id === quest.id) && !completed.has(quest.id),
    )
    if (preview) {
      ordered.splice(
        chainOrder.filter((quest) => models.some((model) => model.id === quest.id)).length,
        0,
        this.lockedPreviewFor(preview, player, surfaceDeps, completed),
      )
    }

    return ordered
  }

  private mainlineChainOrder(chainQuests: Quest[]): Quest[] {
    const reached = new Set<Quest>()
    let cursor = chainQuests.find((quest) => quest.unlocksAfterQuestId === undefined)
    while (cursor) {
      reached.add(cursor)
      const next = chainQuests.find((quest) => quest.unlocksAfterQuestId === cursor!.id)
      cursor = next && !reached.has(next) ? next : undefined
    }
    return [...reached, ...chainQuests.filter((quest) => !reached.has(quest))]
  }

  private lockedPreviewFor(
    quest: Quest,
    player: PlayerData,
    deps: BetaQuestSurfaceDeps,
    completed: ReadonlySet<string>,
  ): BetaQuestSurfaceModel {
    const model = betaQuestSurfaceFor(
      quest,
      { questId: quest.id, progress: 0, claimed: false },
      player,
      deps,
    )
    const lockedPreview: BetaQuestSurfaceModel['lockedPreview'] = {}

    if (
      quest.unlocksAfterQuestId !== undefined &&
      !completed.has(quest.unlocksAfterQuestId) &&
      this.deps.questRegistry.has(quest.unlocksAfterQuestId)
    ) {
      lockedPreview.afterQuestName = this.deps.questRegistry.get(quest.unlocksAfterQuestId).name
    }

    if (
      quest.requiredRealmId !== undefined &&
      getRealmIndex(player.realmId) < getRealmIndex(quest.requiredRealmId)
    ) {
      lockedPreview.requiredRealmId = quest.requiredRealmId
    }

    model.lockedPreview = lockedPreview
    return model
  }

  canClaimQuest(questId: string): boolean {
    return this.deps.questSystem.canClaim(
      this.deps.questRegistry,
      this.deps.questManager,
      {
        materialRegistry: this.deps.materialRegistry,
        materialBag: this.deps.materialBag,
        pillRegistry: this.deps.pillRegistry,
        pillBag: this.deps.pillBag,
      },
      questId,
    )
  }

  claimQuest(questId: string): boolean {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return false
    }

    const receiver = this.deps.buildPlayerRewardReceiver(player)

    return this.deps.questSystem.claim(
      this.deps.questRegistry,
      this.deps.questManager,
      this.deps.rewardSystem,
      receiver,
      {
        materialRegistry: this.deps.materialRegistry,
        materialBag: this.deps.materialBag,
        pillRegistry: this.deps.pillRegistry,
        pillBag: this.deps.pillBag,
        // 9.8 - quest reward material tran tui -> push toast qua sink.
        notifications: this.deps.notifications,
        // M-F-BODY-PERFECTION - reward materials granted inside claim()
        // route back through THIS funnel (quest + discovery), instead of
        // the legacy direct onMaterialCollected call.
        onMaterialGained: (materialId, delivered, receipt) =>
          this.notifyMaterialGained(materialId, delivered, receipt),
        playerRealmId: player.realmId,
        onClaimed: (quest) => {
          this.deps.notifications.push({ kind: 'loot', message: `Hoàn thành: ${quest.name}` })
          // A successor is admitted only after its prerequisite is committed.
          this.deps.questSystem.reconcileActiveQuests(
            this.deps.questRegistry,
            this.deps.questManager,
            player,
          )
        },
        withAtomicClaim: (settle) => {
          // A claim is synchronous. Checkpoint each actual state owner before
          // invoking any grant, debit, drop or material-discovery callback.
          // Preserve live player object and nested reactive identities on failure.
          const savedPlayer = capturePlayerCheckpoint(player)
          const savedMaterials = this.deps.materialBag.getAll()
          const savedMaterialReceipts = this.deps.materialBag.receiptSnapshot()
          const savedPills = this.deps.pillBag.getAll()
          const savedQuests = structuredClone(this.deps.questManager.getState())
          const savedNotifications = this.deps.notifications.checkpoint()
          try {
            return settle()
          } catch (error) {
            this.deps.materialBag.restoreStacks(savedMaterials)
            this.deps.materialBag.replaceReceiptCheckpoint(savedMaterialReceipts)
            this.deps.pillBag.restoreStacks(savedPills)
            this.deps.questManager.restore(savedQuests)
            this.deps.notifications.restoreCheckpoint(savedNotifications)
            restorePlayerCheckpoint(savedPlayer)
            throw error
          }
        },
      },
      questId,
    )

  }
}
