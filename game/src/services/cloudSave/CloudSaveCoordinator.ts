import type { GameSave } from '../save/SaveSystem'
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult } from './CloudSaveService'

export class CloudSaveCoordinator {
  private revision = 0

  constructor(private readonly service: CloudSaveService) {}

  async load(): Promise<CloudSaveLoadResult> {
    const result = await this.service.load()
    if (result.status === 'ok' || result.status === 'empty') this.revision = result.revision
    return result
  }

  async save(snapshot: GameSave): Promise<CloudSaveWriteResult> {
    const result = await this.service.save(snapshot, this.revision)

    if (result.status === 'ok') {
      this.revision = result.revision
      return result
    }

    // Fix (2026-08-24) — conflict KHÔNG còn là trạng thái terminal. Trước
    // đây revision của coordinator bị stale vĩnh viễn sau 1 lần conflict
    // (ví dụ mở 2 tab), khiến mọi autosave về sau đều fail âm thầm.
    // Hành vi mới: re-sync revision mới nhất từ storage rồi thử ghi lại
    // ĐÚNG MỘT lần (last-writer-wins — hợp lệ cho game local 1 người;
    // không có merge cấp GameSave nào khả thi giữa 2 phiên cùng chơi).
    // Nếu retry vẫn conflict/unavailable, revision hiện đã cập nhật nên
    // autosave kế tiếp (15s) sẽ tự thành công — không còn kẹt vĩnh viễn.
    if (result.status !== 'conflict') {
      return result
    }

    const resync = await this.load()

    if (resync.status !== 'ok' && resync.status !== 'empty') {
      return result
    }

    const retry = await this.service.save(snapshot, this.revision)

    if (retry.status === 'ok') {
      this.revision = retry.revision
      return { ...retry, recoveredFromConflict: true }
    }

    return retry
  }

  // Nhân vật mới bắt đầu chuỗi revision mới từ 0 — gọi thay vì fabricate
  // `{status:'empty', revision:0}` ngoài vòng đời coordinator (App.vue
  // bootGame(true)), đảm bảo revision nội bộ luôn khớp trạng thái storage.
  reset(): void {
    this.revision = 0
  }

  getRevision(): number { return this.revision }
}
