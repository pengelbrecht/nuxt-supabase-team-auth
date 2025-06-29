import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
export default defineNuxtRouteMiddleware(async (to) => {
  const { currentUser, isLoading } = useTeamAuth();
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
      console.warn("[Team Auth] Auth loading timeout in require-auth middleware, proceeding anyway");
    }
  }
  if (!currentUser.value) {
    const config = useRuntimeConfig();
    const loginPage = config.public.teamAuth?.loginPage || "/signin";
    const redirectUrl = `${to.path}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`);
  }
});
