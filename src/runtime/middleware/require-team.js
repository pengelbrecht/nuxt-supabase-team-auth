import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentTeam, currentRole, isLoading } = useTeamAuth();
  if (isLoading.value) {
    let attempts = 0;
    const maxAttempts = 20;
    while (isLoading.value && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
      if (currentUser.value !== void 0 && currentTeam.value !== void 0) {
        break;
      }
    }
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn("[Team Auth] Auth loading timeout in require-team middleware, proceeding anyway");
    }
  }
  if (!currentUser.value) {
    const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
    const config = useRuntimeConfig();
    const loginPage = config.public.teamAuth?.loginPage || "/signin";
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  if (!currentTeam.value || !currentRole.value) {
    return navigateTo("/teams?message=select_team_first");
  }
  const teamIdFromRoute = to.params.teamId;
  if (teamIdFromRoute && teamIdFromRoute !== currentTeam.value.id) {
    return navigateTo("/teams?error=unauthorized_team_access");
  }
});
export function createTeamAccessMiddleware(options = {}) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentTeam, currentRole, isLoading } = useTeamAuth();
    if (isLoading.value) {
      let attempts = 0;
      const maxAttempts = 20;
      while (isLoading.value && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
        if (currentUser.value !== void 0 && currentTeam.value !== void 0) {
          break;
        }
      }
      if (isLoading.value && attempts >= maxAttempts) {
        console.warn("[Team Auth] Auth loading timeout in require-team custom middleware, proceeding anyway");
      }
    }
    if (!currentUser.value) {
      const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
      const config = useRuntimeConfig();
      const loginPage = config.public.teamAuth?.loginPage || "/signin";
      return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`);
    }
    if (!options.allowAnyTeam && (!currentTeam.value || !currentRole.value)) {
      return navigateTo("/teams?message=select_team_first");
    }
    const teamIdFromRoute = to.params.teamId;
    if (teamIdFromRoute) {
      if (currentTeam.value && teamIdFromRoute !== currentTeam.value.id) {
        const redirectTo = options.redirectTo || "/teams";
        const errorParam = options.errorMessage || "unauthorized_team_access";
        return navigateTo(`${redirectTo}?error=${errorParam}`);
      }
      if (!currentTeam.value) {
        return navigateTo(`/teams/${teamIdFromRoute}/join`);
      }
      if (options.validateMembership && currentUser.value && currentTeam.value) {
        try {
          const isValidMember = currentRole.value !== null;
          if (!isValidMember) {
            return navigateTo("/teams?error=membership_invalid");
          }
        } catch (error) {
          console.error("Team membership validation failed:", error);
          return navigateTo("/teams?error=validation_failed");
        }
      }
    }
  });
}
export const requireTeamMembership = createTeamAccessMiddleware();
export const requireAnyTeam = createTeamAccessMiddleware({ allowAnyTeam: true });
export const requireValidatedTeam = createTeamAccessMiddleware({ validateMembership: true });
