import type { AuthService } from './AuthService'
import { backendBundle } from '../backend/backendBundle'

// B1.2 - the mode decision lives in the single composition root
// (services/backend/backendBundle.ts); factories just re-export the
// bundle member so existing consumer imports keep working.
export const authService: AuthService = backendBundle.authService
