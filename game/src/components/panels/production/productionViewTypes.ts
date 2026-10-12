// Shared row contracts for the San Xuat inner pieces (2026-10-11
// landscape port). ProductionSiteRow is a structural subset of the
// panel's SiteRow - the buildingOps.getProductionViews projection the
// panel already computes, carried into the extracted card components.
export interface ProductionSiteRow {
  siteId: string

  kind: string

  kindLabel: string

  name: string

  description: string

  level: number

  maxLevel: number

  productionSpeedMultiplier: number

  nextProductionSpeedMultiplier?: number

  autoRestart: boolean

  activeWorkerSlots?: number

  assignedWorkers?: number

  isProducing: boolean

  progress: number

  remainingLabel: string
}
