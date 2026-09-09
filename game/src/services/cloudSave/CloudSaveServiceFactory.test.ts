// R10 (AR-15, local scope, S5) — the factory must construct a service
// whose capability is 'local-only', full stop. There is no environment
// branching in the factory today (see BOUNDS.md); this guard exists so
// that IF one is ever added, it fails loudly the moment it silently
// upgrades the default export's capability without an explicit, separately
// scoped remote-adapter mission.
import { describe, expect, it } from 'vitest'
import { cloudSaveCoordinator } from './CloudSaveServiceFactory'
import { LocalCloudSaveService } from './LocalCloudSaveService'

describe('CloudSaveServiceFactory (R10, AR-15 local scope)', () => {
  it('cloudSaveCoordinator wraps a local-only capable service', () => {
    expect(cloudSaveCoordinator.capability).toBe('local-only')
  })

  it('LocalCloudSaveService always reports local-only regardless of construction context', () => {
    expect(new LocalCloudSaveService().capability).toBe('local-only')
  })
})
