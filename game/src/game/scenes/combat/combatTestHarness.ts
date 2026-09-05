// combatTestHarness (Remediation Task 8, 2026-09-05) — typed adapter thay
// thế `as any` lặp lại trong 12+ CombatScene test file.CombatScene private
// fields không test được qua public type — một assertion boundary CỤC BỘ
// tại đây expose Record-typed scene view; test consume interface này thay
// vì cast any từng file. KHÔNG dùng trong production code.
import { CombatScene } from '../CombatScene'

/**
 * Typed view của CombatScene cho test: private/readonly fields của scene
 * là chi tiết test phải stub/ghi đè bằng PARTIAL stubs (graphics/tweens/
 * time… chỉ cần vài method) — mapping sâu keyof CombatScene ép stubs đủ
 * full interface là vô ích. Boundary DUY NHẤT: scene coi như record
 * dynamic; MỌI `as any` cũ ở 12+ file test nay đi qua một chỗ này, được
 * ghi chép + audit được. Production KHÔNG dùng type này.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombatSceneTestView = Record<string, any>

/**
 * Tạo scene instance cho test. `new CombatScene()` (constructor thật) khi
 * cần class fields có identity thật (lifecycle tests); `Object.create`
 * (không chạy constructor) khi test method thuần.
 */
export function createTestScene(
  mode: 'construct' | 'bare' = 'construct',
): CombatSceneTestView {
  const scene =
    mode === 'construct'
      ? new CombatScene()
      : Object.create(CombatScene.prototype)

  return scene as CombatSceneTestView
}

/**
 * Gán nhiều stub fields một lần — ghi qua boundary duy nhất này thay vì
 *cast từng field.
 */
export function patchScene(
  scene: CombatSceneTestView,
  patches: Record<string, unknown>,
): CombatSceneTestView {
  Object.assign(scene, patches)

  return scene
}
