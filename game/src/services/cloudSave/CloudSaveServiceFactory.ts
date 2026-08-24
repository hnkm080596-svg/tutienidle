import { CloudSaveCoordinator } from './CloudSaveCoordinator'
import { LocalCloudSaveService } from './LocalCloudSaveService'

// Trong giai đoạn phát triển, local adapter thực thi cùng contract/revision
// với cloud. Supabase adapter sẽ thay tại đây khi schema gameplay ổn định.
export const cloudSaveCoordinator = new CloudSaveCoordinator(new LocalCloudSaveService())
