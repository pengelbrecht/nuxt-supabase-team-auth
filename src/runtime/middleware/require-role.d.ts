type TeamRole = 'owner' | 'admin' | 'member' | 'super_admin';
/**
 * Create middleware that requires a specific role or higher
 * @param requiredRole The minimum role required
 * @param options Additional options
 * @param options.redirectTo Path to redirect to when access is denied
 * @param options.errorMessage Custom error message to display
 * @param options.strict If true, requires exact role match instead of minimum role
 */
export declare function createRequireRoleMiddleware(requiredRole: TeamRole, options?: {
    redirectTo?: string;
    errorMessage?: string;
    strict?: boolean;
}): any;
/**
 * Predefined role middleware
 */
export declare const requireAdmin: any;
export declare const requireOwner: any;
export declare const requireSuperAdmin: any;
/**
 * Strict role middleware (exact role match)
 */
export declare const requireAdminOnly: any;
export declare const requireOwnerOnly: any;
export declare const requireSuperAdminOnly: any;
/**
 * Default export for dynamic role checking
 */
declare const _default: any;
export default _default;
//# sourceMappingURL=require-role.d.ts.map