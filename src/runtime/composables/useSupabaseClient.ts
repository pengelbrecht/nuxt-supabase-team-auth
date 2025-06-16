export function useSupabaseClient() {
  const { $teamAuthClient } = useNuxtApp()
  return $teamAuthClient
}