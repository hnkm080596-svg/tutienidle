// R10 (AR-15) + B1.2 - the coordinator is bundle-composed from the
// explicit VITE_BACKEND_MODE. Under test (no mode declared, non-PROD)
// the default is the local mock bundle, so capability stays 'local-only'.
// The release/supabase branches of that matrix are pinned by
// src/services/backend/backendMode.test.ts - a regression that made a
// fatal release composition silently resolve would fail there too.
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
