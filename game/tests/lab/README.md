# tests/lab — headless experiment harness

Quick way to poke at game systems without launching the app: a real
`GameManager` in plain node (Vitest), two manual clocks, and a cheat
surface that still goes through the real owners.

## Run

```bash
npm run lab          # run tests/lab once
npm run lab:watch    # watch mode
npx vitest run tests/lab/scratch.test.ts   # single file
```

## Usage

```ts
import { createLab } from './harness'

const lab = createLab()          // GameManager + ManualClockSource + active player
lab.useRealData()                // optional: register ALL real data catalogs
lab.startStage()                 // deterministic dummy stage (1 enemy, atk 0)
lab.combat(30)                   // advance combat clock 30s
lab.tick(60)                     // advance world clock 60s (1s slices)
console.log(lab.snapshot())      // readable dump: realm, stats, battle, bags
```

## Cheats (`lab.cheat.*`)

| Call | What it does |
|---|---|
| `addMaterial(id, n)` | materialRegistry lookup → materialBag.add; returns `{stored, overflow}` |
| `addSpiritStones(n)` | resolves the spirit-stone material id for the player's current realm tier |
| `addEquipment(id, zoneId?)` | rolls a real instance via EquipmentSystem.createInstance → equipmentBag |
| `addPill(id, n)` | pillRegistry → pillBag; returns `{stored, overflow}` |
| `setBaseStats(patch)` | mutates player.baseStats (next battle / lab.stats()) |
| `oneHitKill()` | might = 1e9 through the real damage pipeline (pending + live battle) |
| `godMode()` | huge might/maxHp/defense/speed, heals the live entity |
| `setRealm(id, level?)` / `grantCultivation(n)` / `grantSkillInsight(n)` | progression cheats |

Deliberately no "set enemy HP" cheat — vitals mutation is owned by the
damage pipeline (A2/P17); `oneHitKill()` exercises the honest path.

## Notes

- `lab.startStage()` uses `src/core/game/__fixtures__/startAStage.ts`
  (1 dummy, might 0, hp 1e6) and **rebinds `lab.player`** to the
  fixture's player.
- Stat cheats remember a "live patch" so `oneHitKill()` before
  `startStage()` still applies to the spawned entity (the fixture
  bakes might/speed=100).
- `useRealData()` mirrors the App.vue boot registration
  (`tests/lab/realData.ts`) — keep them in sync when catalogs change.
- `tests/lab/local/` is gitignored — personal scratch goes there.
