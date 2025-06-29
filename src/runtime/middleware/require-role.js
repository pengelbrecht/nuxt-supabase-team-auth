import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
const ROLE_HIERARCHY = {
  super_admin: 4,
  owner: 3,
  admin: 2,
  member: 1
};
export function createRequireRoleMiddleware(requiredRole, options = {}) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentRole, isLoading } = useTeamAuth();
    if (isLoading.value) {
      let attempts = 0;
      const maxAttempts = 20;
      while (isLoading.value && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
        if (currentUser.value !== void 0 && currentRole.value !== void 0) {
          break;
        }
      }
      if (isLoading.value && attempts >= maxAttempts) {
        console.warn("[Team Auth] Auth loading timeout in require-role middleware, proceeding anyway");
      }
    }
    if (!currentUser.value) {
      const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
      const config = useRuntimeConfig();
      const loginPage = config.public.teamAuth?.loginPage || "/signin";
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`);
    }
    if (!currentRole.value) {
      return navigateTo("/teams?message=select_team_first");
    }
    const userRoleLevel = ROLE_HIERARCHY[currentRole.value];
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];
    if (!userRoleLevel || !requiredRoleLevel) {
      console.error("Invalid role detected:", { userRole: currentRole.value, requiredRole });
      return navigateTo("/dashboard?error=invalid_role");
    }
    const hasPermission = options.strict ? userRoleLevel === requiredRoleLevel : userRoleLevel >= requiredRoleLevel;
    if (!hasPermission) {
      const redirectTo = options.redirectTo || "/dashboard";
      const errorParam = options.errorMessage || "insufficient_permissions";
      return navigateTo(`${redirectTo}?error=${errorParam}`);
    }
  });
}
export const requireAdmin = createRequireRoleMiddleware("admin");
export const requireOwner = createRequireRoleMiddleware("owner");
export const requireSuperAdmin = createRequireRoleMiddleware("super_admin");
export const requireAdminOnly = createRequireRoleMiddleware("admin", { strict: true });
export const requireOwnerOnly = createRequireRoleMiddleware("owner", { strict: true });
export const requireSuperAdminOnly = createRequireRoleMiddleware("super_admin", { strict: true });
export default defineNuxtRouteMiddleware(async (to, _from) => {
  const requiredRole = to.meta.requireRole;
  if (!requiredRole) {
    console.warn("require-role middleware used without specifying required role in route meta");
    return;
  }
  const middleware = createRequireRoleMiddleware(requiredRole);
  return middleware(to, _from);
});
