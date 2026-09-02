// Task 14 patch — wire DecomposeSystem vào GameManager.
const fs = require('fs')
const p = 'src/core/game/GameManager.ts'
let c = fs.readFileSync(p, 'utf8')

// 1. Import (sau equipment imports).
const importAnchor = "import { EquipmentSystem } from '../equipment/EquipmentSystem'"
const importNew = importAnchor + "\nimport { DecomposeSystem } from '../production/DecomposeSystem'"

if (c.includes(importAnchor) && !c.includes('DecomposeSystem')) {
  c = c.replace(importAnchor, importNew)
}

// 2. Field sau equipmentSystem field.
const fieldAnchor = 'readonly equipmentSystem = new EquipmentSystem(createDefaultEquipmentOperationCostCatalog())'
const fieldNew = fieldAnchor + '\n\n  // Task 14 (rework P4) — Tab Phân Giải: khoáng → Luyện Khí Tinh Hoa.\n  readonly decomposeSystem = new DecomposeSystem(this.materialBag, { autoWorkerCapacity: 0 })'

if (!c.includes(fieldAnchor)) {
  console.error('field anchor not found')

  process.exit(1)
}

if (!c.includes('decomposeSystem')) {
  c = c.replace(fieldAnchor, fieldNew)
}

fs.writeFileSync(p, c)

console.log('import + field wired')
