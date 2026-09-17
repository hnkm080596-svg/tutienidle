import { CloudSaveCoordinator } from './CloudSaveCoordinator'
import { LocalCloudSaveService } from './LocalCloudSaveService'
import { getSupabaseConfig } from '../supabase/SupabaseConfig'
import { syncRemoteSaveOnLogin } from './SupabaseRemoteSave'

// Trong giai đoạn phát triển, local adapter thực thi cùng contract/revision
// với cloud. Supabase adapter sẽ thay tại đây khi schema gameplay ổn định.
export const cloudSaveCoordinator = new CloudSaveCoordinator(new LocalCloudSaveService())

const supabaseConfig = getSupabaseConfig()

// Spec F8 — boot-time newest-wins sync for authenticated accounts. This is
// NOT the AR-15 "remote adapter" (that stays a separate product decision):
// it is an explicit, optional pre-load reconciliation step wired by App.vue;
// the write path remains the local-only adapter above.
export const remoteSaveSync: (() => Promise<unknown>) | undefined = supabaseConfig
  ? () => syncRemoteSaveOnLogin(supabaseConfig)
  : undefined
