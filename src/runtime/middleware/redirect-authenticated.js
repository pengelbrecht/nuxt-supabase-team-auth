import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, currentTeam, isLoading } = useTeamAuth();
  if (isLoading.value) {
    let attempts = 0;
    const maxAttempts = 20;
    while (isLoading.value && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
      if (currentUser.value !== void 0) {
        break;
      }
    }
    if (isLoading.value && attempts >= maxAttempts) {
      console.warn("[Team Auth] Auth loading timeout in redirect middleware, proceeding anyway");
    }
  }
  if (currentUser.value) {
    const redirectTo = to.query.redirect;
    if (redirectTo) {
      try {
        const url = new URL(redirectTo, window.location.origin);
        if (url.origin === window.location.origin) {
          return navigateTo(redirectTo);
        }
      } catch {
      }
    }
    if (currentTeam.value) {
      return navigateTo("/dashboard");
    } else {
      return navigateTo("/teams");
    }
  }
});
export function createRedirectAuthenticated(redirectTo, condition) {
  return defineNuxtRouteMiddleware(async (to) => {
    const { currentUser, currentTeam, isLoading } = useTeamAuth();
    if (isLoading.value) {
      let attempts = 0;
      const maxAttempts = 20;
      while (isLoading.value && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
        if (currentUser.value !== void 0) {
          break;
        }
      }
      if (isLoading.value && attempts >= maxAttempts) {
        console.warn("[Team Auth] Auth loading timeout in custom redirect middleware, proceeding anyway");
      }
    }
    if (currentUser.value) {
      if (condition && !condition(currentUser.value, currentTeam.value, to)) {
        return;
      }
      const url = typeof redirectTo === "function" ? redirectTo(currentUser.value, currentTeam.value) : redirectTo;
      return navigateTo(url);
    }
  });
}
export const redirectToDashboard = createRedirectAuthenticated("/dashboard");
export const redirectToTeams = createRedirectAuthenticated("/teams");
export const redirectBasedOnTeam = createRedirectAuthenticated(
  (user, team) => team ? "/dashboard" : "/teams"
);
