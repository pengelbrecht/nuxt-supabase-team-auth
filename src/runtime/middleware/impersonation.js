import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentRole, isImpersonating, isLoading } = useTeamAuth();
  if (isLoading.value) {
    let attempts = 0;
    while (isLoading.value && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
  }
  if (!currentUser.value) {
    return;
  }
  const currentPath = to.path;
  if (currentPath.includes("/impersonate") && !currentPath.includes("/stop")) {
    if (currentRole.value !== "super_admin") {
      return navigateTo("/dashboard?error=insufficient_permissions_for_impersonation");
    }
  }
  if (isImpersonating.value) {
    const blockedPaths = [
      "/admin/",
      "/super-admin/",
      "/impersonate/"
    ];
    const isBlockedPath = blockedPaths.some((path) => currentPath.startsWith(path));
    const isStopImpersonation = currentPath.includes("/impersonate/stop") || currentPath.includes("/stop-impersonation");
    if (isBlockedPath && !isStopImpersonation) {
      return navigateTo("/dashboard?error=admin_routes_blocked_during_impersonation");
    }
    const dangerousPaths = [
      "/settings/delete",
      "/settings/transfer",
      "/team/delete",
      "/billing/",
      "/api-keys/",
      "/security/"
    ];
    const isDangerousPath = dangerousPaths.some((path) => currentPath.includes(path));
    if (isDangerousPath) {
      return navigateTo("/dashboard?error=dangerous_operations_blocked_during_impersonation");
    }
  }
});
export const requireSuperAdminForImpersonation = defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentRole, isLoading } = useTeamAuth();
  if (isLoading.value) {
    let attempts = 0;
    while (isLoading.value && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
  }
  if (!currentUser.value) {
    const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
    return navigateTo(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  if (currentRole.value !== "super_admin") {
    return navigateTo("/dashboard?error=super_admin_required");
  }
});
export const blockDuringImpersonation = defineNuxtRouteMiddleware(async (_to) => {
  const { isImpersonating, isLoading } = useTeamAuth();
  if (isLoading.value) {
    let attempts = 0;
    while (isLoading.value && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
  }
  if (isImpersonating.value) {
    return navigateTo("/dashboard?error=action_blocked_during_impersonation");
  }
});
export function createImpersonationRestriction(options = {}) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentRole, isImpersonating, isLoading } = useTeamAuth();
    if (isLoading.value) {
      let attempts = 0;
      while (isLoading.value && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
    }
    if (!currentUser.value) {
      return;
    }
    const currentPath = to.path;
    if (options.checkSuperAdmin && currentRole.value !== "super_admin") {
      const redirectTo = options.redirectTo || "/dashboard";
      const errorParam = options.errorMessage || "super_admin_required";
      return navigateTo(`${redirectTo}?error=${errorParam}`);
    }
    if (isImpersonating.value) {
      const blockedPaths = options.blockedPaths || [];
      const allowedPaths = options.allowedPaths || [];
      const isAllowed = allowedPaths.some((path) => currentPath.startsWith(path));
      if (isAllowed) {
        return;
      }
      const isBlocked = blockedPaths.some((path) => currentPath.startsWith(path));
      if (isBlocked) {
        const redirectTo = options.redirectTo || "/dashboard";
        const errorParam = options.errorMessage || "access_blocked_during_impersonation";
        return navigateTo(`${redirectTo}?error=${errorParam}`);
      }
    }
  });
}
