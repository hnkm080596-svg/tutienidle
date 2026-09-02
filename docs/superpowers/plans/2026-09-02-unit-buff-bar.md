# Unit Buff Bar (icon row trên sprite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi buff/debuff visible trên player + enemy hiển thị qua icon row trong canvas Phaser — enemy dưới chân sprite, player trên cụm HUD HP — 2 hàng permanent/temporary, tooltip hover/tap, floating text tên lần đầu attach.

**Architecture:** Mở rộng pipeline status VFX hiện có (event-diff mỗi tick): `snapshotDotStatuses` bỏ filter dot-only thành `snapshotStatuses` (mọi buff visible + `polarity`/`permanent`), event payload thêm optional fields, `StatusVfxPresets` map theo buff id + shape, `CombatVfxSpawner` chuyển icon đơn → icon row 2 tầng + tooltip module riêng. Core không biết render; render không poll core — giữ nguyên contract EventBus.

**Tech Stack:** TypeScript, Vitest, Phaser 3 (Rectangle/Arc/Text/Container), existing EventBus.

**Spec:** `docs/superpowers/specs/2026-09-02-unit-buff-bar-design.md` (bản 2)

## Global Constraints

- Không đổi số liệu combat nào — chỉ event payload mở rộng + presentation.
- Event fields mới đều OPTIONAL — consumer/test cũ không được vỡ.
- Placeholder icon: buff = circle xanh `0x58e878`, debuff = đỏ `0xe5484d`, CC = diamond vàng `0xffd54f` — phân biệt loại bằng SHAPE không chỉ màu.
- 2 hàng: permanent (`duration === Infinity`) trên, temporary dưới (enemy: cả 2 dưới foot; player: cả 2 trên cụm HUD).
- Flexible rule (AGENTS.md): mọi vị trí tính từ viewport/sprite mỗi frame qua `updateStatusIconPositions()` — cấm hardcode px màn hình dev.
- WORKTREE: `E:/tutienidle/.claude/worktrees/buff-bar` (branch `worktree-buff-bar`). KHÔNG đụng `EquipmentSystem/GameManager/useTribulation/EquipmentHallPanel/theme.css/useEquipmentTooltip/EquipmentNaming/labels/BattleLootSystem/locales` (vùng worktree Claude khác).
- Verify chuẩn mỗi task: focused vitest → (cuối plan) type-check + full suite + build.

---

### Task 1: `BattleEvents.ts` — mở rộng payload status_vfx_attached

**Files:**
- Modify: `game/src/core/battle/BattleEvents.ts:169-183`

**Interfaces:**
- Produces: `StatusVfxAttachedEvent` có thêm optional `buffName?: string`, `polarity?: 'buff' | 'debuff'`, `permanent?: boolean` — Task 2 emit, Task 4/5 consume.
- Giữ nguyên: `statusInstanceId`, `targetId`, `dotType`, `stacks`, `durationSeconds`.

- [ ] **Step 1: Sửa interface** — thêm 3 optional fields sau `durationSeconds`:

```ts
export interface StatusVfxAttachedEvent {
  type: 'status_vfx_attached'

  statusInstanceId: string

  targetId: string

  dotType: string

  stacks: number

  durationSeconds: number

  /** Buff bar (2026-09-02) — tên hiển thị (tooltip/floating text). */
  buffName?: string

  /** Buff bar — màu placeholder xanh/đỏ + hình circle/diamond. */
  polarity?: 'buff' | 'debuff'

  /** Buff bar — duration Infinity (onhit_*) → hàng permanent, không timer. */
  permanent?: boolean
}
```

(Comment interface hiện tại giữ nguyên.)

- [ ] **Step 2: Type-check**

Run: `cd game && npm.cmd run type-check`
Expected: PASS (optional fields — không consumer nào vỡ).

- [ ] **Step 3: Commit**

```bash
git add game/src/core/battle/BattleEvents.ts
git commit -m "feat(battle): status_vfx_attached payload adds buffName/polarity/permanent (buff bar)"
```

---

### Task 2: `BattleSystem.ts` — snapshot mở rộng + emit đủ payload

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts` — `snapshotDotStatuses` (~1468-1498) → `snapshotStatuses`; call sites 871, 996; `emitStatusVfxDiff` (1501-1551).

**Interfaces:**
- Consumes: `BuffPool.getAll()` — entry runtime Buff có `polarity`, `duration`, `remainingTime`, `stacks`; `this.buffRegistry` (field private, line 265) có `get(id): BuffDefinition` (`name`) và `has(id): boolean`.
- Produces: private `snapshotStatuses(battle): Map<string, {targetId, dotType, stacks, remainingTime, polarity, permanent}>` — Task 3 test qua event payload (không cần public API mới).

- [ ] **Step 1: Viết failing tests** — file mới `game/src/core/battle/BattleSystem.statusVfx.test.ts`:

```ts
// Buff bar (2026-09-02) — snapshot statuses mở rộng: MỌI buff visible
// (không chỉ dot) + payload polarity/permanent/buffName. Fixtures theo
// pattern BattleSystem.castTime.test.ts; buff áp trực tiếp qua BuffSystem
// trên pool của entity trong battle đang chạy (getBattle() public :776).
import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { BuffPool } from '../buff/BuffPool'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'

import { createBaseStats } from '../stats/StatBlock'
import { HERO_LANE_INDEX } from './BattleLane'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { StatusVfxAttachedEvent, StatusVfxRemovedEvent } from './BattleEvents'

function createBuffRegistry(): BuffRegistry {
  const registry = new BuffRegistry()

  for (const definition of buffs) {
    registry.register(definition)
  }

  return registry
}

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 0,
    attackRange: 16,
    movementSpeed: 0,
  }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    timeSinceLastHitTaken: Infinity,
    currentWard: 0,
    realmIndex: 0,
    x: 0,
    row: HERO_LANE_INDEX,
    alive: true,
    ...overrides,
  }
}

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const buffRegistry = createBuffRegistry()

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    buffRegistry,
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  const attached: StatusVfxAttachedEvent[] = []
  const removed: StatusVfxRemovedEvent[] = []

  eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', (event) => attached.push(event))
  eventBus.on<StatusVfxRemovedEvent>('status_vfx_removed', (event) => removed.push(event))

  return { system, buffRegistry, attached, removed }
}

/** Pool của entity trong battle đang chạy — áp buff trực tiếp, không qua skill scheduler. */
function poolOf(system: BattleSystem, entity: CombatEntity): BuffPool {
  const battle = system.getBattle()

  return entity.id === battle.player.id
    ? battle.playerBuffs
    : (battle.enemies.find((entry) => entry.entity.id === entity.id)?.buffs ?? new BuffPool())
}

function startBattle(system: BattleSystem, player: CombatEntity, enemy: CombatEntity) {
  system.start(player, enemy)
  system.update(3) // bỏ qua countdown 3s
}

describe('BattleSystem — status_vfx: mọi buff visible (buff bar), không chỉ dot', () => {
  it('CC buff (choang) lên enemy → attached mang polarity/buffName/remainingTime', () => {
    const { system, buffRegistry, attached } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, enemy)).apply(
      buffRegistry.get('choang'),
      battlePlayer(system),
      battleEnemy(system),
      buffRegistry,
    )

    system.update(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'enemy',
      dotType: 'choang',
      stacks: 1,
      buffName: 'Choáng',
      polarity: 'debuff',
      permanent: false,
    })
    expect(attached[0].durationSeconds).toBeGreaterThan(0)
  })

  it('statModifier debuff (lam_cham) lên player → attached polarity debuff', () => {
    const { system, buffRegistry, attached } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, player)).apply(
      buffRegistry.get('lam_cham'),
      battleEnemy(system),
      battlePlayer(system),
      buffRegistry,
    )

    system.update(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'player',
      dotType: 'lam_cham',
      buffName: 'Làm Chậm',
      polarity: 'debuff',
    })
  })

  it('buff polarity buff (khai_son) → polarity "buff"', () => {
    const { system, buffRegistry, attached } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, enemy)).apply(
      buffRegistry.get('khai_son'),
      battleEnemy(system),
      battleEnemy(system),
      buffRegistry,
    )

    system.update(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({ targetId: 'enemy', dotType: 'khai_son', polarity: 'buff' })
  })

  it('permanent buff (onhit_*, duration Infinity) → permanent: true', () => {
    const { system, buffRegistry, attached } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, player)).apply(
      buffRegistry.get('onhit_khiem_phong_haste'),
      battlePlayer(system),
      battlePlayer(system),
      buffRegistry,
    )

    system.update(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({
      targetId: 'player',
      dotType: 'onhit_khiem_phong_haste',
      polarity: 'buff',
      permanent: true,
    })
  })

  it('DoT (bong) vẫn attached — regression guard hành vi cũ', () => {
    const { system, buffRegistry, attached } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, enemy)).apply(
      buffRegistry.get('bong'),
      battlePlayer(system),
      battleEnemy(system),
      buffRegistry,
    )

    system.update(0.1)

    expect(attached).toHaveLength(1)
    expect(attached[0]).toMatchObject({ targetId: 'enemy', dotType: 'bong', stacks: 1 })
  })

  it('buff hết hạn → removed event (statModifier debuff — trước đây không có event nào)', () => {
    const { system, buffRegistry, attached, removed } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', currentHp: 1000, maxHp: 1000 })

    startBattle(system, player, enemy)

    new BuffSystem(poolOf(system, player)).apply(
      buffRegistry.get('lam_cham'),
      battleEnemy(system),
      battlePlayer(system),
      buffRegistry,
    )

    system.update(0.1)
    expect(attached).toHaveLength(1)

    system.update(30) // quá duration 8s của lam_cham

    expect(removed).toHaveLength(1)
    expect(removed[0].statusInstanceId).toBe(attached[0].statusInstanceId)
  })
})

function battlePlayer(system: BattleSystem): CombatEntity {
  return system.getBattle().player
}

function battleEnemy(system: BattleSystem): CombatEntity {
  return system.getBattle().enemies[0]!.entity
}
```

Lưu ý tên assertion `buffName: 'Choáng'`/`'Làm Chậm'` — verify trong `game/src/data/buff/buffs.ts` (`choang` line ~338-350, `lam_cham` line ~369-390) trước khi chạy; nếu tên khác, dùng đúng name trong data.

- [ ] **Step 2: Chạy test xác nhận FAIL**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.statusVfx.test.ts`
Expected: FAIL — CC/lam_cham/khai_son/onhit không có attached event (filter dot-only), và payload thiếu polarity/permanent.

- [ ] **Step 3: Sửa `BattleSystem.ts`**

3a. Đổi tên + mở rộng snapshot (thay nguyên đoạn 1467-1498):

```ts
/** Snapshot trạng thái status toàn trận, khoá `targetId:buffId:sourceId`.
 *  Buff bar (2026-09-02) — MỌI buff visible (không chỉ dot): CC/statModifier/
 *  DoT đều vào snapshot; hidden loại. permanent = duration Infinity
 *  (onhit_*) — hàng icon riêng không timer. */
private snapshotStatuses(
  battle: Battle,
): Map<
  string,
  { targetId: string; dotType: string; stacks: number; remainingTime: number; polarity: BuffPolarity; permanent: boolean }
> {
  const snapshot = new Map<
    string,
    { targetId: string; dotType: string; stacks: number; remainingTime: number; polarity: BuffPolarity; permanent: boolean }
  >()

  const collect = (pool: BuffPool, targetId: string) => {
    for (const buff of pool.getAll()) {
      if (buff.hidden) {
        continue
      }

      snapshot.set(`${targetId}:${buff.id}:${buff.sourceId}`, {
        targetId,
        dotType: buff.id,
        stacks: buff.stacks,
        remainingTime: buff.remainingTime,
        polarity: buff.polarity,
        permanent: buff.duration === Infinity,
      })
    }
  }

  collect(battle.playerBuffs, battle.player.id)

  for (const battleEnemy of battle.enemies) {
    collect(battleEnemy.buffs, battleEnemy.entity.id)
  }

  return snapshot
}
```

Import thêm `import type { BuffPolarity } from '../buff/BuffTypes'`.

3b. Call site 871: `const dotStatusesBefore = this.snapshotDotStatuses(battle)` → `const statusesBefore = this.snapshotStatuses(battle)`.

3c. Call site 996: `this.emitStatusVfxDiff(battle, dotStatusesBefore)` → `this.emitStatusVfxDiff(battle, statusesBefore)`.

3d. `emitStatusVfxDiff` (1501-1551) — đổi kiểu tham số `before`/`after` theo entry mới + emit đủ payload:

```ts
private emitStatusVfxDiff(
  battle: Battle,
  before: Map<
    string,
    { targetId: string; dotType: string; stacks: number; remainingTime: number; polarity: BuffPolarity; permanent: boolean }
  >,
) {
  const after = this.snapshotStatuses(battle)

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
        buffName: this.buffRegistry.has(current.dotType) ? this.buffRegistry.get(current.dotType).name : current.dotType,
        polarity: current.polarity,
        permanent: current.permanent,
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

  // Removed loop giữ nguyên (1534-1550) — không đổi.
}
```

- [ ] **Step 4: Chạy test PASS**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.statusVfx.test.ts`
Expected: PASS 6/6.

- [ ] **Step 5: Regression sweep các test BattleSystem hiện có**

Run: `cd game && npx vitest run src/core/battle/BattleSystem.castTime.test.ts src/core/battle/BattleSystem.onTick.test.ts src/core/battle/BattleSystem.teleport.test.ts`
Expected: PASS (payload chỉ thêm optional; behavior diff không đổi).

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/BattleSystem.ts game/src/core/battle/BattleSystem.statusVfx.test.ts
git commit -m "feat(battle): status snapshot covers every visible buff + polarity/permanent/buffName payload (buff bar)"
```

---

### Task 3: `StatusVfxPresets.ts` — map buff id + shape

**Files:**
- Modify: `game/src/data/vfx/StatusVfxPresets.ts` (viết lại toàn file — hiện 12 dòng)
- Test: `game/src/data/vfx/StatusVfxPresets.test.ts` (mới)

**Interfaces:**
- Produces: `StatusVfxPreset { color: number; shape: 'circle' | 'diamond' | 'square' }`; `getStatusVfxPreset(buffId: string, polarity?: 'buff' | 'debuff'): StatusVfxPreset` — Task 4 consume. Call site cũ (spawner:117) truyền 1-arg vẫn compat.

- [ ] **Step 1: Viết failing test**

```ts
// Buff bar (2026-09-02) — preset theo buff id + shape phân loại
// (circle=buff, diamond=CC/DoT, square=stat debuff) — không convey nghĩa
// chỉ bằng màu. Placeholder polarity cuối: buff xanh, debuff đỏ.
import { describe, expect, it } from 'vitest'
import { getStatusVfxPreset, BUFF_PLACEHOLDER_COLOR, DEBUFF_PLACEHOLDER_COLOR } from './StatusVfxPresets'

describe('StatusVfxPresets — map theo buff id (buff bar)', () => {
  it('CC → diamond vàng/ice', () => {
    expect(getStatusVfxPreset('choang')).toMatchObject({ color: 0xffd54f, shape: 'diamond' })
    expect(getStatusVfxPreset('dong_bang').shape).toBe('diamond')
    expect(getStatusVfxPreset('troi_chan').shape).toBe('diamond')
  })

  it('DoT nguyên tố → diamond màu hệ', () => {
    expect(getStatusVfxPreset('bong')).toMatchObject({ color: 0xff7a45, shape: 'diamond' })
    expect(getStatusVfxPreset('trung_doc')).toMatchObject({ color: 0x58e878, shape: 'diamond' })
    expect(getStatusVfxPreset('te_cong')).toMatchObject({ color: 0x58c8ff, shape: 'diamond' })
  })

  it('statModifier debuff → square', () => {
    expect(getStatusVfxPreset('lam_cham').shape).toBe('square')
    expect(getStatusVfxPreset('suy_nhuoc').shape).toBe('square')
  })

  it('buff tạm → circle', () => {
    expect(getStatusVfxPreset('khai_son').shape).toBe('circle')
    expect(getStatusVfxPreset('thach_giap_buff').shape).toBe('circle')
  })

  it('onhit_* prefix → circle màu buff (fallback cho id chưa map)', () => {
    expect(getStatusVfxPreset('onhit_khong_co_trong_bang')).toMatchObject({
      color: BUFF_PLACEHOLDER_COLOR,
      shape: 'circle',
    })
  })

  it('id lạ + polarity → placeholder theo polarity', () => {
    expect(getStatusVfxPreset('buff_la_ma', 'buff')).toMatchObject({ color: BUFF_PLACEHOLDER_COLOR })
    expect(getStatusVfxPreset('debuff_la_ma', 'debuff')).toMatchObject({ color: DEBUFF_PLACEHOLDER_COLOR })
  })

  it('id lạ không polarity → debuff placeholder (an toàn: mặc định đỏ cảnh báo)', () => {
    expect(getStatusVfxPreset('vo_danh')).toMatchObject({ color: DEBUFF_PLACEHOLDER_COLOR })
  })
})
```

- [ ] **Step 2: Chạy FAIL**

Run: `cd game && npx vitest run src/data/vfx/StatusVfxPresets.test.ts`
Expected: FAIL — exports `BUFF_PLACEHOLDER_COLOR`/`DEBUFF_PLACEHOLDER_COLOR` chưa tồn tại, shape chưa có.

- [ ] **Step 3: Viết lại `StatusVfxPresets.ts`**

```ts
// Buff bar (2026-09-02) — preset theo buff id: color + shape phân loại
// (circle = buff, diamond = CC/DoT, square = statModifier debuff). Không
// convey nghĩa CHỈ bằng màu (UX guideline) — shape là kênh thứ hai.
// Placeholder = hình học thuần; asset thật thay sau không đụng layout.
export type StatusIconShape = 'circle' | 'diamond' | 'square'

export interface StatusVfxPreset {
  color: number
  shape: StatusIconShape
}

export const BUFF_PLACEHOLDER_COLOR = 0x58e878
export const DEBUFF_PLACEHOLDER_COLOR = 0xe5484d
const CC_COLOR = 0xffd54f

const STATUS_PRESETS: Record<string, StatusVfxPreset> = {
  choang: { color: CC_COLOR, shape: 'diamond' },
  dong_bang: { color: 0x8be9fd, shape: 'diamond' },
  troi_chan: { color: CC_COLOR, shape: 'diamond' },
  bong: { color: 0xff7a45, shape: 'diamond' },
  trung_doc: { color: 0x58e878, shape: 'diamond' },
  chay_mau: { color: 0xe5484d, shape: 'diamond' },
  te_cong: { color: 0x58c8ff, shape: 'diamond' },
  hoai_tu: { color: 0x58c8ff, shape: 'diamond' },
  dung_nham: { color: 0xff7a45, shape: 'diamond' },
  huyet_doc: { color: 0xe5484d, shape: 'diamond' },
  lam_cham: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  han_khi: { color: 0x8be9fd, shape: 'square' },
  cuong_bao: { color: 0xff7a45, shape: 'square' },
  suy_nhuoc: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  uy_ap: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  giap_ran: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  van_kiem_vu: { color: DEBUFF_PLACEHOLDER_COLOR, shape: 'square' },
  thach_hoa: { color: 0xd4a72c, shape: 'square' },
  thach_giap_buff: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  doc_the: { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' },
  ngung_lo: { color: 0x4a90d9, shape: 'circle' },
  khai_son: { color: 0xd4a72c, shape: 'circle' },
}

export function getStatusVfxPreset(buffId: string, polarity?: 'buff' | 'debuff'): StatusVfxPreset {
  if (STATUS_PRESETS[buffId]) {
    return STATUS_PRESETS[buffId]!
  }

  if (buffId.startsWith('onhit_')) {
    return { color: BUFF_PLACEHOLDER_COLOR, shape: 'circle' }
  }

  if (/burn|fire|hot/.test(buffId)) return { color: 0xff7a45, shape: 'diamond' }
  if (/poison|toxic|wood/.test(buffId)) return { color: 0x58e878, shape: 'diamond' }
  if (/bleed|huyet|blood/.test(buffId)) return { color: 0xe5484d, shape: 'diamond' }
  if (/chill|frost|water/.test(buffId)) return { color: 0x58c8ff, shape: 'diamond' }

  return { color: polarity === 'buff' ? BUFF_PLACEHOLDER_COLOR : DEBUFF_PLACEHOLDER_COLOR, shape: 'circle' }
}
```

- [ ] **Step 4: Chạy PASS**

Run: `cd game && npx vitest run src/data/vfx/StatusVfxPresets.test.ts`
Expected: PASS 7/7.

- [ ] **Step 5: Commit**

```bash
git add game/src/data/vfx/StatusVfxPresets.ts game/src/data/vfx/StatusVfxPresets.test.ts
git commit -m "feat(vfx): status presets map buff ids with shape taxonomy (buff bar)"
```

---

### Task 4: `CombatVfxSpawner` — icon row 2 tầng (enemy foot / player HUD)

**Files:**
- Modify: `game/src/game/scenes/combat/combat-vfx-spawner.ts` — `onStatusAttached/Updated/Removed` (100-151), `updateStatusIconPositions` (153-166)
- Modify: `game/src/game/scenes/combat/combatConstants.ts` — thêm constants row
- Modify: `game/src/game/scenes/CombatScene.ts:392-395` — type `statuses` Map value
- Modify: `game/src/game/scenes/CombatScene.ts:1242-1247, 1944-1949` — cleanup loops (destroy theo entry mới)
- Test: `game/src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts` (mới)

**Interfaces:**
- Consumes: Task 2 event payload (`polarity`/`permanent`/`buffName` optional), Task 3 `getStatusVfxPreset(buffId, polarity?)`.
- Produces: `StatusEntry { targetId; buffId; polarity: 'buff'|'debuff'; permanent: boolean; stacks: number; icon: Rectangle | Arc; stackLabel: Text }` — CombatScene `statuses` Map value type mới; spawner field `statusTooltip?: StatusTooltip` (khai báo ở task này, T5 gán); `scene.statuses` public field giữ nguyên tên (cleanup sites + tests dùng).

- [ ] **Step 1: Constants — thêm vào `combatConstants.ts`** (sau block PLAYER_HUD_*):

```ts
// Buff bar (2026-09-02) — icon row trên unit.
export const STATUS_ICON_SIZE = 10
export const STATUS_ICON_SPACING = 4
export const STATUS_ROW_GAP = 4
export const STATUS_MAX_PER_ROW = 8
export const STATUS_FOOT_ROW_OFFSET_Y = 8
export const STATUS_PLAYER_ROW_OFFSET_Y = 6
export const BUFF_ATTACH_COLOR = '#7bd88f'
export const DEBUFF_ATTACH_COLOR = '#ff6b6b'
```

- [ ] **Step 2: Viết failing tests** — `combat-vfx-spawner.statusRow.test.ts`, mock scene theo pattern fake của `PlayerHudLayer.test.ts` (fakeRect/fakeText thuần object, không cần Phaser thật). Các test:

1. `onStatusAttached` — event dotType 'bong' polarity 'debuff' permanent false → tạo 1 icon Rectangle angle 45, 1 stackLabel; entry vào `scene.statuses` với key `statusInstanceId`.
2. Event polarity 'buff' → icon circle (Arc), angle 0.
3. Event `permanent: true` → entry.permanent true (row slot tính riêng — test qua updateStatusIconPositions).
4. Stacks > 1 → stackLabel.text === String(stacks); stacks 1 → label rỗng/hidden.
5. `onStatusUpdated` — chỉ stackLabel.text đổi; không tạo GameObject mới (đếm add calls).
6. `onStatusRemoved` — icon + label destroy; entry khỏi map; tooltip đang mở trên entry đó → hide (spy).
7. `updateStatusIconPositions` — enemy: icon y = `rect.y + STATUS_FOOT_ROW_OFFSET_Y` (temporary row), permanent row y thấp hơn `+ STATUS_ICON_SIZE + STATUS_ROW_GAP`; x xếp hàng: `rect.x - rowWidth/2 + slot*(SIZE+SPACING) + SIZE/2`.
8. Player (targetId 'player'): temporary row y = `sub2Y - STATUS_PLAYER_ROW_OFFSET_Y - STATUS_ICON_SIZE` với sub2Y tính từ viewport theo công thức PlayerHudLayer; x từ `HUD_MARGIN` xếp hàng.
9. >8 temporary — icon thứ 8 stackLabel "N+N-8"... (counter tổng số vượt: text = `+${count - 8}`), không có icon thứ 9.

Mock scene cần: `add.rectangle(x,y,w,h,color)` → fakeRect (có `setAngle`, `setDepth`, `setPosition`, `setDisplaySize`, `setVisible`, `setFillStyle`, `destroy`, `setInteractive` → return self, `on` → registry handler), `add.circle(x,y,r,color)` → fakeArc tương tự, `add.text(...)` → fakeText (có `setText`), `statuses` Map, `spriteFor(id)`, `scale: {width, height}`, `isPerspective: true`. Spawner constructor `(scene as unknown as CombatScene)` — pattern đã dùng trong test hiện hữu của spawner (kiểm tra `ActionImpactVfx.test.ts` cách cast).

Vị trí player cần viewport: test set `scene.scale = { width: 800, height: 600 }` → sub2Y = 600 - 16 - 6 - 8 - 4 - 8 - 4 = 554; temporary row y = 554 - 6 - 10 = 538.

- [ ] **Step 3: Chạy FAIL**

Run: `cd game && npx vitest run src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts`
Expected: FAIL — spawner hiện tại chưa có row/polarity/permanent logic.

- [ ] **Step 4: Implement spawner**

4a. Import thêm: `STATUS_ICON_SIZE, STATUS_ICON_SPACING, STATUS_ROW_GAP, STATUS_MAX_PER_ROW, STATUS_FOOT_ROW_OFFSET_Y, STATUS_PLAYER_ROW_OFFSET_Y` từ `./combatConstants`; `HUD_MARGIN, HUD_HP_HEIGHT, HUD_SUB_HEIGHT, HUD_GAP` từ `./PlayerHudLayer`; `getStatusVfxPreset` đã có.

4b. `StatusEntry`:

```ts
interface StatusEntry {
  targetId: string
  buffId: string
  polarity: 'buff' | 'debuff'
  permanent: boolean
  stacks: number
  icon: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc
  stackLabel: Phaser.GameObjects.Text
}
```

Field `stacks` set lúc attach (`event.stacks ?? 1`), cập nhật trong `onStatusUpdated` (`status.stacks = event.stacks`) — tooltip (T5) đọc từ đây, không đọc từ label text. Field `statusTooltip?: StatusTooltip` khai báo ở cuối class spawner từ task này (T5 gán instance + wire interactive).

4c. `onStatusAttached(event)` — giữ dedupe `scene.statuses.has` + skip nếu `!spriteFor`; tạo icon theo preset:

```ts
const preset = getStatusVfxPreset(event.dotType, event.polarity)

const icon =
  preset.shape === 'circle'
    ? this.scene.add.circle(0, 0, STATUS_ICON_SIZE / 2, preset.color)
    : this.scene.add.rectangle(0, 0, STATUS_ICON_SIZE, STATUS_ICON_SIZE, preset.color)

if (preset.shape === 'diamond') {
  icon.setAngle(45)
}

icon.setDepth(DEPTH_OVERLAY_UI + 4)

const stackLabel = this.scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '9px', color: '#ffd54f' })
stackLabel.setOrigin(1, 0.5) // góc phải-dưới icon
stackLabel.setDepth(DEPTH_OVERLAY_UI + 5)
stackLabel.setVisible((event.stacks ?? 1) > 1)
stackLabel.setText(String(event.stacks ?? 1))

this.scene.statuses.set(event.statusInstanceId, {
  targetId: event.targetId,
  buffId: event.dotType,
  polarity: event.polarity ?? 'debuff',
  permanent: event.permanent ?? false,
  icon,
  stackLabel,
})
```

4d. `onStatusUpdated` — chỉ label:

```ts
const status = this.scene.statuses.get(event.statusInstanceId)

if (!status) return

status.stackLabel.setText(String(event.stacks))
status.stackLabel.setVisible(event.stacks > 1)
```

4e. `onStatusRemoved` — destroy + tooltip hide (tooltip Task 5 wire; ở đây gọi `this.statusTooltip?.hideFor(event.statusInstanceId)` — optional chaining, chưa có thì no-op; Task 5 sẽ thêm field `statusTooltip`):

```ts
const status = this.scene.statuses.get(event.statusInstanceId)

if (!status) return

status.icon.destroy()
status.stackLabel.destroy()
this.scene.statuses.delete(event.statusInstanceId)
this.statusTooltip?.hideFor(event.statusInstanceId)
```

4f. `updateStatusIconPositions` — nhóm theo target, tách 2 hàng, tính slot:

```ts
updateStatusIconPositions() {
  const byTarget = new Map<string, StatusEntry[]>()

  for (const status of (this.scene.statuses as Map<string, StatusEntry>).values()) {
    const list = byTarget.get(status.targetId) ?? []
    list.push(status)
    byTarget.set(status.targetId, list)
  }

  for (const [targetId, entries] of byTarget) {
    const sprite = this.scene.spriteFor(targetId)

    if (!sprite) continue

    const isPlayer = targetId === PLAYER_ID
    const temporary = entries.filter((entry) => !entry.permanent)
    const permanent = entries.filter((entry) => entry.permanent)

    // Mỗi hàng: slot 0..7; >8 → icon cuối mang counter (xử lý ở layout helper).
    this.layoutRow(temporary, isPlayer, sprite, 0)
    this.layoutRow(permanent, isPlayer, sprite, 1)
  }
}

private layoutRow(entries: StatusEntry[], isPlayer: boolean, sprite: EntitySprite, rowTier: 0 | 1) {
  if (entries.length === 0) return

  const rowWidth = Math.min(entries.length, STATUS_MAX_PER_ROW) * (STATUS_ICON_SIZE + STATUS_ICON_SPACING) - STATUS_ICON_SPACING

  let baseY: number

  if (isPlayer) {
    const height = this.scene.scale.height
    const sub2Y = height - HUD_MARGIN - HUD_HP_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT - HUD_GAP - HUD_SUB_HEIGHT
    const tempRowY = sub2Y - STATUS_PLAYER_ROW_OFFSET_Y - STATUS_ICON_SIZE

    baseY = rowTier === 0 ? tempRowY : tempRowY - STATUS_ROW_GAP - STATUS_ICON_SIZE
  } else {
    const footY = this.scene.isPerspective ? sprite.rect.y : sprite.rect.y + sprite.rect.displayHeight / 2
    const tempRowY = footY + STATUS_FOOT_ROW_OFFSET_Y

    baseY = rowTier === 0 ? tempRowY : tempRowY + STATUS_ROW_GAP + STATUS_ICON_SIZE
  }

  const startX = isPlayer ? HUD_MARGIN : sprite.rect.x - rowWidth / 2 + STATUS_ICON_SIZE / 2

  entries.forEach((entry, index) => {
    const capped = Math.min(index, STATUS_MAX_PER_ROW - 1)
    const overflow = entries.length - STATUS_MAX_PER_ROW

    const x = startX + capped * (STATUS_ICON_SIZE + STATUS_ICON_SPACING)
    const y = baseY

    entry.icon.setPosition(x, y)
    entry.stackLabel.setPosition(x + STATUS_ICON_SIZE / 2 + 1, y + STATUS_ICON_SIZE / 2 - 1)

    if (overflow > 0 && index === STATUS_MAX_PER_ROW - 1) {
      entry.stackLabel.setText(`+${overflow}`)
      entry.stackLabel.setVisible(true)
      entry.stackLabel.setOrigin(0, 0.5) // counter bên phải icon cuối
    }

    if (overflow > 0 && index > STATUS_MAX_PER_ROW - 1) {
      entry.icon.setVisible(false)
      entry.stackLabel.setVisible(false)
    }
  })
}
```

Player icon row x dùng `HUD_MARGIN` trực tiếp (căn mép trái cùng cụm HUD). NOTE overflow logic: icon >8 vẫn được positioned (tính 8 slot), icon thứ 9+ ẩn.

4g. `CombatScene.ts` — type `statuses` (392-395) đổi thành:

```ts
statuses = new Map<
  string,
  {
    targetId: string
    buffId: string
    polarity: 'buff' | 'debuff'
    permanent: boolean
    icon: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc
    stackLabel: Phaser.GameObjects.Text
  }
>()
```

Cleanup loops (1242-1247, 1944-1949): `status.icon.destroy(); status.stackLabel.destroy()` (đổi `label` → `stackLabel`). Thêm `this.statusTooltip?.hide()` trong cả 2 (Task 5 field — optional chaining an toàn ngay).

- [ ] **Step 5: Chạy PASS**

Run: `cd game && npx vitest run src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts`
Expected: PASS 9/9.

- [ ] **Step 6: Regression — scene suite**

Run: `cd game && npx vitest run src/game/scenes`
Expected: PASS — mọi test CombatScene hiện có (HUD wiring, player motion, dot presentation...).

- [ ] **Step 7: Commit**

```bash
git add game/src/game/scenes/combat/combat-vfx-spawner.ts game/src/game/scenes/combat/combatConstants.ts game/src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts game/src/game/scenes/CombatScene.ts
git commit -m "feat(combat): buff icon rows on units — enemy foot / player HUD, permanent+temporary tiers (buff bar)"
```

---

### Task 5: Tooltip + floating text lần đầu attach

**Files:**
- Create: `game/src/game/scenes/combat/combat-status-tooltip.ts`
- Modify: `game/src/game/scenes/combat/combat-vfx-spawner.ts` — field `statusTooltip`, wire `setInteractive` trong `onStatusAttached`
- Modify: `game/src/game/scenes/CombatScene.ts` — `onStatusAttached` (2019) floating text lần đầu; field `floatedStatusKeys`; cleanup 2 sites
- Modify: `game/src/game/scenes/combat/combatConstants.ts` — (đã có BUFF_ATTACH_COLOR/DEBUFF_ATTACH_COLOR từ Task 4)
- Test: `game/src/game/scenes/combat/combat-status-tooltip.test.ts` (mới), mở rộng `combat-vfx-spawner.statusRow.test.ts` (tooltip wire), CombatScene floating text test (mới hoặc mở rộng `hudWiring.test.ts`)

**Interfaces:**
- Consumes: `StatusEntry` (Task 4, gồm `stacks`), event `buffName`/`durationSeconds` (Task 2), constants `BUFF_ATTACH_COLOR`/`DEBUFF_ATTACH_COLOR` (Task 4).
- Produces: `StatusTooltip` class — `show(screenX, screenY, statusInstanceId, data: StatusTooltipData), hide(), hideFor(statusInstanceId), isOpenFor(statusInstanceId): boolean`; `StatusTooltipData { name; polarity; stacks; remainingTime?; permanent? }`; spawner private `showTooltipFor(event)` dùng chung cho pointerover/pointerdown.

- [ ] **Step 1: Failing tests `combat-status-tooltip.test.ts`** (fake scene pattern như Task 4):

1. `show(...)` với polarity 'debuff', stacks 3, remainingTime 7.4 → tạo Container-like group: bg Graphics + 2 Text; Text1.text chứa name; Text2.text = `×3 · 7s`; Text1 màu đỏ.
2. polarity 'buff' → Text1 màu xanh.
3. `permanent: true` → Text2.text = '×3 · vĩnh viễn' (không giây).
4. `show` lần 2 → group cũ destroy trước khi tạo mới (đếm destroy calls) — một tooltip active duy nhất.
5. `hide()` → group destroy; `hide()` khi không mở → no-op không crash.
6. `hideFor(id)` — tooltip đang neo entry id đó → hide; id khác → giữ nguyên.
7. Clamp: show tại x gần mép phải viewport 800 → group x + width ≤ 800 (x bị kéo lại).

- [ ] **Step 2: Chạy FAIL** — module chưa tồn tại.

Run: `cd game && npx vitest run src/game/scenes/combat/combat-status-tooltip.test.ts`

- [ ] **Step 3: Implement `combat-status-tooltip.ts`**

```ts
// Buff bar (2026-09-02) — tooltip canvas cho status icon: hover/tap icon
// → panel 2 dòng (tên — màu polarity; stacks · thời gian). Một active
// duy nhất; hideFor gắn theo statusInstanceId để onStatusRemoved đóng đúng.
// Flexible rule: vị trí clamp trong viewport mỗi lần show.
import Phaser from 'phaser'
import { DEPTH_OVERLAY_UI } from '@/game/support/BattleLayers'
import { BUFF_PLACEHOLDER_COLOR, DEBUFF_PLACEHOLDER_COLOR } from '@/data/vfx/StatusVfxPresets'

const TOOLTIP_BG = 0x241b1b
const TOOLTIP_STROKE = 0xf4f4f0
const POLARITY_HEX = { buff: '#7bd88f', debuff: '#ff6b6b' } as const
const TOOLTIP_WIDTH = 120
const TOOLTIP_HEIGHT = 30

export interface StatusTooltipData {
  name: string
  polarity: 'buff' | 'debuff'
  stacks: number
  remainingTime?: number
  permanent?: boolean
}

interface TooltipParts {
  container: Phaser.GameObjects.Container
  anchorStatusId: string
}

export class StatusTooltip {
  private active?: TooltipParts

  constructor(private readonly scene: Phaser.Scene) {}

  show(screenX: number, screenY: number, statusInstanceId: string, data: StatusTooltipData) {
    this.hide()

    const clampedX = Math.min(screenX, this.scene.scale.width - TOOLTIP_WIDTH - 8)
    const clampedY = Math.max(screenY, TOOLTIP_HEIGHT + 8)

    const bg = this.scene.add.graphics()
    bg.fillStyle(TOOLTIP_BG, 0.92)
    bg.fillRoundedRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT, 4)
    bg.lineStyle(1, TOOLTIP_STROKE, 0.4)
    bg.strokeRoundedRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT, 4)

    const polarityHex = data.polarity === 'buff' ? POLARITY_HEX.buff : POLARITY_HEX.debuff

    const nameText = this.scene.add.text(6, 4, data.name, {
      fontSize: '11px',
      fontStyle: 'bold',
      color: polarityHex,
    })

    const detailText = this.scene.add.text(6, 16, this.formatDetail(data), {
      fontSize: '10px',
      color: '#f4f4f0',
    })

    const container = this.scene.add.container(clampedX, clampedY, [bg, nameText, detailText])
    container.setDepth(DEPTH_OVERLAY_UI + 8)

    this.active = { container, anchorStatusId: statusInstanceId }
  }

  hide() {
    this.active?.container.destroy()
    this.active = undefined
  }

  hideFor(statusInstanceId: string) {
    if (this.active?.anchorStatusId === statusInstanceId) {
      this.hide()
    }
  }

  private formatDetail(data: StatusTooltipData): string {
    if (data.permanent) {
      return `×${data.stacks} · vĩnh viễn`
    }

    return `×${data.stacks} · ${Math.max(0, Math.ceil(data.remainingTime ?? 0))}s`
  }
}
```

(Neu `add.graphics` mock phức tạp — fake scene có thể stub graphics bằng object có fillStyle/lineStyle/fillRoundedRect/strokeRoundedRect no-op + destroy; không cần Phaser thật.)

- [ ] **Step 4: Chạy PASS** tooltip tests.

- [ ] **Step 5: Wire spawner + floating text**

5a. Spawner: gán field `this.statusTooltip ??= new StatusTooltip(this.scene)` + extract private `showTooltipFor(event)` dùng chung; trong `onStatusAttached` sau khi tạo icon:

```ts
this.statusTooltip ??= new StatusTooltip(this.scene)

icon.setInteractive({ useHandCursor: true })
icon.on('pointerover', () => this.showTooltipFor(event.statusInstanceId))
icon.on('pointerout', () => this.statusTooltip?.hide())
icon.on('pointerdown', () => {
  if (this.statusTooltip?.isOpenFor(event.statusInstanceId)) {
    this.statusTooltip.hide()

    return
  }

  this.showTooltipFor(event.statusInstanceId)
})
```

```ts
private showTooltipFor(statusInstanceId: string) {
  const entry = this.scene.statuses.get(statusInstanceId)

  if (!entry) return

  const anchor = this.scene.spriteFor(entry.targetId)

  if (!anchor) return

  const event = this.attachedEvents.get(statusInstanceId) // hoặc lưu buffName vào StatusEntry — QUYẾT ĐỊNH: thêm `buffName?: string` vào StatusEntry (T4), tooltip đọc từ entry — KHÔNG giữ map event riêng.

  this.statusTooltip!.show(entry.icon.x, entry.icon.y - STATUS_ICON_SIZE, statusInstanceId, {
    name: entry.buffName ?? entry.buffId,
    polarity: entry.polarity,
    stacks: entry.stacks,
    remainingTime: entry.remainingTime,
    permanent: entry.permanent,
  })
}
```

**Điều chỉnh cuối cùng (ràng buộc các task):** `StatusEntry` (T4) cần ĐỦ 2 field nữa để tooltip đọc không cần event: `buffName?: string` (set từ `event.buffName` lúc attach) và `remainingTime?: number` (set từ `event.durationSeconds` lúc attach; `onStatusUpdated` cập nhật `entry.remainingTime = event.durationSeconds`). T4 Step 4c/4d bổ sung 2 dòng set field này; test T4 thêm assertion entry mang đủ buffName/remainingTime.

**Limitation đã chấp nhận (ghi vào code comment):** `entry.remainingTime` là snapshot lúc attach/update cuối — buff decay tự nhiên giữa 2 update không reflect vào tooltip (event `updated` chỉ phát khi stacks đổi hoặc remainingTime tăng theo điều kiện diff hiện có 1521-1523). Tooltip mở đang hiện giây hơi cũ ≤ vài giây; đóng mở lại sẽ cập nhật nếu có update. KHÔNG nới điều kiện updated phát mỗi tick (event volume 10× không đáng cho số hiển thị tooltip).

5b. CombatScene floating text — `onStatusAttached` (2019-2021):

```ts
private floatedStatusKeys = new Set<string>()

private onStatusAttached(event: StatusVfxAttachedEvent) {
  const firstOnTarget = !this.floatedStatusKeys.has(`${event.targetId}:${event.dotType}`)

  this.floatedStatusKeys.add(`${event.targetId}:${event.dotType}`)

  if (firstOnTarget && event.buffName) {
    const sprite = this.spriteFor(event.targetId)

    if (sprite) {
      this.showFloatingText(sprite, event.buffName, event.polarity === 'buff' ? BUFF_ATTACH_COLOR : DEBUFF_ATTACH_COLOR)
    }
  }

  this.vfxSpawner.onStatusAttached(event)
}
```

Cleanup 2 sites (đã chạm Task 4): thêm `this.floatedStatusKeys.clear()` cạnh `this.statuses.clear()`.

5c. Floating text test — `CombatScene.floatingStatusText.test.ts` (mới, mock scene pattern hudWiring): 
1. attach đầu tiên với buffName 'Bỏng' + sprite tồn tại → `showFloatingText` gọi với text đúng (spy qua delegate spawner channel — hoặc test qua `add.text` calls).
2. attach thứ 2 cùng `targetId:dotType` (sourceId khác) → KHÔNG floating lần 2.
3. attach không có `buffName` → không floating (compat event cũ).

- [ ] **Step 6: Chạy toàn bộ test Task 5 PASS + regression scenes**

Run: `cd game && npx vitest run src/game/scenes/combat/combat-status-tooltip.test.ts src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts src/game/scenes/CombatScene.floatingStatusText.test.ts && npx vitest run src/game/scenes`
Expected: PASS tất cả.

- [ ] **Step 7: Commit**

```bash
git add game/src/game/scenes/combat/combat-status-tooltip.ts game/src/game/scenes/combat/combat-status-tooltip.test.ts game/src/game/scenes/combat/combat-vfx-spawner.ts game/src/game/scenes/combat/combat-vfx-spawner.statusRow.test.ts game/src/game/scenes/CombatScene.ts game/src/game/scenes/CombatScene.floatingStatusText.test.ts
git commit -m "feat(combat): status tooltip (hover/tap) + floating buff name on first attach (buff bar)"
```

---

### Task 6: Final verification

**Files:** none — verification only.

- [ ] **Step 1:** `cd game && npm.cmd run type-check` — PASS.
- [ ] **Step 2:** `cd game && npx vitest run` — full PASS (không regress; baseline 1993+).
- [ ] **Step 3:** `cd game && npm.cmd run build` — PASS.
- [ ] **Step 4:** Manual smoke (dev server, ghi kết quả vào task report): trận có skill Hỏa/Thủy — thấy icon đỏ diamond "bong" dưới chân enemy, floating "Bỏng!" lần đầu, stack label tăng, tooltip hover hiện tên + giây, buff hết hạn icon biến mất; onhit permanent hàng riêng player trên HUD; resize viewport icon row bám đúng.
- [ ] **Step 5:** QA quick mode (`tutienidle-adversarial-qa`) — bắt buộc theo AGENTS.md sau khi implement feature.
- [ ] **Step 6:** Update ROADMAP nếu cần (ghi chú buff bar xong) — inline, không commit riêng.

Không commit riêng cho Task 6 (verification only). Nếu Step 2/3 fail → sửa rồi chạy lại từ Step 1.

---

## Execution Notes

- Worktree: `E:/tutienidle/.claude/worktrees/buff-bar` — mọi commit trên branch `worktree-buff-bar`. KHÔNG merge master giữa chừng; user quyết merge.
- Task 1→5 tuần tự (Task 2 phụ thuộc Task 1 types; Task 4 phụ thuộc 2+3; Task 5 phụ thuộc 4). Task 6 chốt.
- Tên buff assertion trong Task 2 Step 1 — verify `buffs.ts` `name` fields ('Choáng', 'Làm Chậm',...) trước khi chạy test lần đầu; nếu data khác → sửa test theo data (test khóa contract, không khóa copy cụ thể nếu data đổi).
- Mock scene pattern: tham khảo fakeRect/fakeText của `PlayerHudLayer.test.ts` + cách cast `scene as unknown as CombatScene` trong test spawner hiện hữu nếu có — KHÔNG instantiate Phaser thật trong unit test.
- `hidden` defensive check giữ trong snapshot dù 0 buff hiện dùng — cost 0, đúng semantics.
- Sau merge: buff bar không persist — không đụng save/cloud.
