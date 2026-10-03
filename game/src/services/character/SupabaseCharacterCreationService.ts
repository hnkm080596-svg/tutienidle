import type { TalentDefinition } from '@/core/talent/Talent'
import { BETA_MORTAL_STARTER_SKILL_ID, isBetaCreationTalentId } from '@/core/betaScope'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { resolveSupabaseSession, type StoredSupabaseSession } from '../supabase/SupabaseSession'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { parseRemoteCharacterMetadata, type RemoteCharacterMetadata } from '../session/BackendStatus'
import {
  CHARACTER_CREATION_ROLL_SIZE,
  validateCharacterCreationDraft,
  type CharacterCreationDraft,
  type CharacterCreationResult,
  type CharacterCreationService,
  type CharacterCreationValidation,
} from './CharacterCreationService'

interface TalentRollResponse { rollId: string; talents: TalentDefinition[] }

// B1.4 (beta-final PR3) - the PR2 five-arg metadata-only contract:
// create_character provisions the character row and returns its canonical
// metadata; it NEVER writes a save row. The client rebuilds the starter
// snapshot (initializeCharacter) and commits it through
// write_character_save(expectedRevision=0) -> revision 1, which precedes
// the first tick. A crash in between replays CHARACTER_UNINITIALIZED at
// the next boot with the same metadata - exactly one starter snapshot,
// never a reroll.
interface CreateCharacterResponse {
  status?: string
  character?: unknown
  code?: string
  serverTimeUtc?: string
}

function creationRejection(code: string | undefined): CharacterCreationResult {
  switch (code) {
    case 'CHARACTER_EXISTS':
      return { ok: false, code: 'character_exists', message: 'Nhân vật đã tồn tại trên máy chủ — tải lại để tiếp tục.' }
    case 'CHARACTER_NAME_UNAVAILABLE':
      return { ok: false, code: 'name_taken', message: 'Đạo danh này đã có chủ.' }
    case 'INVALID_TALENT_ROLL':
    case 'INVALID_TALENT_SELECTION':
      return { ok: false, code: 'invalid_talents', message: 'Lượt Thiên Phú đã hết hiệu lực.' }
    case 'INVALID_MORTAL_SKILL':
      return { ok: false, code: 'invalid_skill', message: 'Khởi thủy chiêu thức không hợp lệ.' }
    default:
      return { ok: false, code: 'server_unavailable', message: 'Không thể tạo nhân vật. Vui lòng thử lại.' }
  }
}

export class SupabaseCharacterCreationService implements CharacterCreationService {
  private rollId: string | null = null
  private availableTalentIds = new Set<string>()

  constructor(private readonly config: SupabaseConfig) {}

  private async session(): Promise<StoredSupabaseSession> {
    const session = await resolveSupabaseSession(this.config)
    if (!session) throw new Error('Authentication session is missing')
    return session
  }

  async rollTalents(): Promise<TalentDefinition[]> {
    const session = await this.session()
    const response = await requestSupabase<TalentRollResponse>(this.config, '/rest/v1/rpc/create_talent_roll', {
      method: 'POST', body: JSON.stringify({ p_session_id: session.sessionId }),
    }, session.accessToken)
    this.rollId = response.rollId
    // Beta scope: the server roll is the offer authority, but the
    // client boundary still admits only beta talents - a stale or
    // drifted server-side catalog can never surface an out-of-scope
    // pick to the UI or to validateDraft. Offer = first ROLL_SIZE of the
    // admitted roll (same weighted-no-replacement semantics as a 3-roll).
    const offered = response.talents
      .filter(talent => isBetaCreationTalentId(talent.id))
      .slice(0, CHARACTER_CREATION_ROLL_SIZE)
    this.availableTalentIds = new Set(offered.map(talent => talent.id))
    return offered
  }

  async checkNameAvailable(name: string): Promise<boolean> {
    const session = await this.session()
    return requestSupabase<boolean>(this.config, '/rest/v1/rpc/is_character_name_available', {
      method: 'POST', body: JSON.stringify({ p_session_id: session.sessionId, p_name: name }),
    }, session.accessToken)
  }

  validateDraft(draft: CharacterCreationDraft, availableTalentIds: ReadonlySet<string>): CharacterCreationValidation {
    return validateCharacterCreationDraft(draft, availableTalentIds)
  }

  async createCharacter(draft: CharacterCreationDraft): Promise<CharacterCreationResult> {
    const validation = this.validateDraft(draft, this.availableTalentIds)
    if (!validation.ok) return validation
    if (!this.rollId) return { ok: false, code: 'invalid_talents', message: 'Lượt Thiên Phú đã hết hiệu lực.' }

    try {
      const session = await this.session()
      const available = await this.checkNameAvailable(draft.name)
      if (!available) return { ok: false, code: 'name_taken', message: 'Đạo danh này đã có chủ.' }
      const response = await requestSupabase<CreateCharacterResponse>(this.config, '/rest/v1/rpc/create_character', {
        method: 'POST',
        body: JSON.stringify({
          p_session_id: session.sessionId,
          p_roll_id: this.rollId,
          p_name: draft.name,
          p_talent_ids: draft.talentIds,
          // Beta scope: the starter pick is server-side constant now -
          // the draft carries no pick, the client always declares
          // 'linh_bao' and the RPC rejects anything else.
          p_mortal_basic_skill_id: BETA_MORTAL_STARTER_SKILL_ID,
        }),
      }, session.accessToken)

      if (response.status === 'REJECTED') {
        return creationRejection(response.code)
      }

      const character = response.status === 'CREATED'
        ? parseRemoteCharacterMetadata(response.character)
        : null

      if (!character) {
        return { ok: false, code: 'server_unavailable', message: 'Máy chủ trả dữ liệu nhân vật không hợp lệ.' }
      }

      this.rollId = null
      return { ok: true, characterId: character.id, character }
    } catch (error) {
      if (error instanceof SupabaseHttpError && error.status === 409) {
        return { ok: false, code: 'name_taken', message: 'Đạo danh này đã có chủ.' }
      }
      return { ok: false, code: 'server_unavailable', message: 'Không thể tạo nhân vật. Vui lòng thử lại.' }
    }
  }
}
