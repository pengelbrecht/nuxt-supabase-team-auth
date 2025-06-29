/**
 * Team Auth Middleware Index
 *
 * Centralized exports for all authentication and authorization middleware
 */
export { default as authGlobal } from './auth.global.js';
export { default as requireAuth } from './require-auth.js';
export { default as requireRole } from './require-role.js';
export { default as requireTeam } from './require-team.js';
export { default as redirectAuthenticated } from './redirect-authenticated.js';
export { default as impersonation } from './impersonation.js';
export { createRequireRoleMiddleware, requireAdmin, requireOwner, requireSuperAdmin, requireAdminOnly, requireOwnerOnly, requireSuperAdminOnly, } from './require-role.js';
export { createTeamAccessMiddleware, requireTeamMembership, requireAnyTeam, requireValidatedTeam, } from './require-team.js';
export { createRedirectAuthenticated, redirectToDashboard, redirectToTeams, redirectBasedOnTeam, } from './redirect-authenticated.js';
export { requireSuperAdminForImpersonation, blockDuringImpersonation, createImpersonationRestriction, } from './impersonation.js';
/**
 * Middleware configuration object for easy setup
 */
export declare const middlewareConfig: {
    global: {
        auth: string;
    };
    named: {
        requireAuth: string;
        redirectAuth: string;
        requireAdmin: string;
        requireOwner: string;
        requireSuperAdmin: string;
        requireTeam: string;
        requireTeamMembership: string;
        impersonation: string;
        requireSuperAdminForImpersonation: string;
        blockDuringImpersonation: string;
    };
};
/**
 * Common middleware combinations for different route types
 */
export declare const middlewareCombinations: {
    public: string[];
    protected: string[];
    dashboard: string[];
    teamAdmin: string[];
    teamOwner: string[];
    superAdmin: string[];
    impersonation: string[];
    sensitive: string[];
};
/**
 * Utility function to get middleware array for a route type
 * @param type The route type from middlewareCombinations
 * @returns Array of middleware names
 */
export declare function getMiddlewareForRoute(type: keyof typeof middlewareCombinations): string[];
/**
 * Route protection helper for definePageMeta
 * @param protection Protection level or custom middleware array
 * @returns Object for definePageMeta
 */
export declare function defineRouteProtection(protection: keyof typeof middlewareCombinations | string[]): {
    middleware: string[];
};
/**
 * Quick protection shortcuts
 */
export declare const protect: {
    public: () => {
        middleware: string[];
    };
    auth: () => {
        middleware: string[];
    };
    dashboard: () => {
        middleware: string[];
    };
    teamAdmin: () => {
        middleware: string[];
    };
    teamOwner: () => {
        middleware: string[];
    };
    superAdmin: () => {
        middleware: string[];
    };
    impersonation: () => {
        middleware: string[];
    };
    sensitive: () => {
        middleware: string[];
    };
    custom: (middleware: string[]) => {
        middleware: string[];
    };
};
/**
 * Type definitions for middleware options
 */
export interface MiddlewareOptions {
    redirectTo?: string;
    errorMessage?: string;
    strict?: boolean;
    allowAnyTeam?: boolean;
    validateMembership?: boolean;
    checkSuperAdmin?: boolean;
    blockedPaths?: string[];
    allowedPaths?: string[];
}
/**
 * Middleware factory for creating custom middleware with options
 */
export declare const createMiddleware: {
    requireRole: (role: string, options?: MiddlewareOptions) => any;
    teamAccess: (options?: MiddlewareOptions) => any;
    redirectAuth: (redirectTo: string | (() => string), condition?: () => boolean) => any;
    impersonationRestriction: (options?: MiddlewareOptions) => any;
};
//# sourceMappingURL=index.d.ts.map