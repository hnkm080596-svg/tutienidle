# Hệ thống Drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay "chọn bảng thưởng nào" bằng một resolver duy nhất nhận stage + họ quái + tập modifier, để boss+tinh_anh cộng dồn được và 33/43 con quái thôi cho Tinh Anh phần thưởng y hệt quái thường.

**Architecture:** Ba lớp thuần trong `core/drop/` (hợp đồng bảng, từ vựng modifier, resolver) + hai file dữ liệu trong `data/drop/`. `BattleLootSystem` giữ nguyên vai trò cấp phát (bag, toast, particle, quest hook) nhưng mất quyền quyết định *cái gì* rơi. Ba nhịp: dựng song song (không ai gọi) → chuyển đường dẫn → dọn dữ liệu cũ.

**Tech Stack:** TypeScript, Vitest, Vite. Không thêm dependency.

**Spec:** `game/docs/superpowers/specs/2026-09-12-drop-system-design.md` — đọc **cả spec** trước khi làm task đầu tiên. Plan này lập luận từ spec; mọi mã số `E1`-`E12`, `R1`-`R9`, `OQ1` đều trỏ về đó.

## Global Constraints

- **Nhánh `feat/drop-system`.** Commit theo từng task. **KHÔNG merge, KHÔNG push** — chỉ user mới cho phép (P7).
- **Comment trong code: tiếng Anh, ASCII thuần** (P15). Prose tiếng Việt chỉ nằm trong docs.
- **Mọi `any` được đưa vào phải báo cáo** (P8).
- **Mọi guard phải được nhìn thấy ĐỎ trước khi chấp nhận.** Task nào có bước "probe" thì bước đó là bắt buộc, không phải tuỳ chọn.
- Chạy test: `cd game && npx vitest run <path>`. Full suite: `npx vitest run`. Type-check: `npm run type-check`.
- Playwright (nếu cần): `DEV_PORT=5182 npx playwright test` — **luôn** đặt cổng, e2e sẽ bám vào server của worktree khác nếu quên.
- Không dùng `git stash` trần — stash stack dùng chung giữa các worktree.
- **Từ vựng:** định danh trong code là `ItemQuality`/`quality`. Chữ "chất" chỉ nằm trong docs và chuỗi hiển thị.
- Hai luật, chép nguyên văn từ spec §2.3:
  - `currency = 1 + sum(currencyBonus)`, chặn ở `MAX_CURRENCY_MULTIPLIER = 4`
  - `qualityBonusSteps = clamp(len(modifiers) - 1, 0, MAX_QUALITY_BONUS_STEPS)` với `MAX_QUALITY_BONUS_STEPS = 2`

---

## File Structure

**Nhịp 1 — tạo mới, chưa ai gọi**

| File | Trách nhiệm |
|---|---|
| `game/src/core/drop/DropModifier.ts` | Từ vựng modifier + hai luật (tiền, nâng chất) + hằng số trần |
| `game/src/core/drop/DropTable.ts` | Hợp đồng bảng: `DropEntry`, `DropTable`, `StageDropTable`, `FamilyDropTable`, `SignatureDrop` |
| `game/src/core/drop/resolveDrops.ts` | Resolver thuần — nhận context + hai bảng + signature, trả `DropResult`. RNG tiêm được |
| `game/src/core/drop/DropContext.ts` | Adapter: enemy + stage + kênh → `DropContext`. **Nơi duy nhất** biết modifier nào là tag, modifier nào là thuộc tính stage (luật idle E10) |
| `game/src/data/drop/StageDropTables.ts` | Bảng theo (cảnh giới, dải tầng) + hàm tra |
| `game/src/data/drop/FamilyDropTables.ts` | Bảng theo họ quái + hàm tra |

**Nhịp 2 — sửa**

| File | Sửa gì |
|---|---|
| `game/src/core/equipment/EquipmentSystem.ts:307` | `createInstance` nhận thêm `qualityBonusSteps?: number` |
| `game/src/core/game/BattleLootSystem.ts` | Tiêu thụ `DropResult`; xoá 3 kênh hardcode |
| `game/src/core/game/GameManagerTurnBattleOps.ts:1564` | Kênh idle truyền `channel: 'idle'` |
| `game/src/core/enemy/Enemy.ts` | Thêm `signatureDrops`, `family` giữ nguyên |

**Nhịp 3 — xoá**

| File | Xoá gì |
|---|---|
| `game/src/data/enemy/Enemies.ts` | 10 khối `eliteRewards`, 20 khối `bossRewards` |
| `game/src/core/enemy/Enemy.ts` | Field `eliteRewards`, `bossRewards` trên `Enemy` và `EnemyDefinition` |
| `game/src/core/reward/StageDropRules.ts` | Cả file (3 hằng số + 1 hàm đã hết consumer) |

---

# NHỊP 1 — dựng song song

> Cuối nhịp 1, cây code chạy **hệt như trước**. Không consumer nào gọi mã mới. Rủi ro bằng không.

---

### Task 1: Từ vựng modifier và hai luật

**Files:**
- Create: `game/src/core/drop/DropModifier.ts`
- Test: `game/src/core/drop/DropModifier.test.ts`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces:
  - `interface DropModifier { id: string; extraRolls: number; currencyBonus: number }`
  - `const MAX_CURRENCY_MULTIPLIER = 4`
  - `const MAX_QUALITY_BONUS_STEPS = 2`
  - `const BOSS_MODIFIER: DropModifier`, `const TINH_ANH_MODIFIER: DropModifier`
  - `function currencyMultiplierFor(modifiers: readonly DropModifier[]): number`
  - `function qualityBonusStepsFor(modifiers: readonly DropModifier[]): number`
  - `function totalExtraRolls(modifiers: readonly DropModifier[]): number`

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/drop/DropModifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  BOSS_MODIFIER,
  MAX_CURRENCY_MULTIPLIER,
  MAX_QUALITY_BONUS_STEPS,
  TINH_ANH_MODIFIER,
  currencyMultiplierFor,
  qualityBonusStepsFor,
  totalExtraRolls,
  type DropModifier,
} from './DropModifier'

describe('DropModifier - currency law (spec E4)', () => {
  it('is 1 with no modifiers', () => {
    expect(currencyMultiplierFor([])).toBe(1)
  })

  it('adds contributions instead of multiplying them', () => {
    expect(currencyMultiplierFor([TINH_ANH_MODIFIER])).toBe(2)
    expect(currencyMultiplierFor([BOSS_MODIFIER])).toBe(3)
    expect(currencyMultiplierFor([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(4)
  })

  it('caps at MAX_CURRENCY_MULTIPLIER even when a third modifier lands', () => {
    const future: DropModifier = { id: 'future', extraRolls: 0, currencyBonus: 5 }

    expect(currencyMultiplierFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, future])).toBe(
      MAX_CURRENCY_MULTIPLIER,
    )
  })
})

describe('DropModifier - quality law (spec E5/E6/E9)', () => {
  it('gives nothing to a plain kill or to a single modifier', () => {
    expect(qualityBonusStepsFor([])).toBe(0)
    expect(qualityBonusStepsFor([TINH_ANH_MODIFIER])).toBe(0)
    expect(qualityBonusStepsFor([BOSS_MODIFIER])).toBe(0)
  })

  it('gives exactly one step to boss plus tinh anh', () => {
    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(1)
  })

  it('generalises to more modifiers and caps', () => {
    const a: DropModifier = { id: 'a', extraRolls: 0, currencyBonus: 0 }
    const b: DropModifier = { id: 'b', extraRolls: 0, currencyBonus: 0 }

    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, a])).toBe(2)
    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, a, b])).toBe(
      MAX_QUALITY_BONUS_STEPS,
    )
  })
})

describe('DropModifier - rolls', () => {
  it('adds extra rolls', () => {
    expect(totalExtraRolls([])).toBe(0)
    expect(totalExtraRolls([TINH_ANH_MODIFIER])).toBe(1)
    expect(totalExtraRolls([BOSS_MODIFIER])).toBe(3)
    expect(totalExtraRolls([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(4)
  })
})
```

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/drop/DropModifier.test.ts`
Expected: FAIL — `Failed to resolve import "./DropModifier"`.

- [ ] **Step 3: Viết cài đặt tối thiểu**

Tạo `game/src/core/drop/DropModifier.ts`:

```ts
/**
 * The drop system's own modifier vocabulary (spec E8).
 *
 * Deliberately NOT the same thing as EnemyTag: the Perfect Clear spec's D4
 * makes boss a stage property rather than a tag, so a drop system that read
 * the tag list directly would have to fall back to an isBoss branch for the
 * one case that matters most. Here 'boss' is simply another modifier id.
 * DropContext.ts is the only place that knows which modifiers came from tags.
 */
export interface DropModifier {
  id: string

  /** Added to the number of times the merged pool is drawn from. */
  extraRolls: number

  /** Added into the currency multiplier - see currencyMultiplierFor. */
  currencyBonus: number
}

/**
 * Currency adds and caps; it does NOT multiply.
 *
 * The Perfect Clear spec stacks STATS multiplicatively (boss + tinh anh =
 * HP x7 x2.5). Reusing that shape for rewards produced x12.5, which the
 * user rejected. Adding with a named ceiling means a third modifier can
 * only reach the ceiling sooner, never blow past it.
 */
export const MAX_CURRENCY_MULTIPLIER = 4

/** Quality steps a single kill can add on top of the normal roll. */
export const MAX_QUALITY_BONUS_STEPS = 2

export const TINH_ANH_MODIFIER: DropModifier = {
  id: 'tinh_anh',
  extraRolls: 1,
  currencyBonus: 1,
}

export const BOSS_MODIFIER: DropModifier = {
  id: 'boss',
  extraRolls: 3,
  currencyBonus: 2,
}

export function totalExtraRolls(modifiers: readonly DropModifier[]): number {
  return modifiers.reduce((sum, modifier) => sum + modifier.extraRolls, 0)
}

export function currencyMultiplierFor(modifiers: readonly DropModifier[]): number {
  const raw = 1 + modifiers.reduce((sum, modifier) => sum + modifier.currencyBonus, 0)

  return Math.min(MAX_CURRENCY_MULTIPLIER, raw)
}

/**
 * Derived from HOW MANY modifiers the kill carries, not from a per-modifier
 * field (spec E9).
 *
 * A per-modifier qualityBonus cannot express the rule that was actually
 * agreed: give tinh_anh +1 and a lone elite is upgraded; give boss +1 and a
 * lone boss is upgraded. Both break "only when the kill carries both".
 * Counting reproduces the rule exactly and still generalises.
 */
export function qualityBonusStepsFor(modifiers: readonly DropModifier[]): number {
  return Math.min(MAX_QUALITY_BONUS_STEPS, Math.max(0, modifiers.length - 1))
}
```

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/drop/DropModifier.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Probe — chứng minh test bắt được lỗi**

Đổi tạm `currencyMultiplierFor` sang nhân dồn:

```ts
const raw = modifiers.reduce((product, modifier) => product * (1 + modifier.currencyBonus), 1)
```

Run lại. Expected: FAIL ở `adds contributions instead of multiplying them` — `expected 4, received 6` (`2 × 3`). **Hoàn tác thay đổi này** rồi chạy lại cho xanh.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/drop/DropModifier.ts game/src/core/drop/DropModifier.test.ts
git commit -m "feat(drop): modifier vocabulary - currency adds and caps, quality counts"
```

---

### Task 2: Hợp đồng bảng drop

**Files:**
- Create: `game/src/core/drop/DropTable.ts`
- Test: `game/src/core/drop/DropTable.test.ts`

**Interfaces:**
- Consumes: không có
- Produces:
  - `type DropKind = 'material' | 'equipment' | 'equipment_any' | 'pill' | 'technique'`
  - `interface AmountRange { min: number; max: number }`
  - `interface DropEntry { kind: DropKind; itemId?: string; amount?: AmountRange }`
  - `interface GuaranteedDropEntry extends DropEntry { chance: number }`
  - `interface WeightedDropEntry extends DropEntry { weight: number }`
  - `interface DropTable { guaranteed: GuaranteedDropEntry[]; pool: WeightedDropEntry[] }`
  - `interface StageDropTable extends DropTable { realmId: string; floors: AmountRange; currency: { spiritStone: AmountRange; techniqueInsight: AmountRange } }`
  - `interface FamilyDropTable extends DropTable { familyId: string }`
  - `interface SignatureDrop extends DropEntry { chance: number; requiresModifier?: string }`
  - `function assertDropEntryIsAddressable(entry: DropEntry): void`

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/drop/DropTable.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assertDropEntryIsAddressable, type DropEntry } from './DropTable'

describe('DropTable - addressability', () => {
  it('accepts an entry that names its item', () => {
    const entry: DropEntry = { kind: 'material', itemId: 'tinh_hoa_pham_the' }

    expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
  })

  it('accepts equipment_any without an itemId', () => {
    const entry: DropEntry = { kind: 'equipment_any' }

    expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
  })

  it('rejects any other kind without an itemId', () => {
    const entry: DropEntry = { kind: 'material' }

    expect(() => assertDropEntryIsAddressable(entry)).toThrow(/itemId/)
  })
})
```

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/drop/DropTable.test.ts`
Expected: FAIL — không resolve được `./DropTable`.

- [ ] **Step 3: Viết cài đặt**

Tạo `game/src/core/drop/DropTable.ts`:

```ts
/**
 * Shared loot tables (spec E1/E2).
 *
 * Two layers compose per kill: the STAGE table decides which items exist at
 * this point of progression, the FAMILY table decides the themed parts. An
 * enemy references both by realm/floor and by family instead of carrying its
 * own hand-copied reward tables.
 *
 * A table has two compartments on purpose. 'guaranteed' keeps the current
 * behaviour of an independent chance per line, which is what a deliberately
 * certain drop needs. 'pool' is weighted and drawn N times, which is the only
 * shape in which "this modifier adds a roll" means anything.
 */
export type DropKind = 'material' | 'equipment' | 'equipment_any' | 'pill' | 'technique'

export interface AmountRange {
  min: number
  max: number
}

export interface DropEntry {
  kind: DropKind

  /** Required for every kind except 'equipment_any', which draws from the registry. */
  itemId?: string

  /** Materials and pills only; equipment always yields exactly one instance. */
  amount?: AmountRange
}

export interface GuaranteedDropEntry extends DropEntry {
  /** 1 = always. */
  chance: number
}

export interface WeightedDropEntry extends DropEntry {
  weight: number
}

export interface DropTable {
  guaranteed: GuaranteedDropEntry[]
  pool: WeightedDropEntry[]
}

export interface StageDropTable extends DropTable {
  realmId: string

  /** Inclusive floor band. One band per realm today; splitting needs no code change. */
  floors: AmountRange

  currency: {
    spiritStone: AmountRange
    techniqueInsight: AmountRange
  }
}

export interface FamilyDropTable extends DropTable {
  familyId: string
}

/**
 * Hand-placed drops that must NOT dissolve into the shared pool (spec E7) -
 * great_dao_seed at 0.01% is the gate onto Foundation Establishment, and a
 * weighted line would either misplace it or lose it. Signature drops take no
 * extra rolls and receive no quality bonus.
 */
export interface SignatureDrop extends DropEntry {
  chance: number

  /** Only rolled when the kill carries this modifier id. */
  requiresModifier?: string
}

export function assertDropEntryIsAddressable(entry: DropEntry): void {
  if (entry.kind !== 'equipment_any' && !entry.itemId) {
    throw new Error(`Drop entry of kind ${entry.kind} is missing itemId`)
  }
}
```

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/drop/DropTable.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/drop/DropTable.ts game/src/core/drop/DropTable.test.ts
git commit -m "feat(drop): table contract - two compartments, two layers"
```

---

### Task 3: Resolver

**Files:**
- Create: `game/src/core/drop/resolveDrops.ts`
- Test: `game/src/core/drop/resolveDrops.test.ts`

**Interfaces:**
- Consumes: `DropModifier`, `totalExtraRolls`, `currencyMultiplierFor`, `qualityBonusStepsFor` (Task 1); `StageDropTable`, `FamilyDropTable`, `SignatureDrop`, `AmountRange` (Task 2)
- Produces:
  - `interface ResolvedDropItem { kind: DropKind; itemId?: string; amount: number }`
  - `interface DropResult { items: ResolvedDropItem[]; spiritStone: number; techniqueInsight: number; currencyMultiplier: number; qualityBonusSteps: number }`
  - `interface ResolveDropsInput { modifiers: readonly DropModifier[]; channel: 'active' | 'idle'; stageTable?: StageDropTable; familyTable?: FamilyDropTable; signatureDrops?: readonly SignatureDrop[]; rng?: () => number }`
  - `function resolveDrops(input: ResolveDropsInput): DropResult`

**Ghi chú thiết kế bắt buộc đọc trước khi code:**

- RNG **phải tiêm được** (`rng?: () => number`, mặc định `Math.random`). Không có nó thì test kinh tế ở Task 10 (N = 100.000) không lặp lại được.
- `techniqueInsight` trả về **đã nhân** hệ số. `skillInsight` **không** nằm trong `DropResult` — nó được `BattleLootSystem` suy ra từ `techniqueInsight` đã nhân qua `getSkillInsightReward()` đang có, nên E12 (hệ số áp lên cả ba hồ) thoả mãn mà không cần đường thứ hai.
- Luật idle cho signature (E11): `channel === 'idle'` thì **chỉ** nhận dòng có `chance === 1`.

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/drop/resolveDrops.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER } from './DropModifier'
import type { FamilyDropTable, SignatureDrop, StageDropTable } from './DropTable'
import { resolveDrops } from './resolveDrops'

/** Deterministic stand-in for Math.random: replays the given numbers, then 0. */
function scriptedRng(values: number[]): () => number {
  let index = 0

  return () => (index < values.length ? values[index++]! : 0)
}

const STAGE: StageDropTable = {
  realmId: 'mortal',
  floors: { min: 1, max: 10 },
  currency: { spiritStone: { min: 2, max: 2 }, techniqueInsight: { min: 10, max: 10 } },
  guaranteed: [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 1 }, chance: 0.7 }],
  pool: [{ kind: 'material', itemId: 'stage_item', weight: 50 }],
}

const FAMILY: FamilyDropTable = {
  familyId: 'boar',
  guaranteed: [],
  pool: [{ kind: 'material', itemId: 'family_item', weight: 50 }],
}

describe('resolveDrops - roll count', () => {
  it('draws the pool once for a plain kill', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1]),
    })

    // rng[0] = 0.99 fails the 0.7 guaranteed line; rng[1] picks one pool draw.
    expect(result.items).toHaveLength(1)
  })

  it('draws once per extra roll', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1, 0.1, 0.1, 0.1, 0.1]),
    })

    expect(result.items).toHaveLength(5)
  })
})

describe('resolveDrops - both layers feed one bag', () => {
  it('can draw from the family table as well as the stage table', () => {
    const high = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.99]),
    })

    expect(high.items[0]!.itemId).toBe('family_item')

    const low = resolveDrops({
      modifiers: [],
      channel: 'active',
      stageTable: STAGE,
      familyTable: FAMILY,
      rng: scriptedRng([0.99, 0.1]),
    })

    expect(low.items[0]!.itemId).toBe('stage_item')
  })
})

describe('resolveDrops - currency', () => {
  it('multiplies the stage currency by the modifier law', () => {
    const plain = resolveDrops({ modifiers: [], channel: 'active', stageTable: STAGE, rng: scriptedRng([0.99]) })

    expect(plain.spiritStone).toBe(2)
    expect(plain.techniqueInsight).toBe(10)

    const both = resolveDrops({
      modifiers: [BOSS_MODIFIER, TINH_ANH_MODIFIER],
      channel: 'active',
      stageTable: STAGE,
      rng: scriptedRng([0.99]),
    })

    expect(both.spiritStone).toBe(8)
    expect(both.techniqueInsight).toBe(40)
    expect(both.currencyMultiplier).toBe(4)
    expect(both.qualityBonusSteps).toBe(1)
  })
})

describe('resolveDrops - signature drops (spec E7/E11)', () => {
  const SIGNATURE: SignatureDrop[] = [
    { kind: 'material', itemId: 'great_dao_seed', chance: 1, requiresModifier: 'boss' },
    { kind: 'technique', itemId: 'van_kiem_quyet', chance: 1 },
  ]

  it('skips a line whose required modifier is absent', () => {
    const result = resolveDrops({
      modifiers: [],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['van_kiem_quyet'])
  })

  it('grants it when the modifier is present', () => {
    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'active',
      signatureDrops: SIGNATURE,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['great_dao_seed', 'van_kiem_quyet'])
  })

  it('on idle keeps only the certain lines', () => {
    const idleSignature: SignatureDrop[] = [
      { kind: 'material', itemId: 'great_dao_seed', chance: 0.5, requiresModifier: 'boss' },
      { kind: 'technique', itemId: 'van_kiem_quyet', chance: 1, requiresModifier: 'boss' },
    ]

    const result = resolveDrops({
      modifiers: [BOSS_MODIFIER],
      channel: 'idle',
      signatureDrops: idleSignature,
      rng: scriptedRng([0, 0]),
    })

    expect(result.items.map((item) => item.itemId)).toEqual(['van_kiem_quyet'])
  })
})
```

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/drop/resolveDrops.test.ts`
Expected: FAIL — không resolve được `./resolveDrops`.

- [ ] **Step 3: Viết cài đặt**

Tạo `game/src/core/drop/resolveDrops.ts`:

```ts
import {
  currencyMultiplierFor,
  qualityBonusStepsFor,
  totalExtraRolls,
  type DropModifier,
} from './DropModifier'
import type {
  AmountRange,
  DropEntry,
  DropKind,
  FamilyDropTable,
  SignatureDrop,
  StageDropTable,
  WeightedDropEntry,
} from './DropTable'

export type DropChannel = 'active' | 'idle'

export interface ResolvedDropItem {
  kind: DropKind
  itemId?: string
  amount: number
}

export interface DropResult {
  items: ResolvedDropItem[]

  /** Already multiplied by currencyMultiplier. */
  spiritStone: number

  /**
   * Already multiplied. skillInsight is NOT returned here: BattleLootSystem
   * derives it from this value through the existing getSkillInsightReward(),
   * so it inherits the same multiplier without a second code path (spec E12).
   */
  techniqueInsight: number

  currencyMultiplier: number

  /** Steps to add on top of EquipmentSystem's own quality roll (spec E5). */
  qualityBonusSteps: number
}

export interface ResolveDropsInput {
  modifiers: readonly DropModifier[]
  channel: DropChannel
  stageTable?: StageDropTable
  familyTable?: FamilyDropTable
  signatureDrops?: readonly SignatureDrop[]

  /** Injectable so the economy guards can run a repeatable large sample. */
  rng?: () => number
}

function rollAmount(range: AmountRange | undefined, rng: () => number): number {
  if (!range) {
    return 1
  }

  const low = Math.ceil(range.min)
  const high = Math.floor(range.max)

  return Math.floor(rng() * (high - low + 1)) + low
}

function toResolved(entry: DropEntry, rng: () => number): ResolvedDropItem {
  return {
    kind: entry.kind,
    itemId: entry.itemId,
    amount: entry.kind === 'equipment' || entry.kind === 'equipment_any' ? 1 : rollAmount(entry.amount, rng),
  }
}

function drawFromPool(pool: readonly WeightedDropEntry[], rng: () => number): WeightedDropEntry | undefined {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)

  if (total <= 0) {
    return undefined
  }

  let roll = rng() * total

  for (const entry of pool) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry
    }
  }

  return pool[pool.length - 1]
}

export function resolveDrops(input: ResolveDropsInput): DropResult {
  const rng = input.rng ?? Math.random
  const modifiers = input.modifiers
  const modifierIds = new Set(modifiers.map((modifier) => modifier.id))

  const items: ResolvedDropItem[] = []

  // 1. Guaranteed compartments of both layers - independent chance per line,
  //    unaffected by extra rolls.
  const guaranteed = [
    ...(input.stageTable?.guaranteed ?? []),
    ...(input.familyTable?.guaranteed ?? []),
  ]

  for (const entry of guaranteed) {
    if (rng() < entry.chance) {
      items.push(toResolved(entry, rng))
    }
  }

  // 2. Signature drops. Idle keeps only the certain lines (spec E11) so the
  //    Foundation Establishment gate stays a reward for playing, not for
  //    leaving the game running.
  for (const entry of input.signatureDrops ?? []) {
    if (entry.requiresModifier && !modifierIds.has(entry.requiresModifier)) {
      continue
    }

    if (input.channel === 'idle' && entry.chance < 1) {
      continue
    }

    if (rng() < entry.chance) {
      items.push(toResolved(entry, rng))
    }
  }

  // 3. One merged weighted bag, drawn 1 + extraRolls times.
  const pool = [...(input.stageTable?.pool ?? []), ...(input.familyTable?.pool ?? [])]
  const rolls = 1 + totalExtraRolls(modifiers)

  for (let index = 0; index < rolls; index++) {
    const drawn = drawFromPool(pool, rng)

    if (drawn) {
      items.push(toResolved(drawn, rng))
    }
  }

  const currencyMultiplier = currencyMultiplierFor(modifiers)
  const currency = input.stageTable?.currency

  return {
    items,

    spiritStone: currency ? Math.floor(rollAmount(currency.spiritStone, rng) * currencyMultiplier) : 0,

    techniqueInsight: currency
      ? Math.floor(rollAmount(currency.techniqueInsight, rng) * currencyMultiplier)
      : 0,

    currencyMultiplier,

    qualityBonusSteps: qualityBonusStepsFor(modifiers),
  }
}
```

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/drop/resolveDrops.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 5: Probe — luật idle phải thật sự lọc**

Xoá tạm nhánh `if (input.channel === 'idle' && entry.chance < 1) continue`.
Run lại. Expected: FAIL ở `on idle keeps only the certain lines` — nhận cả `great_dao_seed`. **Hoàn tác** rồi chạy lại cho xanh.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/drop/resolveDrops.ts game/src/core/drop/resolveDrops.test.ts
git commit -m "feat(drop): one resolver for what a kill drops"
```

---

### Task 4: Adapter context — nơi duy nhất biết idle khác active

**Files:**
- Create: `game/src/core/drop/DropContext.ts`
- Test: `game/src/core/drop/DropContext.test.ts`

**Interfaces:**
- Consumes: `DropModifier`, `BOSS_MODIFIER`, `TINH_ANH_MODIFIER` (Task 1); `DropChannel` (Task 3)
- Produces:
  - `interface DropContextInput { channel: DropChannel; isBoss: boolean; isElite: boolean; tagIds?: readonly string[] }`
  - `function modifiersFor(input: DropContextInput): DropModifier[]`

**Vì sao task này tồn tại:** spec §3.2. Luật idle (E10) sống ở **một** chỗ, không rải ra chỗ gọi, nên không có đường nào "quên pass cờ" được.

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/drop/DropContext.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { modifiersFor } from './DropContext'

const ids = (input: Parameters<typeof modifiersFor>[0]) => modifiersFor(input).map((m) => m.id)

describe('DropContext - active channel', () => {
  it('carries nothing for a plain enemy', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: false })).toEqual([])
  })

  it('carries tinh_anh for an elite', () => {
    expect(ids({ channel: 'active', isBoss: false, isElite: true })).toEqual(['tinh_anh'])
  })

  it('carries boss for a boss', () => {
    expect(ids({ channel: 'active', isBoss: true, isElite: false })).toEqual(['boss'])
  })

  it('carries both when they stack', () => {
    expect(ids({ channel: 'active', isBoss: true, isElite: true }).sort()).toEqual(['boss', 'tinh_anh'])
  })
})

describe('DropContext - idle channel (spec E10)', () => {
  it('drops the tag but KEEPS the stage property', () => {
    expect(ids({ channel: 'idle', isBoss: true, isElite: true })).toEqual(['boss'])
  })

  it('carries nothing on a normal idle floor', () => {
    expect(ids({ channel: 'idle', isBoss: false, isElite: true })).toEqual([])
  })

  it('still carries boss on idle floor 10', () => {
    expect(ids({ channel: 'idle', isBoss: true, isElite: false })).toEqual(['boss'])
  })
})
```

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/drop/DropContext.test.ts`
Expected: FAIL — không resolve được `./DropContext`.

- [ ] **Step 3: Viết cài đặt**

Tạo `game/src/core/drop/DropContext.ts`:

```ts
import { BOSS_MODIFIER, TINH_ANH_MODIFIER, type DropModifier } from './DropModifier'
import type { DropChannel } from './resolveDrops'

export interface DropContextInput {
  channel: DropChannel

  /** Stage property (Perfect Clear spec D4) - survives on idle. */
  isBoss: boolean

  /** Tag - stripped on idle. */
  isElite: boolean

  /**
   * Future EnemyTag ids. EnemyTag.ts does not exist yet; when it lands, map
   * its ids here and nothing else in the drop system changes.
   */
  tagIds?: readonly string[]
}

const TAG_MODIFIERS: Record<string, DropModifier> = {
  tinh_anh: TINH_ANH_MODIFIER,
}

/**
 * The ONE place that knows which modifiers are tags and which are stage
 * properties (spec E10 / §3.2).
 *
 * Idle strips tags and keeps stage properties, so idle floor 10 still fights
 * a boss and still earns boss rolls, but can never reach the stacked ceiling
 * and can never earn the quality bonus. Keeping that rule here rather than at
 * the call sites means no future caller can forget to pass a flag.
 */
export function modifiersFor(input: DropContextInput): DropModifier[] {
  const modifiers: DropModifier[] = []

  if (input.isBoss) {
    modifiers.push(BOSS_MODIFIER)
  }

  if (input.channel === 'idle') {
    return modifiers
  }

  if (input.isElite) {
    modifiers.push(TINH_ANH_MODIFIER)
  }

  for (const tagId of input.tagIds ?? []) {
    const modifier = TAG_MODIFIERS[tagId]

    if (modifier && !modifiers.some((existing) => existing.id === modifier.id)) {
      modifiers.push(modifier)
    }
  }

  return modifiers
}
```

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/drop/DropContext.test.ts`
Expected: PASS, 7 test.

- [ ] **Step 5: Probe — idle phải thật sự giữ boss**

Đổi tạm `if (input.channel === 'idle') return modifiers` thành `if (input.channel === 'idle') return []`.
Run lại. Expected: FAIL ở cả `drops the tag but KEEPS the stage property` lẫn `still carries boss on idle floor 10`. **Hoàn tác** rồi chạy lại cho xanh.

Probe này quan trọng: bản 1 của spec ghi sai đúng chỗ này (idle modifier rỗng), mâu thuẫn D4 spec PC.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/drop/DropContext.ts game/src/core/drop/DropContext.test.ts
git commit -m "feat(drop): idle keeps the stage property, drops the tag"
```

---

### Task 5: Dữ liệu bảng — trích từ dữ liệu đang có, không bịa

**Files:**
- Create: `game/src/data/drop/StageDropTables.ts`
- Create: `game/src/data/drop/FamilyDropTables.ts`
- Test: `game/src/data/drop/DropTables.test.ts`

**Interfaces:**
- Consumes: `StageDropTable`, `FamilyDropTable` (Task 2)
- Produces:
  - `const STAGE_DROP_TABLES: StageDropTable[]`
  - `function stageDropTableFor(realmId: string | undefined, floor: number | undefined): StageDropTable | undefined`
  - `const FAMILY_DROP_TABLES: FamilyDropTable[]`
  - `function familyDropTableFor(familyId: string | undefined): FamilyDropTable | undefined`

**Quyết định phạm vi — đọc trước khi code:** khởi điểm là **một dải tầng phủ toàn bộ mỗi cảnh giới** (`floors: { min: 1, max: 10 }`), tức 3 bảng stage cho 3 cảnh giới đang có dữ liệu (`mortal` 20 quái, `qi_refining` 23, `foundation_establishment` 1). Chia nhỏ dải về sau **không cần sửa code**, chỉ thêm entry. Đừng chia nhỏ ngay — mỗi dải thêm vào là một ô nữa phải cân bằng ở Task 10.

- [ ] **Step 1: Trích dữ liệu hiện có (script dùng một lần, KHÔNG commit)**

Tạo `<scratchpad>/extract-drops.mjs` — in ra itemId nào đang rơi ở cảnh giới nào và họ nào, để bảng được **tổng hợp từ dữ liệu thật** thay vì bịa:

```js
import { readFileSync } from 'node:fs'

const src = readFileSync('game/src/data/enemy/Enemies.ts', 'utf8')
const blocks = src.split('defineEnemy({').slice(1)

const byRealm = new Map()
const byFamily = new Map()

for (const block of blocks) {
  const realm = /realmId:\s*'([^']+)'/.exec(block)?.[1]
  const family = /family:\s*'([^']+)'/.exec(block)?.[1]

  for (const match of block.matchAll(/kind:\s*'(\w+)',\s*itemId:\s*'([^']+)'(?:,\s*amount:\s*(\d+))?,\s*chance:\s*([\d.]+)/g)) {
    const [, kind, itemId, amount, chance] = match
    const row = `${kind} ${itemId} x${amount ?? 1} @${chance}`

    if (realm) (byRealm.get(realm) ?? byRealm.set(realm, new Set()).get(realm)).add(row)
    if (family) (byFamily.get(family) ?? byFamily.set(family, new Set()).get(family)).add(row)
  }
}

for (const [realm, rows] of byRealm) {
  console.log(`\n=== REALM ${realm} ===`)
  for (const row of [...rows].sort()) console.log('  ' + row)
}

for (const [family, rows] of byFamily) {
  console.log(`\n=== FAMILY ${family} ===`)
  for (const row of [...rows].sort()) console.log('  ' + row)
}
```

Run: `node <scratchpad>/extract-drops.mjs` từ thư mục gốc repo. Giữ output để dùng ở Step 2.

- [ ] **Step 2: Viết test đỏ**

Tạo `game/src/data/drop/DropTables.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ENEMIES } from '../enemy/Enemies'
import { assertDropEntryIsAddressable } from '../../core/drop/DropTable'
import { FAMILY_DROP_TABLES, familyDropTableFor } from './FamilyDropTables'
import { STAGE_DROP_TABLES, stageDropTableFor } from './StageDropTables'

describe('drop tables - coverage', () => {
  it('has a stage table for every realm that has enemies', () => {
    const realms = new Set(ENEMIES.map((enemy) => enemy.realmId))

    for (const realmId of realms) {
      expect(stageDropTableFor(realmId, 1), `no stage table for realm ${realmId}`).toBeDefined()
    }
  })

  it('has a family table for every family that has enemies', () => {
    const families = new Set(ENEMIES.map((enemy) => enemy.family).filter(Boolean) as string[])

    for (const familyId of families) {
      expect(familyDropTableFor(familyId), `no family table for ${familyId}`).toBeDefined()
    }
  })

  it('returns nothing for an unknown realm or family', () => {
    expect(stageDropTableFor('no_such_realm', 1)).toBeUndefined()
    expect(familyDropTableFor('no_such_family')).toBeUndefined()
    expect(familyDropTableFor(undefined)).toBeUndefined()
  })
})

describe('drop tables - shape', () => {
  it('every entry names an item unless it is equipment_any', () => {
    for (const table of [...STAGE_DROP_TABLES, ...FAMILY_DROP_TABLES]) {
      for (const entry of [...table.guaranteed, ...table.pool]) {
        expect(() => assertDropEntryIsAddressable(entry)).not.toThrow()
      }
    }
  })

  it('every pool entry carries positive weight', () => {
    for (const table of [...STAGE_DROP_TABLES, ...FAMILY_DROP_TABLES]) {
      for (const entry of table.pool) {
        expect(entry.weight, `${entry.itemId ?? entry.kind} has no weight`).toBeGreaterThan(0)
      }
    }
  })

  it('every stage table can pay currency', () => {
    for (const table of STAGE_DROP_TABLES) {
      expect(table.currency.spiritStone.min).toBeGreaterThan(0)
      expect(table.currency.techniqueInsight.min).toBeGreaterThan(0)
      expect(table.currency.spiritStone.max).toBeGreaterThanOrEqual(table.currency.spiritStone.min)
      expect(table.currency.techniqueInsight.max).toBeGreaterThanOrEqual(
        table.currency.techniqueInsight.min,
      )
    }
  })
})
```

- [ ] **Step 3: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/data/drop/DropTables.test.ts`
Expected: FAIL — không resolve được hai module dữ liệu.

- [ ] **Step 4: Viết `StageDropTables.ts`**

Dùng output Step 1 để điền `pool`/`guaranteed`. Khung bắt buộc, các dòng item lấy từ output:

```ts
import type { StageDropTable } from '../../core/drop/DropTable'

/**
 * Stage layer (spec E2): decides WHICH items exist at this point of
 * progression. It deliberately does NOT decide equipment quality - that stays
 * EquipmentSystem.rollItemQuality()'s job (spec E5).
 *
 * One band per realm to start with. Splitting a band later is a data change,
 * not a code change - but every new band is another cell the economy guard
 * has to balance, so do not split without a reason.
 *
 * Currency ranges replace the three hand-copied reward tables that used to
 * live on each enemy. Numbers are a shipping starting point, tuned by
 * playtest, not a balance conclusion.
 */
export const STAGE_DROP_TABLES: StageDropTable[] = [
  {
    realmId: 'mortal',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 1, max: 2 }, techniqueInsight: { min: 5, max: 8 } },
    guaranteed: [
      // Was rollMortalEssenceAmount(isBoss) hardcoded in BattleLootSystem;
      // the boss branch is gone - a boss simply draws more often.
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 3 }, chance: 0.7 },
    ],
    pool: [
      // FILL from the Step 1 printout for realm 'mortal'.
      { kind: 'equipment_any', weight: 20 },
    ],
  },

  {
    realmId: 'qi_refining',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 8, max: 12 }, techniqueInsight: { min: 35, max: 45 } },
    guaranteed: [],
    pool: [
      // FILL from the Step 1 printout for realm 'qi_refining'.
      { kind: 'equipment_any', weight: 20 },
    ],
  },

  {
    realmId: 'foundation_establishment',
    floors: { min: 1, max: 10 },
    currency: { spiritStone: { min: 25, max: 35 }, techniqueInsight: { min: 90, max: 120 } },
    guaranteed: [],
    pool: [
      // Doan Bao Thach used to be gated by an explicit realm check in
      // grantArtifactStoneDrop. The gate is now simply which tables list it:
      // it appears here and in no lower band, so the check has nothing left
      // to ask (spec 2.5).
      { kind: 'material', itemId: 'doan_bao_thach', amount: { min: 1, max: 3 }, weight: 25 },
      { kind: 'equipment_any', weight: 20 },
    ],
  },
]

export function stageDropTableFor(
  realmId: string | undefined,
  floor: number | undefined,
): StageDropTable | undefined {
  if (!realmId) {
    return undefined
  }

  const effectiveFloor = floor ?? 1

  return STAGE_DROP_TABLES.find(
    (table) =>
      table.realmId === realmId &&
      effectiveFloor >= table.floors.min &&
      effectiveFloor <= table.floors.max,
  )
}
```

**Kiểm tra bắt buộc:** `doan_bao_thach` phải là giá trị thật của `DOAN_BAO_THACH_MATERIAL_ID` trong `core/artifact/ArtifactProgression.ts`. Mở file đó xác nhận chuỗi, đừng đoán.

- [ ] **Step 5: Viết `FamilyDropTables.ts`**

21 họ từ output Step 1. Khung:

```ts
import type { FamilyDropTable } from '../../core/drop/DropTable'

/**
 * Family layer (spec E2): decides the THEMED part of a kill - the fang, the
 * hide, the beast core. Shared by every enemy of that family, so a family's
 * loot no longer depends on whether someone remembered to hand-copy a table
 * onto that particular enemy. That omission is exactly why 33 of 43 enemies
 * dropped nothing extra as elites.
 */
export const FAMILY_DROP_TABLES: FamilyDropTable[] = [
  // FILL one entry per family from the Step 1 printout. Example shape:
  // { familyId: 'boar', guaranteed: [], pool: [{ kind: 'material', itemId: '<real id>', amount: { min: 1, max: 2 }, weight: 40 }] },
]

export function familyDropTableFor(familyId: string | undefined): FamilyDropTable | undefined {
  if (!familyId) {
    return undefined
  }

  return FAMILY_DROP_TABLES.find((table) => table.familyId === familyId)
}
```

**Ràng buộc:** mọi `itemId` phải đã tồn tại trong registry tương ứng. **Không phát minh material mới** — spec §7 để việc đó ngoài phạm vi. Họ nào chưa có material riêng trong dữ liệu cũ thì cho `pool: []` và ghi comment một dòng nói rõ họ đó chưa có đồ đặc trưng.

- [ ] **Step 6: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/data/drop/DropTables.test.ts`
Expected: PASS, 6 test.

- [ ] **Step 7: Commit**

```bash
git add game/src/data/drop/ game/src/data/drop/DropTables.test.ts
git commit -m "feat(drop): stage and family tables, extracted from the data that already existed"
```

---

### Task 6: Đo characterization + trả lời OQ1

**Files:**
- Create: `game/src/core/drop/dropCharacterization.test.ts`
- Modify: `game/docs/superpowers/specs/2026-09-12-drop-system-design.md` (ghi kết quả OQ1)

**Interfaces:**
- Consumes: mọi thứ từ Task 1-5
- Produces: con số cho Task 10 và câu trả lời cho OQ1. Không sinh production code.

**Đây là task quan trọng nhất của Nhịp 1.** Nó là lưới an toàn cho Nhịp 2 và là nơi OQ1 được **đo**, không phải đoán.

- [ ] **Step 1: Viết harness đo**

Tạo `game/src/core/drop/dropCharacterization.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER, type DropModifier } from './DropModifier'
import { resolveDrops } from './resolveDrops'
import { familyDropTableFor } from '../../data/drop/FamilyDropTables'
import { stageDropTableFor } from '../../data/drop/StageDropTables'

const SAMPLE = 100_000

/** Mulberry32 - small, seedable, good enough for expectation sampling. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(realmId: string, familyId: string, modifiers: DropModifier[]) {
  const rng = seededRng(0x5eed)
  const stageTable = stageDropTableFor(realmId, 1)
  const familyTable = familyDropTableFor(familyId)

  let spiritStone = 0
  let items = 0
  let killsWithoutEquipment = 0

  for (let index = 0; index < SAMPLE; index++) {
    const result = resolveDrops({ modifiers, channel: 'active', stageTable, familyTable, rng })

    spiritStone += result.spiritStone
    items += result.items.length

    const gotEquipment = result.items.some(
      (item) => item.kind === 'equipment' || item.kind === 'equipment_any',
    )

    if (!gotEquipment) {
      killsWithoutEquipment++
    }
  }

  return {
    spiritStonePerKill: spiritStone / SAMPLE,
    itemsPerKill: items / SAMPLE,
    noEquipmentRate: killsWithoutEquipment / SAMPLE,
  }
}

describe('drop characterization - the numbers this design is judged on', () => {
  it('prints the expectation table', () => {
    const rows = [
      ['mortal plain', sample('mortal', 'boar', [])],
      ['mortal elite', sample('mortal', 'boar', [TINH_ANH_MODIFIER])],
      ['mortal boss', sample('mortal', 'boar', [BOSS_MODIFIER])],
      ['mortal boss+elite', sample('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER])],
    ] as const

    for (const [label, row] of rows) {
      console.log(
        `${label.padEnd(20)} stone/kill=${row.spiritStonePerKill.toFixed(2)}` +
          ` items/kill=${row.itemsPerKill.toFixed(2)}` +
          ` noEquipmentRate=${(row.noEquipmentRate * 100).toFixed(1)}%`,
      )
    }

    expect(rows.length).toBe(4)
  })

  // Spec OQ1: if a boss+tinh anh kill fails to drop equipment too often, the
  // quality bonus - the rarest reward in the whole system - lands on nothing.
  it('measures OQ1: how often boss+tinh anh wastes its quality bonus', () => {
    const row = sample('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER])

    console.log(`OQ1 noEquipmentRate = ${(row.noEquipmentRate * 100).toFixed(1)}%`)

    expect(row.noEquipmentRate).toBeGreaterThanOrEqual(0)
    expect(row.noEquipmentRate).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Chạy và ĐỌC con số**

Run: `cd game && npx vitest run src/core/drop/dropCharacterization.test.ts --reporter=verbose`
Expected: PASS, và console in ra bảng kỳ vọng + một dòng `OQ1 noEquipmentRate = …%`.

- [ ] **Step 3: Áp luật quyết định OQ1**

Spec §9 đặt ngưỡng **20%**:

- `noEquipmentRate <= 0.20` → **giữ E6 nguyên**. Ghi con số đo được vào spec §9, đổi trạng thái OQ1 thành ĐÃ ĐÓNG.
- `noEquipmentRate > 0.20` → **E6 đổi**: khi `qualityBonusSteps > 0`, một trong các lượt bốc được **bảo đảm** ra trang bị. Ghi con số vào spec §9, ghi rõ E6 đã đổi, và **thêm một task mới** ngay sau task này để hiện thực + test (guard: `qualityBonusSteps > 0` thì `items` luôn chứa ít nhất một `equipment`/`equipment_any`; probe: bỏ bảo đảm đi, test phải đỏ).

Ước lượng trong spec với trọng số minh hoạ là **~53%**, nên nhánh thứ hai nhiều khả năng trúng. Đừng bỏ qua bước này.

- [ ] **Step 4: Ghi kết quả vào spec**

Sửa `game/docs/superpowers/specs/2026-09-12-drop-system-design.md` §9: thay phần "Ước lượng" bằng **số đo thật**, ghi ngày đo, ghi nhánh nào của luật quyết định đã trúng.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/drop/dropCharacterization.test.ts game/docs/superpowers/specs/2026-09-12-drop-system-design.md
git commit -m "test(drop): measure the expectation table and close OQ1"
```

- [ ] **Step 6: Cổng cuối Nhịp 1**

Run: `cd game && npm run type-check && npx vitest run`
Expected: type-check 0 lỗi; toàn bộ suite xanh; **số test cũ không đổi kết quả** — chưa consumer nào gọi mã mới.

Nếu có test cũ đổi trạng thái ở đây thì Nhịp 1 đã rò rỉ ra production. Dừng lại và tìm.

---

# NHỊP 2 — chuyển đường dẫn

> Nhịp **duy nhất** hành vi đổi. Đổi một lần, có guard kinh tế canh.

---

### Task 7: `createInstance` nhận bậc chất cộng thêm

**Files:**
- Modify: `game/src/core/equipment/EquipmentSystem.ts:307` (`createInstance`), `:360` (`rollItemQuality`)
- Test: `game/src/core/equipment/EquipmentSystem.qualityBonus.test.ts`

**Interfaces:**
- Consumes: `MAX_QUALITY_BONUS_STEPS` (Task 1)
- Produces: `createInstance(template, player, affixRegistry, zoneId?, qualityBonusSteps?: number)`

**Ràng buộc cứng (spec E5):** `rollItemQuality()` **giữ nguyên trọng số và giữ nguyên quyền sở hữu**. Bậc cộng thêm áp **sau** khi roll xong, chặn ở `tien`.

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/equipment/EquipmentSystem.qualityBonus.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { applyQualityBonusSteps } from './EquipmentSystem'

describe('applyQualityBonusSteps (spec E5)', () => {
  it('is the identity when no bonus is given', () => {
    for (const quality of ITEM_QUALITY_ORDER) {
      expect(applyQualityBonusSteps(quality, 0)).toBe(quality)
    }
  })

  it('moves one step up the ladder', () => {
    expect(applyQualityBonusSteps('hoang', 1)).toBe('huyen')
    expect(applyQualityBonusSteps('huyen', 1)).toBe('dia')
  })

  it('clamps at the top of the ladder', () => {
    expect(applyQualityBonusSteps('thien', 2)).toBe('tien')
    expect(applyQualityBonusSteps('tien', 2)).toBe('tien')
  })

  it('never moves down', () => {
    expect(applyQualityBonusSteps('dia', -3)).toBe('dia')
  })
})
```

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/equipment/EquipmentSystem.qualityBonus.test.ts`
Expected: FAIL — `applyQualityBonusSteps` chưa được export.

- [ ] **Step 3: Cài đặt**

Trong `game/src/core/equipment/EquipmentSystem.ts`, thêm export cạnh các helper thuần (ngoài class):

```ts
/**
 * Applied AFTER rollItemQuality(), never instead of it (spec E5).
 *
 * The quality ladder is rolled at fixed weights and that roll stays owned by
 * this system; a drop only ever nudges the result. Only equipment has a
 * quality ladder at all, so this is the single place a stacked kill can turn
 * into a better item.
 */
export function applyQualityBonusSteps(quality: ItemQuality, steps: number): ItemQuality {
  if (steps <= 0) {
    return quality
  }

  const index = ITEM_QUALITY_ORDER.indexOf(quality)

  if (index < 0) {
    return quality
  }

  return ITEM_QUALITY_ORDER[Math.min(ITEM_QUALITY_ORDER.length - 1, index + steps)]!
}
```

Thêm import `ITEM_QUALITY_ORDER` nếu file chưa có, rồi sửa `createInstance`:

```ts
  createInstance(
    template: Equipment,
    player: PlayerData,
    affixRegistry: AffixRegistry,
    zoneId?: string,
    qualityBonusSteps = 0,
  ): EquipmentInstance {
    assertValidEquipmentMainStats(template)

    const grade = getProfessionGradeForRealm(player.realmId)
    if (!grade) {
      throw new Error(`Missing profession grade for equipment realm ${player.realmId}`)
    }

    const quality = applyQualityBonusSteps(this.rollItemQuality(), qualityBonusSteps)
```

Phần còn lại của hàm **không đổi**.

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/equipment/EquipmentSystem.qualityBonus.test.ts src/core/equipment/EquipmentSystem.test.ts src/core/item/ItemRoll.test.ts`
Expected: PASS toàn bộ — tham số mới có mặc định nên 4 consumer cũ không đổi hành vi.

- [ ] **Step 5: Commit**

```bash
git add game/src/core/equipment/EquipmentSystem.ts game/src/core/equipment/EquipmentSystem.qualityBonus.test.ts
git commit -m "feat(equipment): a stacked kill nudges the quality roll, it does not replace it"
```

---

### Task 8: `BattleLootSystem` tiêu thụ `DropResult`

**Files:**
- Modify: `game/src/core/game/BattleLootSystem.ts` — `processDefeatedEnemies:162`, `grantItemDrops:329`, xoá `grantRandomEquipmentDrop:511`, sửa `grantArtifactStoneDrop:572`
- Modify: `game/src/core/enemy/Enemy.ts` — thêm `signatureDrops`
- Test: `game/src/core/game/BattleLootSystem.dropResult.test.ts`

**Interfaces:**
- Consumes: `resolveDrops`, `modifiersFor`, `stageDropTableFor`, `familyDropTableFor`, `applyQualityBonusSteps`
- Produces: `Enemy.signatureDrops?: SignatureDrop[]`, `EnemyDefinition.signatureDrops?: SignatureDrop[]`

**Quy tắc:** `BattleLootSystem` **giữ nguyên** mọi việc cấp phát — cộng bag, toast, particle, quest hook, overflow, auto-dissolve. Thứ bị lấy đi là quyền quyết định *cái gì* rơi.

- [ ] **Step 1: Thêm `signatureDrops` vào `Enemy.ts`**

Trong `game/src/core/enemy/Enemy.ts`, thêm vào cả `Enemy` và `EnemyDefinition`, và thread qua `defineEnemy()`:

```ts
  // Hand-placed drops that must not dissolve into the shared pool - see
  // core/drop/DropTable.ts's SignatureDrop. Replaces eliteRewards/bossRewards,
  // which are deleted in the last step of this migration.
  signatureDrops?: SignatureDrop[]
```

`defineEnemy()` thêm `signatureDrops: definition.signatureDrops,` vào object trả về. `createEliteVariant`/`createBossVariant` spread `...enemy` nên tự mang theo, không cần sửa.

- [ ] **Step 2: Viết test đỏ**

Tạo `game/src/core/game/BattleLootSystem.dropResult.test.ts`. Dùng cùng fixture với `BattleLootSystem.realmReward.test.ts` đang có (đọc file đó trước để tái dùng `createTestSetup`, đừng viết fixture thứ hai):

```ts
import { describe, expect, it } from 'vitest'

// Reuse the existing harness rather than building a second one - read
// BattleLootSystem.realmReward.test.ts and import/copy its createTestSetup.
import { createTestSetup } from './BattleLootSystem.realmReward.test'

describe('BattleLootSystem consumes DropResult', () => {
  it('grants what the resolver returned, not what the enemy authored', () => {
    const setup = createTestSetup()

    // An enemy with NO authored itemDrops still receives loot, because the
    // stage and family tables decide now. This is the defect being fixed:
    // 33 of 43 enemies had no eliteRewards table, so their elite form dropped
    // exactly what their normal form dropped.
    const before = setup.materialBag.getAmount('tinh_hoa_pham_the')

    setup.killEnemy({ enemyId: 'mortal_wild_boar', isElite: true })

    expect(setup.materialBag.getAmount('tinh_hoa_pham_the')).toBeGreaterThanOrEqual(before)
    expect(setup.summary().spiritStone).toBeGreaterThan(0)
  })

  it('multiplies currency for a stacked kill and caps it', () => {
    const setup = createTestSetup()

    setup.killEnemy({ enemyId: 'mortal_wild_boar', isBoss: true, isElite: true })

    const stacked = setup.summary().spiritStone

    const plain = createTestSetup()
    plain.killEnemy({ enemyId: 'mortal_wild_boar' })

    expect(stacked).toBeGreaterThan(plain.summary().spiritStone)
    expect(stacked).toBeLessThanOrEqual(plain.summary().spiritStone * 4 + 4)
  })
})
```

**Lưu ý cho người làm:** nếu `createTestSetup` trong file cũ không export hoặc không có `killEnemy`, hãy **trích nó ra một helper dùng chung** `game/src/core/game/battleLootTestSetup.ts` và cho cả hai file dùng — đừng nhân bản fixture.

- [ ] **Step 3: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/game/BattleLootSystem.dropResult.test.ts`
Expected: FAIL — quái chưa nhận gì vì `BattleLootSystem` vẫn đọc `enemy.rewards`.

- [ ] **Step 4: Sửa `processDefeatedEnemies`**

Thay khối tính `rewards` + 4 lời gọi grant bằng:

```ts
          const activeStage = this.deps.stageManager.get()
          const stage = activeStage ? this.deps.stageTemplates.get(activeStage.stageId) : undefined

          const modifiers = modifiersFor({
            channel: this.channel,
            isBoss: battleEnemy.entity.isBoss === true,
            isElite: battleEnemy.entity.isElite === true,
          })

          const drops = resolveDrops({
            modifiers,
            channel: this.channel,
            stageTable: stageDropTableFor(stage?.requiredRealmId, stage?.floor),
            familyTable: familyDropTableFor(enemy.family),
            signatureDrops: enemy.signatureDrops,
          })
```

Rồi cấp phát:

- `spiritStone`: nhân tiếp `talentStoneMultiplier * realmRewardMultiplier` **sau** `drops.spiritStone` (spec §1.6 — trần ×4 là trần của riêng modifier, không phải trần của tổng).
- `techniqueInsight`: dùng `drops.techniqueInsight`.
- `skillInsight`: `getSkillInsightReward({ techniqueInsight: drops.techniqueInsight, spiritStone: drops.spiritStone })` — vì `techniqueInsight` đã nhân, `skillInsight` thừa hưởng hệ số, thoả E12 mà không cần đường thứ hai.
- `drops.items`: đưa vào `grantResolvedDrops(drops.items, drops.qualityBonusSteps, battleEnemy.entity.id)` — hàm mới, thân thể **chép nguyên** phần `switch (drop.kind)` của `grantItemDrops` hiện tại (4 nhánh `material`/`pill`/`equipment`/`technique`), bỏ phần `rollChance` và `rollMortalEssenceAmount`, thêm nhánh `equipment_any` (bốc template ngẫu nhiên từ registry — chép từ `grantRandomEquipmentDrop`), và truyền `qualityBonusSteps` vào cả hai lời gọi `createInstance`.

`this.channel` là field mới trên `BattleLootSystem`, mặc định `'active'`, đặt qua `setChannel(channel: DropChannel)` — Task 9 dùng.

- [ ] **Step 5: Xoá ba kênh hardcode**

- Xoá hẳn `grantRandomEquipmentDrop` và lời gọi nó.
- Xoá hẳn `grantArtifactStoneDrop` và lời gọi nó — Đoán Bảo Thạch giờ là một dòng trong bảng stage Trúc Cơ (Task 5). **Xác nhận bằng mắt** rằng nó có trong bảng đó trước khi xoá, nếu không nó biến mất khỏi game.
- Xoá import `BOSS_EQUIPMENT_DROP_CHANCE`, `NORMAL_EQUIPMENT_DROP_CHANCE`, `rollMortalEssenceAmount`, `ARTIFACT_STONE_*`, `getRealmIndex` nếu không còn ai dùng.
- `grantArtifactExperience` **giữ nguyên** — đó là hồ EXP pháp bảo, không phải drop.

- [ ] **Step 6: Chạy toàn bộ suite**

Run: `cd game && npx vitest run`
Expected: test mới xanh. Một số test cũ về loot **sẽ đỏ** — đó là hành vi đổi có chủ đích. Với **từng** test đỏ, phân loại trước khi sửa:

1. Test khẳng định hành vi cũ mà spec cố ý đổi → cập nhật test, ghi lý do vào commit message.
2. Test khẳng định thứ spec **không** định đổi → đây là lỗi hồi quy, **sửa code chứ không sửa test**.

Đừng sửa hàng loạt. Sai số ở bước này là cách một đợt nerf ngoài ý muốn lọt vào.

- [ ] **Step 7: Commit**

```bash
git add game/src/core/game/BattleLootSystem.ts game/src/core/enemy/Enemy.ts game/src/core/game/BattleLootSystem.dropResult.test.ts
git commit -m "feat(drop): the loot system grants what the resolver decided"
```

---

### Task 9: Kênh idle

**Files:**
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts:1564` (`rollAutoFarmCycleReward`)
- Test: `game/src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts`

**Interfaces:**
- Consumes: `BattleLootSystem.setChannel` (Task 8)
- Produces: không có

- [ ] **Step 1: Viết test đỏ**

Tạo `game/src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { modifiersFor } from '../drop/DropContext'

describe('idle channel (spec E10)', () => {
  it('floor 10 idle still carries boss', () => {
    expect(modifiersFor({ channel: 'idle', isBoss: true, isElite: false }).map((m) => m.id)).toEqual([
      'boss',
    ])
  })

  it('idle never carries tinh_anh even when the spawn rolled elite', () => {
    expect(modifiersFor({ channel: 'idle', isBoss: false, isElite: true })).toEqual([])
  })

  it('rollAutoFarmCycleReward puts the loot system on the idle channel', () => {
    // Read GameManagerTurnBattleOps.ts around line 1564 and assert through the
    // real deps object: setChannel('idle') is called before
    // processDefeatedEnemies, and restored to 'active' afterwards.
    const setChannel = vi.fn()

    expect(setChannel).toBeDefined()
  })
})
```

**Người làm:** test thứ ba ở trên là khung. Thay nó bằng một khẳng định thật qua fixture của `GameManagerTurnBattleOps` — tìm test file đang có cho auto-farm (`grep -rn "rollAutoFarmCycleReward\|settleAutoFarmOffline" game/src --include=*.test.ts`) và tái dùng fixture của nó. **Không** commit một test luôn xanh.

- [ ] **Step 2: Chạy để thấy nó đỏ**

Run: `cd game && npx vitest run src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts`
Expected: FAIL ở khẳng định về `setChannel`.

- [ ] **Step 3: Cài đặt**

Trong `rollAutoFarmCycleReward`:

```ts
    this.deps.battleLoot.beginBattle()
    this.deps.battleLoot.setChannel('idle')
    this.deps.battleLoot.setSession(this.deps.buildPlayerRewardReceiver(player), player)
```

và sau `processDefeatedEnemies(shimBattle)`:

```ts
    // Restore the default so a real battle started later in the same tick is
    // not silently farmed at idle rates.
    this.deps.battleLoot.setChannel('active')
```

- [ ] **Step 4: Chạy để thấy nó xanh**

Run: `cd game && npx vitest run src/core/game/`
Expected: PASS.

- [ ] **Step 5: Probe — idle phải thật sự khác active**

Đổi tạm `setChannel('idle')` thành `setChannel('active')`.
Run lại. Expected: FAIL. **Hoàn tác** rồi chạy lại cho xanh.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/game/GameManagerTurnBattleOps.ts game/src/core/game/GameManagerTurnBattleOps.idleDrops.test.ts
git commit -m "feat(drop): idle farms on its own channel"
```

---

### Task 10: Viết lại invariant + guard kinh tế

**Files:**
- Modify: `game/src/data/enemy/EnemyDropSinkInvariant.test.ts`
- Modify: `game/src/data/enemy/EnemyAlchemyDrops.test.ts`
- Create: `game/src/core/drop/dropEconomy.test.ts`

**Interfaces:**
- Consumes: mọi thứ
- Produces: không có

**Đây là task dễ tự lừa nhất trong cả plan.** Invariant cũ duyệt ba trường sắp bị xoá; viết lại mà quên một nguồn thì test **vẫn xanh trong khi luật đã thủng**.

- [ ] **Step 1: Viết lại `collectDroppedMaterialIds` cho ba nguồn**

Trong `EnemyDropSinkInvariant.test.ts`, thay thân hàm:

```ts
function collectDroppedMaterialIds(): Set<string> {
  const ids = new Set<string>()

  const addFrom = (entries: readonly { kind: string; itemId?: string }[]) => {
    for (const entry of entries) {
      if (entry.kind === 'material' && entry.itemId) {
        ids.add(entry.itemId)
      }
    }
  }

  // Source 1 - stage tables.
  for (const table of STAGE_DROP_TABLES) {
    addFrom(table.guaranteed)
    addFrom(table.pool)
  }

  // Source 2 - family tables.
  for (const table of FAMILY_DROP_TABLES) {
    addFrom(table.guaranteed)
    addFrom(table.pool)
  }

  // Source 3 - hand-placed signature drops.
  for (const enemy of ENEMIES) {
    addFrom(enemy.signatureDrops ?? [])
  }

  return ids
}
```

Làm tương tự cho `EnemyAlchemyDrops.test.ts`.

- [ ] **Step 2: PHÉP THỬ BA-LẦN-ĐỎ (spec §5.2) — bắt buộc, không bỏ qua**

Làm **ba lần riêng biệt**. Mỗi lần: thêm một material không có sink, chạy test, **xác nhận thấy đỏ**, rồi hoàn tác.

1. Thêm `{ kind: 'material', itemId: 'zzz_no_sink', weight: 1 }` vào `pool` của **một bảng stage bất kỳ**.
   Run: `cd game && npx vitest run src/data/enemy/EnemyDropSinkInvariant.test.ts` → phải FAIL nêu tên `zzz_no_sink`. Hoàn tác.
2. Thêm dòng đó vào `pool` của **một bảng family bất kỳ**.
   Run lại → phải FAIL. Hoàn tác.
3. Thêm `{ kind: 'material', itemId: 'zzz_no_sink', chance: 1 }` vào `signatureDrops` của **một quái bất kỳ**.
   Run lại → phải FAIL. Hoàn tác.

**Chỉ khi cả ba lần đều đỏ** mới tính là đã viết lại đúng. Ghi kết quả ba lần vào commit message.

- [ ] **Step 3: Viết guard kinh tế**

Tạo `game/src/core/drop/dropEconomy.test.ts` — dùng lại `seededRng` và `sample` từ Task 6 (trích ra `game/src/core/drop/dropSampling.ts` để hai file dùng chung, đừng chép):

```ts
import { describe, expect, it } from 'vitest'
import { BOSS_MODIFIER, TINH_ANH_MODIFIER } from './DropModifier'
import { sampleDropExpectation } from './dropSampling'

/**
 * Expected spirit stone per kill, per realm band and per form.
 *
 * These are NAMED CONSTANTS, not bare numbers: changing one is a visible
 * decision in review rather than a value that drifted. Tolerance is +/-5%.
 * At the 100k sample the sampling noise on these expectations is under 1%,
 * so 5% catches a real data change without flaking.
 */
const EXPECTED_SPIRIT_STONE_PER_KILL = {
  mortalPlain: 0, // FILL from the Task 6 printout
  mortalElite: 0, // FILL
  mortalBoss: 0, // FILL
  mortalStacked: 0, // FILL
}

const TOLERANCE = 0.05

function expectWithin(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected) / expected, `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    TOLERANCE,
  )
}

describe('drop economy (spec §5.3)', () => {
  it('holds the currency expectation per form', () => {
    expectWithin(
      sampleDropExpectation('mortal', 'boar', []).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalPlain,
      'mortal plain',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [TINH_ANH_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalElite,
      'mortal elite',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalBoss,
      'mortal boss',
    )

    expectWithin(
      sampleDropExpectation('mortal', 'boar', [BOSS_MODIFIER, TINH_ANH_MODIFIER]).spiritStonePerKill,
      EXPECTED_SPIRIT_STONE_PER_KILL.mortalStacked,
      'mortal stacked',
    )
  })

  it('keeps the ceiling: a stacked kill is at most four times a plain one', () => {
    const plain = sampleDropExpectation('mortal', 'boar', []).spiritStonePerKill
    const stacked = sampleDropExpectation('mortal', 'boar', [
      BOSS_MODIFIER,
      TINH_ANH_MODIFIER,
    ]).spiritStonePerKill

    expect(stacked / plain).toBeLessThanOrEqual(4 * (1 + TOLERANCE))
  })
})
```

Điền 4 hằng số từ bảng in ra ở Task 6.

- [ ] **Step 4: Chạy để thấy nó xanh, rồi probe**

Run: `cd game && npx vitest run src/core/drop/dropEconomy.test.ts`
Expected: PASS.

Probe: nâng `BOSS_MODIFIER.currencyBonus` từ 2 lên 4. Run lại. Expected: FAIL ở `mortal boss` **và** `mortal stacked`. Hoàn tác.

- [ ] **Step 5: Ghi Δ so với hiện trạng vào spec**

Sửa spec §5.3: thay bảng Δ ước tính bằng **số đo thật** cho `mortal`, giữ hàng `bandit` làm chứng cứ hiện trạng.

- [ ] **Step 6: Commit**

```bash
git add game/src/data/enemy/EnemyDropSinkInvariant.test.ts game/src/data/enemy/EnemyAlchemyDrops.test.ts game/src/core/drop/dropEconomy.test.ts game/src/core/drop/dropSampling.ts game/docs/superpowers/specs/2026-09-12-drop-system-design.md
git commit -m "test(drop): sink invariant walks all three sources, economy is a named number"
```

---

# NHỊP 3 — dọn

> Nhịp **không lùi được**. Chỉ bắt đầu khi Nhịp 2 đã xanh hoàn toàn.

---

### Task 11: Xoá ba bảng chép tay

**Files:**
- Modify: `game/src/data/enemy/Enemies.ts` — xoá 10 khối `eliteRewards`, 20 khối `bossRewards`, chuyển các dòng đặt tay sang `signatureDrops`
- Modify: `game/src/core/enemy/Enemy.ts` — xoá field `eliteRewards`/`bossRewards`, xoá `rewards: enemy.eliteRewards ?? …` trong hai variant
- Delete: `game/src/core/reward/StageDropRules.ts`

**Interfaces:**
- Consumes: `SignatureDrop` (Task 2)
- Produces: không có

- [ ] **Step 1: Tìm mọi drop đặt tay cần giữ**

Run:

```bash
cd game && grep -n "kind: 'technique'\|great_dao_seed\|broken_foundation_scroll\|old_jade_slip\|cultivator_diary\|stele_fragment" src/data/enemy/Enemies.ts
```

Mỗi dòng tìm được là một **ứng viên `signatureDrops`**. Cụ thể: 5 item trong `LORE_ALLOWLIST` của invariant và mọi `kind: 'technique'` (Phá Cảnh Tâm Pháp) là drop có chủ đích — chúng **phải** chuyển sang `signatureDrops`, không được để rơi vào bảng chung.

- [ ] **Step 2: Chuyển từng quái**

Với mỗi quái có `eliteRewards`/`bossRewards`:

```ts
// Trước
rewards: { techniqueInsight: 40, spiritStone: 10, itemDrops: [...] },
eliteRewards: { techniqueInsight: 200, spiritStone: 60, itemDrops: [...] },
bossRewards: { techniqueInsight: 500, spiritStone: 150, itemDrops: [
  { kind: 'technique', itemId: 'van_kiem_quyet', chance: 1 },
  { kind: 'material', itemId: 'great_dao_seed', amount: 1, chance: 0.0001 },
] },

// Sau
rewards: { techniqueInsight: 40, spiritStone: 10 },
signatureDrops: [
  { kind: 'technique', itemId: 'van_kiem_quyet', chance: 1, requiresModifier: 'boss' },
  { kind: 'material', itemId: 'great_dao_seed', amount: { min: 1, max: 1 }, chance: 0.0001, requiresModifier: 'boss' },
],
```

`rewards.techniqueInsight`/`spiritStone` **giữ lại** trên `EnemyReward` (một số đường khác vẫn đọc nó, ví dụ `getArtifactExperienceReward`); chỉ `itemDrops` và hai bảng biến thể bị xoá. **Xác minh** bằng `grep -rn "\.rewards\b" game/src --include=*.ts | grep -v test` trước khi xoá gì.

- [ ] **Step 3: Xoá field khỏi type**

Trong `Enemy.ts`: xoá `eliteRewards`/`bossRewards` khỏi `Enemy` và `EnemyDefinition`, xoá dòng gán trong `defineEnemy`, và trong hai variant đổi:

```ts
    // createEliteVariant / createBossVariant: rewards no longer switch tables.
    // What a kill drops is decided by core/drop/resolveDrops.ts from the stage,
    // the family and the modifiers the kill carries.
```

tức bỏ hẳn dòng `rewards: enemy.bossRewards ?? …` (spread `...enemy` đã mang `rewards` sang).

- [ ] **Step 4: Xoá `StageDropRules.ts`**

Run `grep -rn "StageDropRules\|NORMAL_EQUIPMENT_DROP_CHANCE\|BOSS_EQUIPMENT_DROP_CHANCE\|rollMortalEssenceAmount" game/src` — phải **không còn kết quả nào ngoài chính file đó**. Rồi `git rm game/src/core/reward/StageDropRules.ts`.

- [ ] **Step 5: Cổng đầy đủ**

Run:

```bash
cd game && npm run type-check && npm run build && npx vitest run && npx eslint . 2>&1 | tail -5
```

Expected: type-check 0, build 0, toàn bộ vitest xanh, eslint đúng baseline của master (không thêm lỗi mới).

- [ ] **Step 6: Kiểm tra trên trình duyệt**

Run: `cd game && DEV_PORT=5182 npx playwright test`

Rồi chơi tay: đánh Động 1 vài lần xác nhận có đồ rơi và có toast; đánh tầng 10 xác nhận boss rơi nhiều hơn; bật auto-farm một stage đã Hoàn Mỹ, xác nhận log thưởng **không** có tiền tố "Tinh Anh".

- [ ] **Step 7: Commit**

```bash
git add -A game/src
git commit -m "refactor(drop): delete the three hand-copied reward tables"
```

---

## Self-Review

**Spec coverage:**

| Spec | Task |
|---|---|
| E1 bảng dùng chung | 5, 11 |
| E2 hai tầng | 3, 5 |
| E3 ba đường tác động | 1, 3 |
| E4 tiền cộng, trần ×4 | 1 (luật), 10 (guard) |
| E5 chất vẫn thuộc EquipmentSystem | 7 |
| E6 chỉ trang bị, phí lượt thì thôi | 3, 6 (OQ1), 7 |
| E7 signatureDrops | 2, 3, 8, 11 |
| E8 từ vựng modifier riêng | 1, 4 |
| E9 nâng chất theo số lượng modifier | 1 |
| E10 idle giữ thuộc tính stage | 4, 9 |
| E11 idle chỉ nhận signature chắc chắn | 3, 4 |
| E12 hệ số áp cả ba hồ | 8 (qua `getSkillInsightReward`) |
| §2.5 ba hardcode thành vị trí dữ liệu | 5, 8 |
| §5.1 characterization | 6 |
| §5.2 ba-lần-đỏ | 10 |
| §5.3 biên ±5% | 10 |
| §5.4 luật stack | 1, 3 |
| §5.5 phí lượt | 6 |
| §5.6 phân phối chất | 7 |
| §5.7 idle | 9 |
| OQ1 | 6 |
| §4 ba nhịp | ranh giới Task 6 / Task 10 |

**Chưa phủ, có chủ đích:** §7.1 (lọc `equipment_any` theo cảnh giới) là task riêng sau nhịp 3, đã ghi trong spec. §5.8 P14 nằm trong Task 11 Step 6.

**Nhất quán kiểu:** `modifiersFor` (Task 4) trả `DropModifier[]`, khớp `ResolveDropsInput.modifiers` (Task 3). `DropChannel` khai ở `resolveDrops.ts`, `DropContext.ts` import từ đó — một nguồn. `applyQualityBonusSteps` (Task 7) nhận `ItemQuality`, khớp `ITEM_QUALITY_ORDER`. `stageDropTableFor(realmId, floor)` nhận `string | undefined` vì `Stage.requiredRealmId` và `Stage.floor` đều optional.

**Rủi ro lớn nhất của plan này:** Task 8 Step 6. Sẽ có test cũ đỏ, và phân loại sai ở đó là cách một đợt nerf ngoài ý muốn lọt vào cây code. Bước đó viết rõ hai loại và cấm sửa hàng loạt.
