import { useTeamAuth } from "../composables/useTeamAuth.js";
import { navigateTo } from "#app";
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const { currentUser, currentTeam, currentRole, isLoading, isImpersonating } = useTeamAuth();
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
      console.warn("[Team Auth] Auth loading timeout in middleware, proceeding anyway");
    }
  }
  const protectedRoutes = [
    "/dashboard",
    "/team",
    "/teams",
    "/admin",
    "/profile",
    "/settings"
  ];
  const publicRoutes = [
    "/",
    "/login",
    "/signin",
    "/signup",
    "/auth",
    "/confirm",
    "/reset-password",
    "/forgot-password",
    "/accept-invite",
    "/about",
    "/contact",
    "/privacy",
    "/terms"
  ];
  const currentPath = to.path;
  if (currentPath.includes("/auth/")) {
    console.log("[Auth Middleware] Path:", currentPath);
    console.log("[Auth Middleware] Checking public routes:", publicRoutes);
  }
  const isPublicRoute = publicRoutes.some(
    (route) => currentPath === route || currentPath.startsWith(route + "/")
  );
  if (currentPath.includes("/auth/")) {
    console.log("[Auth Middleware] isPublicRoute:", isPublicRoute);
  }
  if (isPublicRoute) {
    if (currentPath.includes("/auth/")) {
      console.log("[Auth Middleware] Allowing public route:", currentPath);
    }
    return;
  }
  const isProtectedRoute = protectedRoutes.some(
    (route) => currentPath.startsWith(route)
  );
  if (isProtectedRoute && !currentUser.value) {
    const redirectUrl = `${currentPath}${to.search ? `?${new URLSearchParams(to.query).toString()}` : ""}`;
    const config = useRuntimeConfig();
    const loginPage = config.public.teamAuth?.loginPage || "/signin";
    return navigateTo(`${loginPage}?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  if (isImpersonating.value) {
    if (currentPath.startsWith("/admin/") && !currentPath.includes("/impersonate/stop")) {
      return navigateTo("/dashboard?error=admin_blocked_during_impersonation");
    }
  }
  if (currentPath.includes("/admin/impersonate") || currentPath.includes("/impersonate")) {
    if (currentRole.value !== "super_admin") {
      return navigateTo("/dashboard?error=insufficient_permissions");
    }
  }
  if (currentPath.startsWith("/teams/") && currentPath !== "/teams") {
    const teamIdFromRoute = currentPath.split("/teams/")[1]?.split("/")[0];
    if (teamIdFromRoute && currentTeam.value?.id !== teamIdFromRoute) {
      return navigateTo("/teams?error=unauthorized_team_access");
    }
  }
  const teamRequiredRoutes = ["/team/", "/dashboard"];
  const requiresTeam = teamRequiredRoutes.some((route) => currentPath.startsWith(route));
  if (requiresTeam && currentUser.value && !currentTeam.value) {
    return navigateTo("/teams?message=select_team_first");
  }
});
