<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Nuxt Supabase Team Auth
          </h1>
          <p class="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Minimal test project for team-based authentication
          </p>
          
          <SignedOut>
            <div class="space-y-4">
              <p class="text-lg text-gray-700 dark:text-gray-300">
                Get started by signing in or creating an account
              </p>
              <div class="flex justify-center space-x-4">
                <UButton to="/signin" size="lg">
                  Sign In
                </UButton>
                <UButton to="/signup" variant="outline" size="lg">
                  Sign Up
                </UButton>
              </div>
            </div>
          </SignedOut>
          
          <SignedIn>
            <div class="space-y-4">
              <p class="text-lg text-gray-700 dark:text-gray-300">
                Welcome back! You're signed in.
              </p>
              <UButton to="/dashboard" size="lg">
                Go to Dashboard
              </UButton>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  </div>
</template>