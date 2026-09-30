import { backendBundle } from '../backend/backendBundle'
import type { CloudSaveCoordinator } from './CloudSaveCoordinator'

// B1.2 - the coordinator is bundle-composed: LocalCloudSaveService under
// VITE_BACKEND_MODE=mock, SupabaseCloudSaveService (remote-authoritative)
// under supabase. The old newest-wins login reconciliation (spec F8)
// is retired: the authoritative RPC load inside the adapter replaces it
// entirely (B1.5 - two remote mechanisms may not survive).
export const cloudSaveCoordinator: CloudSaveCoordinator = backendBundle.cloudSaveCoordinator
