/**
 * Middleware to require team membership
 * Ensures user belongs to a team and optionally validates team ID from route
 */
declare const _default: any;
export default _default;
/**
 * Create middleware that validates specific team access
 * @param options Configuration options
 * @param options.allowAnyTeam If true, allows access to any team the user is a member of
 * @param options.redirectTo Path to redirect to when access is denied
 * @param options.errorMessage Custom error message to display
 * @param options.validateMembership If true, validates user is a member of the specified team
 */
export declare function createTeamAccessMiddleware(options?: {
    allowAnyTeam?: boolean;
    redirectTo?: string;
    errorMessage?: string;
    validateMembership?: boolean;
}): any;
/**
 * Predefined team access middleware variants
 */
export declare const requireTeamMembership: any;
export declare const requireAnyTeam: any;
export declare const requireValidatedTeam: any;
//# sourceMappingURL=require-team.d.ts.map