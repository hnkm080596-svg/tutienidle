import type { TalentDefinition } from '@/core/talent/Talent'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { readSupabaseSession } from '../supabase/SupabaseSession'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import {
  validateCharacterCreationDraft,
  type CharacterCreationDraft,
  type CharacterCreationResult,
  type CharacterCreationService,
  type CharacterCreationValidation,
} from './CharacterCreationService'

interface TalentRollResponse { rollId: string; talents: TalentDefinition[] }

export class SupabaseCharacterCreationService implements CharacterCreationService {
  private rollId: string | null = null
  private availableTalentIds = new Set<string>()

  constructor(private readonly config: SupabaseConfig) {}

  private session() {
    const session = readSupabaseSession()
    if (!session) throw new Error('Authentication session is missing')
    return session
  }

  async rollTalents(): Promise<TalentDefinition[]> {
    const session = this.session()
    const response = await requestSupabase<TalentRollResponse>(this.config, '/rest/v1/rpc/create_talent_roll', {
      method: 'POST', body: JSON.stringify({ p_session_id: session.sessionId }),
    }, session.accessToken)
    this.rollId = response.rollId
    this.availableTalentIds = new Set(response.talents.map(talent => talent.id))
    return response.talents
  }

  async checkNameAvailable(name: string): Promise<boolean> {
    const session = this.session()
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
      const session = this.session()
      const available = await this.checkNameAvailable(draft.name)
      if (!available) return { ok: false, code: 'name_taken', message: 'Đạo danh này đã có chủ.' }
      const characterId = await requestSupabase<string>(this.config, '/rest/v1/rpc/create_character', {
        method: 'POST',
        body: JSON.stringify({
          p_session_id: session.sessionId,
          p_roll_id: this.rollId,
          p_name: draft.name,
          p_talent_ids: draft.talentIds,
          p_attributes: draft.attributes,
          p_initial_save: {},
          // Trước đây hardcode 39 trong khi CURRENT_SAVE_VERSION đã lên 40 —
          // nhân vật tạo qua cloud sẽ bị chặn "incompatible" ngay lần load.
          // Luôn gửi version schema hiện hành từ SaveSystem (nguồn duy nhất).
          p_schema_version: CURRENT_SAVE_VERSION,
        }),
      }, session.accessToken)
      this.rollId = null
      return { ok: true, characterId }
    } catch (error) {
      if (error instanceof SupabaseHttpError && error.status === 409) {
        return { ok: false, code: 'name_taken', message: 'Đạo danh này đã có chủ.' }
      }
      return { ok: false, code: 'server_unavailable', message: 'Không thể tạo nhân vật. Vui lòng thử lại.' }
    }
  }
}
