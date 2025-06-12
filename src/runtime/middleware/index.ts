/**
 * Team Auth Middleware Index
 * 
 * Centralized exports for all authentication and authorization middleware
 */

// Core middleware exports
export { default as authGlobal } from './auth.global'
export { default as requireAuth } from './require-auth'
export { default as requireRole } from './require-role'
export { default as requireTeam } from './require-team'
export { default as redirectAuthenticated } from './redirect-authenticated'
export { default as impersonation } from './impersonation'

// Role-specific middleware
export {
  createRequireRoleMiddleware,
  requireAdmin,
  requireOwner,
  requireSuperAdmin,
  requireAdminOnly,
  requireOwnerOnly,
  requireSuperAdminOnly
} from './require-role'

// Team-specific middleware
export {
  createTeamAccessMiddleware,
  requireTeamMembership,
  requireAnyTeam,
  requireValidatedTeam
} from './require-team'

// Redirect middleware variants
export {
  createRedirectAuthenticated,
  redirectToDashboard,
  redirectToTeams,
  redirectBasedOnTeam
} from './redirect-authenticated'

// Impersonation middleware
export {
  requireSuperAdminForImpersonation,
  blockDuringImpersonation,
  createImpersonationRestriction
} from './impersonation'

/**
 * Middleware configuration object for easy setup
 */
export const middlewareConfig = {
  // Global middleware (runs on every route)
  global: {
    auth: 'auth.global'
  },
  
  // Named middleware for specific routes
  named: {
    // Authentication
    requireAuth: 'require-auth',
    redirectAuth: 'redirect-authenticated',
    
    // Role-based
    requireAdmin: 'require-admin',
    requireOwner: 'require-owner',
    requireSuperAdmin: 'require-super-admin',
    
    // Team-based
    requireTeam: 'require-team',
    requireTeamMembership: 'require-team-membership',
    
    // Impersonation
    impersonation: 'impersonation',
    requireSuperAdminForImpersonation: 'require-super-admin-for-impersonation',
    blockDuringImpersonation: 'block-during-impersonation'
  }
}

/**
 * Common middleware combinations for different route types
 */
export const middlewareCombinations = {
  // Public pages (login, signup, etc.)
  public: ['redirect-authenticated'],
  
  // Protected pages requiring authentication
  protected: ['require-auth'],
  
  // Dashboard and general team pages
  dashboard: ['require-auth', 'require-team'],
  
  // Admin pages within a team
  teamAdmin: ['require-auth', 'require-team', 'require-admin'],
  
  // Owner-only pages
  teamOwner: ['require-auth', 'require-team', 'require-owner'],
  
  // Super admin pages
  superAdmin: ['require-auth', 'require-super-admin'],
  
  // Impersonation pages
  impersonation: ['require-auth', 'require-super-admin-for-impersonation'],
  
  // Sensitive operations (blocked during impersonation)
  sensitive: ['require-auth', 'require-team', 'block-during-impersonation']
}

/**
 * Utility function to get middleware array for a route type
 * @param type The route type from middlewareCombinations
 * @returns Array of middleware names
 */
export function getMiddlewareForRoute(type: keyof typeof middlewareCombinations): string[] {
  return middlewareCombinations[type] || []
}

/**
 * Route protection helper for definePageMeta
 * @param protection Protection level or custom middleware array
 * @returns Object for definePageMeta
 */
export function defineRouteProtection(
  protection: keyof typeof middlewareCombinations | string[]
): { middleware: string[] } {
  const middleware = Array.isArray(protection) 
    ? protection 
    : getMiddlewareForRoute(protection)
    
  return { middleware }
}

/**
 * Quick protection shortcuts
 */
export const protect = {
  public: () => defineRouteProtection('public'),
  auth: () => defineRouteProtection('protected'),
  dashboard: () => defineRouteProtection('dashboard'),
  teamAdmin: () => defineRouteProtection('teamAdmin'),
  teamOwner: () => defineRouteProtection('teamOwner'),
  superAdmin: () => defineRouteProtection('superAdmin'),
  impersonation: () => defineRouteProtection('impersonation'),
  sensitive: () => defineRouteProtection('sensitive'),
  custom: (middleware: string[]) => defineRouteProtection(middleware)
}

/**
 * Type definitions for middleware options
 */
export interface MiddlewareOptions {
  redirectTo?: string
  errorMessage?: string
  strict?: boolean
  allowAnyTeam?: boolean
  validateMembership?: boolean
  checkSuperAdmin?: boolean
  blockedPaths?: string[]
  allowedPaths?: string[]
}

/**
 * Middleware factory for creating custom middleware with options
 */
export const createMiddleware = {
  requireRole: (role: string, options?: MiddlewareOptions) => 
    createRequireRoleMiddleware(role as any, options),
    
  teamAccess: (options?: MiddlewareOptions) => 
    createTeamAccessMiddleware(options),
    
  redirectAuth: (redirectTo: string | Function, condition?: Function) => 
    createRedirectAuthenticated(redirectTo as any, condition),
    
  impersonationRestriction: (options?: MiddlewareOptions) => 
    createImpersonationRestriction(options)
}