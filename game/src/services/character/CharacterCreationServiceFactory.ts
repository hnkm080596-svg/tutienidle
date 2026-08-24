import type { CharacterCreationService } from './CharacterCreationService'
import { characterCreationService as mockCharacterCreationService } from './MockCharacterCreationService'
import { SupabaseCharacterCreationService } from './SupabaseCharacterCreationService'
import { getSupabaseConfig } from '../supabase/SupabaseConfig'

const config = getSupabaseConfig()
export const characterCreationService: CharacterCreationService = config
  ? new SupabaseCharacterCreationService(config)
  : mockCharacterCreationService
