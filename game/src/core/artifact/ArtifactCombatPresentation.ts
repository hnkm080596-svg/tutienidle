// Bản Mệnh Pháp Bảo — HUD combat (doc §12.2): "Icon, vòng cooldown,
// icon hướng; hành của phát kế; counter activation thứ năm hoặc stack
// khống chế trên target hiện tại." HUD CHỈ đọc runtime, không cho đổi
// hướng/nâng phẩm (đúng doc — không có action nào ở đây).
import type { Battle } from '../battle/Battle'
import type { ElementType } from '../element/ElementType'
import { getArtifactCycleSeconds } from './ArtifactSystem'

const FIFTH_ACTIVATION_INTERVAL = 5
const NGU_HANH_ROTATION_ORDER: ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']

export interface ArtifactCombatPresentationState {
  hasArtifact: boolean
  cooldownRemaining: number
  cooldownTotal: number
  nextElement?: ElementType
  /** 0 khi activation kế chính là lần thứ 5 (milestone tầng 18). */
  activationsUntilFifth: number
  /** Chỉ có ý nghĩa với hướng Khống — số hit đã tích trên mục tiêu Combat AI đang nhắm gần nhất còn trong tầm. */
  controlStacksOnPrimaryTarget?: number
}

const EMPTY_STATE: ArtifactCombatPresentationState = {
  hasArtifact: false,
  cooldownRemaining: 0,
  cooldownTotal: 0,
  activationsUntilFifth: FIFTH_ACTIVATION_INTERVAL,
}

export function buildArtifactCombatPresentation(
  battle: Battle | null,
  primaryTargetId?: string,
): ArtifactCombatPresentationState {
  const runtime = battle?.artifactRuntime

  if (!battle || !runtime) {
    return EMPTY_STATE
  }

  const rotation = NGU_HANH_ROTATION_ORDER.filter((element) => runtime.snapshot.equippedElements.includes(element))
  const nextElement = rotation.length > 0 ? rotation[runtime.elementCursor % rotation.length] : undefined

  const cooldownTotal = getArtifactCycleSeconds(runtime)
  const cooldownRemaining = Math.max(0, Math.min(cooldownTotal, runtime.activationTimer))

  const activationsUntilFifth =
    (FIFTH_ACTIVATION_INTERVAL - (runtime.activationCount % FIFTH_ACTIVATION_INTERVAL)) % FIFTH_ACTIVATION_INTERVAL

  const controlStacksOnPrimaryTarget =
    runtime.snapshot.path === 'control' && primaryTargetId
      ? runtime.perTargetControl[primaryTargetId]?.hitsInWindow
      : undefined

  return {
    hasArtifact: true,
    cooldownRemaining,
    cooldownTotal,
    nextElement,
    activationsUntilFifth,
    controlStacksOnPrimaryTarget,
  }
}
