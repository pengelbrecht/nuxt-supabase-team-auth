export { default as authGlobal } from "./auth.global.js";
export { default as requireAuth } from "./require-auth.js";
export { default as requireRole } from "./require-role.js";
export { default as requireTeam } from "./require-team.js";
export { default as redirectAuthenticated } from "./redirect-authenticated.js";
export { default as impersonation } from "./impersonation.js";
export {
  createRequireRoleMiddleware,
  requireAdmin,
  requireOwner,
  requireSuperAdmin,
  requireAdminOnly,
  requireOwnerOnly,
  requireSuperAdminOnly
} from "./require-role.js";
export {
  createTeamAccessMiddleware,
  requireTeamMembership,
  requireAnyTeam,
  requireValidatedTeam
} from "./require-team.js";
export {
  createRedirectAuthenticated,
  redirectToDashboard,
  redirectToTeams,
  redirectBasedOnTeam
} from "./redirect-authenticated.js";
export {
  requireSuperAdminForImpersonation,
  blockDuringImpersonation,
  createImpersonationRestriction
} from "./impersonation.js";
export const middlewareConfig = {
  // Global middleware (runs on every route)
  global: {
    auth: "auth.global"
  },
  // Named middleware for specific routes
  named: {
    // Authentication
    requireAuth: "require-auth",
    redirectAuth: "redirect-authenticated",
    // Role-based
    requireAdmin: "require-admin",
    requireOwner: "require-owner",
    requireSuperAdmin: "require-super-admin",
    // Team-based
    requireTeam: "require-team",
    requireTeamMembership: "require-team-membership",
    // Impersonation
    impersonation: "impersonation",
    requireSuperAdminForImpersonation: "require-super-admin-for-impersonation",
    blockDuringImpersonation: "block-during-impersonation"
  }
};
export const middlewareCombinations = {
  // Public pages (login, signup, etc.)
  public: ["redirect-authenticated"],
  // Protected pages requiring authentication
  protected: ["require-auth"],
  // Dashboard and general team pages
  dashboard: ["require-auth", "require-team"],
  // Admin pages within a team
  teamAdmin: ["require-auth", "require-team", "require-admin"],
  // Owner-only pages
  teamOwner: ["require-auth", "require-team", "require-owner"],
  // Super admin pages
  superAdmin: ["require-auth", "require-super-admin"],
  // Impersonation pages
  impersonation: ["require-auth", "require-super-admin-for-impersonation"],
  // Sensitive operations (blocked during impersonation)
  sensitive: ["require-auth", "require-team", "block-during-impersonation"]
};
export function getMiddlewareForRoute(type) {
  return middlewareCombinations[type] || [];
}
export function defineRouteProtection(protection) {
  const middleware = Array.isArray(protection) ? protection : getMiddlewareForRoute(protection);
  return { middleware };
}
export const protect = {
  public: () => defineRouteProtection("public"),
  auth: () => defineRouteProtection("protected"),
  dashboard: () => defineRouteProtection("dashboard"),
  teamAdmin: () => defineRouteProtection("teamAdmin"),
  teamOwner: () => defineRouteProtection("teamOwner"),
  superAdmin: () => defineRouteProtection("superAdmin"),
  impersonation: () => defineRouteProtection("impersonation"),
  sensitive: () => defineRouteProtection("sensitive"),
  custom: (middleware) => defineRouteProtection(middleware)
};
export const createMiddleware = {
  requireRole: (role, options) => createRequireRoleMiddleware(role, options),
  teamAccess: (options) => createTeamAccessMiddleware(options),
  redirectAuth: (redirectTo, condition) => createRedirectAuthenticated(redirectTo, condition),
  impersonationRestriction: (options) => createImpersonationRestriction(options)
};
