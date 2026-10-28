/**
 * True while the app is being rendered on the server (SSR).
 *
 * Route middleware use this to skip the wait for `isLoading`: the team-auth
 * state is only initialised in the browser (`initializeAuth()`), so on the
 * server `isLoading` stays `true` for the whole request and waiting on it only
 * delays the response.
 *
 * Kept as a function rather than reading `import.meta.server` inline so unit
 * tests can switch between server and client behaviour.
 */
export function isServerRender(): boolean {
  return Boolean(import.meta.server)
}
