/**
 * Middleware to redirect authenticated users away from auth pages
 * Useful for login/signup pages that authenticated users shouldn't see
 */
declare const _default: any;
export default _default;
/**
 * Create custom redirect middleware for authenticated users
 * @param redirectTo Where to redirect authenticated users
 * @param condition Optional condition function to determine if redirect should happen
 */
export declare function createRedirectAuthenticated(redirectTo: string | ((user: any, team: any) => string), condition?: (user: any, team: any, route: any) => boolean): any;
/**
 * Predefined redirect middleware variants
 */
export declare const redirectToDashboard: any;
export declare const redirectToTeams: any;
export declare const redirectBasedOnTeam: any;
//# sourceMappingURL=redirect-authenticated.d.ts.map