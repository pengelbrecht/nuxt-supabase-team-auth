<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <SignedIn>
          <UCard>
            <template #header>
              <h1 class="text-2xl font-bold">
                Recipes (deep protected route)
              </h1>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Used to reproduce the hard-nav auth race (gh #52).
              </p>
            </template>

            <div data-testid="recipes-loaded" class="space-y-2">
              <p><strong>selected:</strong> {{ route.query.selected ?? '(none)' }}</p>
              <p><strong>tab:</strong> {{ route.query.tab ?? '(none)' }}</p>
              <p><strong>user:</strong> {{ currentUser?.email }}</p>
            </div>
          </UCard>
        </SignedIn>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const { currentUser } = useTeamAuth()
</script>
