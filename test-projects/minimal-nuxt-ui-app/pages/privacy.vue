<template>
  <div class="container mx-auto py-8">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">Privacy Policy</h1>
      </template>

      <div class="prose">
        <p>
          This is a test page to verify the defaultProtection: 'public' bug fix.
        </p>
        <p>
          This route (/privacy) is NOT in the protectedRoutes array and NOT in the publicRoutes array.
        </p>
        <p>
          With defaultProtection: 'public', this page should be accessible without authentication.
        </p>
        <p>
          <strong>Bug scenario:</strong> Previously, this page would require authentication
          because the middleware used a whitelist approach instead of properly implementing
          public-by-default behavior.
        </p>

        <div class="mt-6 p-4 bg-green-100 rounded-lg">
          <p class="text-green-800 font-semibold">
            ✅ If you can see this page without being logged in, the bug is fixed!
          </p>
        </div>

        <div class="mt-4">
          <p><strong>Test navigation:</strong></p>
          <ul class="list-disc list-inside">
            <li><NuxtLink to="/" class="text-blue-600 hover:underline">Home (always public)</NuxtLink></li>
            <li><NuxtLink to="/about" class="text-blue-600 hover:underline">About (explicitly public)</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="text-blue-600 hover:underline">Privacy (should be public by default)</NuxtLink></li>
            <li><NuxtLink to="/dashboard" class="text-blue-600 hover:underline">Dashboard (should require auth)</NuxtLink></li>
          </ul>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
// This page tests the bug fix for defaultProtection: 'public'
// It should be accessible without authentication since it's not in protectedRoutes
</script>