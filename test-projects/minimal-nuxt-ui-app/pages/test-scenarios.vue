<template>
  <div class="container mx-auto py-8 space-y-6">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Bug Fix Test Scenarios</h1>
      </template>

      <div class="space-y-4">
        <div class="p-4 bg-blue-50 rounded-lg">
          <h2 class="text-lg font-semibold text-blue-800">Current Configuration</h2>
          <div class="mt-2 text-sm">
            <p><strong>defaultProtection:</strong> 'public'</p>
            <p><strong>protectedRoutes:</strong> ['/dashboard']</p>
            <p><strong>publicRoutes:</strong> ['/about', '/pricing']</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UCard variant="subtle">
            <template #header>
              <h3 class="text-lg font-semibold text-green-700">
                ✅ Should Be Accessible (No Auth Required)
              </h3>
            </template>
            <div class="space-y-2">
              <p class="text-sm text-gray-600">These routes should be accessible without authentication:</p>
              <ul class="space-y-1">
                <li><NuxtLink to="/" class="text-blue-600 hover:underline">/ (always public)</NuxtLink></li>
                <li><NuxtLink to="/signin" class="text-blue-600 hover:underline">/signin (auth route)</NuxtLink></li>
                <li><NuxtLink to="/about" class="text-blue-600 hover:underline">/about (explicitly public)</NuxtLink></li>
                <li><NuxtLink to="/pricing" class="text-blue-600 hover:underline">/pricing (explicitly public)</NuxtLink></li>
                <li><NuxtLink to="/privacy" class="text-blue-600 hover:underline">/privacy (public by default - THE BUG FIX)</NuxtLink></li>
                <li><NuxtLink to="/test-scenarios" class="text-blue-600 hover:underline">/test-scenarios (public by default)</NuxtLink></li>
              </ul>
            </div>
          </UCard>

          <UCard variant="subtle">
            <template #header>
              <h3 class="text-lg font-semibold text-red-700">
                🔒 Should Require Authentication
              </h3>
            </template>
            <div class="space-y-2">
              <p class="text-sm text-gray-600">These routes should redirect to login:</p>
              <ul class="space-y-1">
                <li><NuxtLink to="/dashboard" class="text-blue-600 hover:underline">/dashboard (explicitly protected)</NuxtLink></li>
              </ul>
            </div>
          </UCard>
        </div>

        <div class="p-4 bg-yellow-50 rounded-lg">
          <h3 class="text-lg font-semibold text-yellow-800">Bug Verification</h3>
          <div class="mt-2 text-sm">
            <p><strong>The Bug:</strong> Before the fix, routes like /privacy that weren't in any configuration array would require authentication, contradicting the "public by default" behavior.</p>
            <p class="mt-2"><strong>The Fix:</strong> Now routes not in protectedRoutes are truly public by default when defaultProtection: 'public'.</p>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-xl font-bold">Test Instructions</h2>
      </template>

      <div class="prose">
        <ol class="list-decimal list-inside space-y-2">
          <li>Visit each link in the "Should Be Accessible" section - you should see the pages without being prompted to log in</li>
          <li>Visit the /dashboard link - you should be redirected to the sign-in page</li>
          <li>Pay special attention to /privacy - this tests the specific bug scenario</li>
          <li>Try accessing a route that doesn't exist like /random-route - it should also be public by default</li>
        </ol>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// Test page to verify the defaultProtection: 'public' bug fix
</script>