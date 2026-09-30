// Shared B1-C journal harness for the supabase contract specs.
//
// The REAL client-side queue/adapter/journal/cache modules run against the
// REAL RPC surface - only localStorage is emulated (an in-memory Storage),
// because the suite executes in Node. Every commit, receipt and conflict
// driven through this file happens on the real staging project.
import type { Client } from 'pg'
import { SupabaseCloudSaveService } from '../../../src/services/cloudSave/SupabaseCloudSaveService'
import { CloudSaveCoordinator } from '../../../src/services/cloudSave/CloudSaveCoordinator'
import { PendingSaveJournal } from '../../../src/services/cloudSave/PendingSaveJournal'
import { AckedSaveCache } from '../../../src/services/cloudSave/AckedSaveCache'
import { setSaveAccountId } from '../../../src/services/save/saveKeys'
import { withMortalCreationPick } from '../../../src/services/save/GameSave.fixture'
import { createDefaultPlayer } from '../../../src/core/player/Player'
import { saveRow } from './fixture'
import type { ClientBuildInfo } from '../../../src/services/backend/ClientBuildInfo'
import type { GameSave } from '../../../src/services/save/saveTypes'
import type { ReconcileDecision } from '../../../src/services/cloudSave/reconcilePendingSave'
import type { ContractEnv, TestUser, CharacterMeta } from './fixture'

export class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

// Same derivation as the adapter: releaseChannel + project-ref fingerprint.
export function contractEnvId(env: ContractEnv): string {
  const host = new URL(env.supabaseUrl).hostname
  const project = host.endsWith('.supabase.co') ? host.slice(0, -'.supabase.co'.length) : host
  return `beta:${project}`
}

// A save satisfying BOTH contracts: the server identity gate (name, talents,
// mortal pick bound to the character) and the client shape/acceptance
// pipeline the adapter runs on load. `marker` varies a non-identity field so
// distinct snapshots stay contract-legal (name/talentIds are immutable).
export function integrationGameSave(character: CharacterMeta, marker = false): GameSave {
  const player = createDefaultPlayer()
  player.name = character.name
  player.selectedTalentIds = [...character.selectedTalentIds]
  player.hasSeenTutorial = marker
  const save: GameSave = {
    version: 87,
    player,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
  if (character.mortalBasicSkillId) {
    withMortalCreationPick(save, character.mortalBasicSkillId)
  }
  return save
}

// GameSave is a nominal interface without an index signature; the RPC
// fixture takes a plain record - the payload crosses the wire untyped anyway.
export const asRpcPayload = (save: GameSave) => save as unknown as Record<string, unknown>

export interface JournalHarness {
  service: SupabaseCloudSaveService
  journal: PendingSaveJournal
  acked: AckedSaveCache
  binding: { environmentId: string; userId: string; characterId: string }
  decisions: ReconcileDecision[]
}

// Adapter + journal + cache over one shared storage slot, bound to the real
// session/character. reconcileObserver captures the pure decider's verdicts.
export function journalHarness(
  env: ContractEnv,
  build: ClientBuildInfo,
  user: TestUser,
  character: CharacterMeta,
  sessionId: string,
): JournalHarness {
  const storage = new MemoryStorage()
  const environmentId = contractEnvId(env)
  setSaveAccountId(user.userId)
  const decisions: ReconcileDecision[] = []
  const service = new SupabaseCloudSaveService(
    { url: env.supabaseUrl, anonKey: env.anonKey },
    build,
    {
      storage,
      resolveBinding: async () => ({
        sessionId,
        userId: user.userId,
        accessToken: user.token,
      }),
      reconcileObserver: (decision) => decisions.push(decision),
    },
  )
  return {
    service,
    journal: new PendingSaveJournal(environmentId, { storage }),
    acked: new AckedSaveCache(environmentId, { storage }),
    binding: { environmentId, userId: user.userId, characterId: character.id },
    decisions,
  }
}

export function makeCoordinator(h: JournalHarness): CloudSaveCoordinator {
  return new CloudSaveCoordinator(h.service)
}

// Acceptance seed: the load-side replay of a durable pending record whose
// mutation already committed; returns the load result + reconcile decision.
export async function retrySameMutationAfterLostAck(h: JournalHarness) {
  const load = await h.service.load()
  return { load, decision: h.decisions.at(-1) ?? null }
}

// Acceptance seed: the authoritative save_revision as the server stores it.
export async function readServerRevision(pg: Client, characterId: string): Promise<number | null> {
  const row = await saveRow(pg, characterId)
  return row ? row.save_revision : null
}
