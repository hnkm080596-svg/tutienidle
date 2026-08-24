import type { AuthService } from './AuthService'
import { authService as mockAuthService } from './MockAuthService'
import { SupabaseAuthService } from './SupabaseAuthService'
import { getSupabaseConfig } from '../supabase/SupabaseConfig'

const config = getSupabaseConfig()
export const authService: AuthService = config ? new SupabaseAuthService(config) : mockAuthService
