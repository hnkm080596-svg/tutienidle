import type { GameSave } from '../save/SaveSystem'
import type { CloudSaveCapability, CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult, HeartbeatOutcome } from './CloudSaveService'

interface QueuedSave {
  /** Callers that arrived while a write was in flight all resolve with
   *  the promoted entry's single result. */
  resolvers: ((result: CloudSaveWriteResult) => void)[]
  /** Newest detached snapshot wins; the displaced one is a subset of it
   *  because snapshots are canonical full-state saves. */
  snapshot: GameSave
  generation: number
}

function adapterThrow(_error: unknown): CloudSaveWriteResult {
  return {
    status: 'unavailable',
    message: 'Save adapter threw unexpectedly.',
    retryable: false,
    detail: 'SAVE_ADAPTER_THROW',
  }
}

function staleGenerationResult(): CloudSaveWriteResult {
  return {
    status: 'unavailable',
    message: 'Save dropped: the session generation changed while it was queued.',
    retryable: false,
    detail: 'STALE_GENERATION',
  }
}

export class CloudSaveCoordinator {
  private revision = 0
  // B1-C: reset/logout/user-switch fence. Every async continuation
  // captures the generation at entry; post-await side effects (revision
  // adoption, queued-write promotion) check it before committing.
  private generation = 0
  // B1-C: one queue serializes EVERY save caller (manual/autosave/quit).
  // At most one entry inflight + one queued: callers that arrive during
  // an inflight write join the queued entry instead of starting
  // independent writes; the entry's expected revision is re-read from
  // this.revision at promotion (i.e. after the inflight write's ACK),
  // and the adapter mints a fresh mutation id for it.
  private inflight = false
  private queued: QueuedSave | null = null

  constructor(private readonly service: CloudSaveService) {}

  // R10 (AR-15, local scope, S5) - passthrough so callers/tests can assert
  // the adapter boundary without reaching into the private service field.
  get capability(): CloudSaveCapability {
    return this.service.capability
  }

  async load(): Promise<CloudSaveLoadResult> {
    const generation = this.generation
    const result = await this.service.load()
    // 'uninitialized' carries revision 0: the first write is expected 0->1.
    if (
      generation === this.generation
      && (result.status === 'ok' || result.status === 'empty' || result.status === 'uninitialized')
    ) {
      this.revision = result.revision
    }
    return result
  }

  /** B1-C: the ACKed mirror for export/resume seams (remote envelope or
   *  local slot); null when absent/corrupt. Never an authority read. */
  async readCachedSave(): Promise<{ raw: string; revision: number } | null> {
    return this.service.readCachedSave ? this.service.readCachedSave() : null
  }

  /** B1-D: the active-session probe for the heartbeat cadence. Local
   *  adapters have no remote authority - they resolve 'ok' trivially. */
  async heartbeat(): Promise<HeartbeatOutcome> {
    return this.service.heartbeat ? this.service.heartbeat() : { status: 'ok' }
  }

  async save(snapshot: GameSave): Promise<CloudSaveWriteResult> {
    const generation = this.generation

    if (this.inflight) {
      // Join-or-displace: at most one queued entry. The newest detached
      // snapshot replaces the queued one (a canonical full-state
      // snapshot supersedes the displaced one); every caller that
      // joined - including the displaced snapshot's - resolves with the
      // promoted entry's result.
      if (!this.queued) {
        this.queued = { resolvers: [], snapshot, generation }
      } else {
        this.queued.snapshot = snapshot
        this.queued.generation = generation
      }
      const entry = this.queued
      return new Promise<CloudSaveWriteResult>((resolve) => {
        entry.resolvers.push(resolve)
      })
    }

    this.inflight = true
    // A throwing adapter resolves the result contract to 'unavailable':
    // save() callers and joined resolvers never see a rejection.
    const result = await this.driveSave(snapshot, generation).catch(adapterThrow)
    // Drain: promote the queued entry AFTER the inflight write's ACK,
    // so its CAS expected revision is the freshly adopted one. A throwing
    // drive must not strand joined resolvers - they settle 'unavailable'.
    try {
      while (this.queued) {
        const entry = this.queued
        this.queued = null
        const promoted = entry.generation === this.generation
          ? await this.driveSave(entry.snapshot, entry.generation).catch(adapterThrow)
          : staleGenerationResult()
        for (const resolve of entry.resolvers) resolve(promoted)
      }
    } finally {
      this.inflight = false
    }
    return result
  }

  private async driveSave(snapshot: GameSave, generation: number): Promise<CloudSaveWriteResult> {
    const result = await this.service.save(snapshot, this.revision)

    if (result.status === 'ok') {
      if (generation === this.generation) this.revision = result.revision
      return result
    }

    // Beta-final B1.6 - under a remote-authoritative adapter a revision
    // conflict is a LIFECYCLE STATE, not an auto-retry trigger: another
    // session committed first, and the reconcile/recovery machinery
    // (PR4-5) owns the response. The local load-latest/retry-overwrite
    // branch below must never run - blindly overwriting the newer remote
    // revision is exactly the authority violation the spec forbids.
    if (this.service.capability === 'remote-authoritative') {
      return result
    }

    // Fix (2026-08-24) - conflict KHONG con la trang thai terminal. Truoc
    // day revision cua coordinator bi stale vinh vien sau 1 lan conflict
    // (vi du mo 2 tab), khien moi autosave ve sau deu fail am tham.
    // Hanh vi moi: re-sync revision moi nhat tu storage roi thu ghi lai
    // DUNG MOT lan (last-writer-wins - hop le cho game local 1 nguoi;
    // khong co merge cap GameSave nao kha thi giua 2 phien cung choi).
    // Neu retry van conflict/unavailable, revision hien da cap nhat nen
    // autosave ke tiep (15s) se tu thanh cong - khong con ket vinh vien.
    if (result.status !== 'conflict') {
      return result
    }

    const resync = await this.load()

    if (resync.status !== 'ok' && resync.status !== 'empty') {
      return result
    }

    const retry = await this.service.save(snapshot, this.revision)

    if (retry.status === 'ok') {
      if (generation === this.generation) this.revision = retry.revision
      return { ...retry, recoveredFromConflict: true }
    }

    return retry
  }

  // Nhan vat moi bat dau chuoi revision moi tu 0 - goi thay vi fabricate
  // `{status:'empty', revision:0}` ngoai vong doi coordinator (App.vue
  // bootGame(true)), dam bao revision noi bo luon khop trang thai storage.
  // B1-C: also the generation fence - bumps the adapter generation so
  // in-flight remote writes from the previous session cannot touch the
  // journal/cache when they resolve, and drains any queued writers with
  // a stale-generation result instead of committing them.
  reset(): void {
    this.generation++
    this.revision = 0
    this.service.advanceGeneration?.()
    const stale = this.queued
    this.queued = null
    if (stale) {
      const result = staleGenerationResult()
      for (const resolve of stale.resolvers) resolve(result)
    }
  }

  getRevision(): number { return this.revision }
}
