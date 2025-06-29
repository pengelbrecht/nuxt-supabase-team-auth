/**
 * Middleware to handle impersonation restrictions
 * Blocks certain routes during impersonation and validates impersonation permissions
 */
declare const _default: any;
export default _default;
/**
 * Middleware specifically for impersonation start routes
 */
export declare const requireSuperAdminForImpersonation: any;
/**
 * Middleware to block access during impersonation
 */
export declare const blockDuringImpersonation: any;
/**
 * Create custom impersonation restriction middleware
 * @param options Configuration options
 * @param options.blockedPaths Array of paths to block during impersonation
 * @param options.allowedPaths Array of paths to allow during impersonation (overrides blockedPaths)
 * @param options.redirectTo Path to redirect to when access is blocked
 * @param options.errorMessage Custom error message to display
 * @param options.checkSuperAdmin Whether to also check if user is a super admin
 */
export declare function createImpersonationRestriction(options?: {
    blockedPaths?: string[];
    allowedPaths?: string[];
    redirectTo?: string;
    errorMessage?: string;
    checkSuperAdmin?: boolean;
}): any;
//# sourceMappingURL=impersonation.d.ts.map