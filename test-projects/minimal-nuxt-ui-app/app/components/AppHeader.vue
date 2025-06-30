<template>
  <header class="bg-white dark:bg-gray-800 shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <!-- Logo/Brand -->
        <div class="flex items-center">
          <NuxtLink
            to="/"
            class="text-xl font-bold text-gray-900 dark:text-gray-100"
          >
            Team Auth Test
          </NuxtLink>
        </div>

        <!-- Navigation -->
        <nav class="hidden md:flex items-center space-x-6">
          <NuxtLink
            to="/"
            class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium"
            active-class="text-gray-900 dark:text-gray-100"
          >
            Home
          </NuxtLink>

          <NuxtLink
            to="/dashboard"
            class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium"
            active-class="text-gray-900 dark:text-gray-100"
          >
            Dashboard
          </NuxtLink>
        </nav>

        <!-- User Menu -->
        <div class="flex items-center space-x-4">
          <SignedOut>
            <div class="flex space-x-2">
              <UButton
                to="/signin"
                variant="ghost"
                size="sm"
              >
                Sign In
              </UButton>
              <UButton
                to="/signup"
                size="sm"
              >
                Sign Up
              </UButton>
            </div>
          </SignedOut>

          <SignedIn>
            <UserButton :show-name="true" />
          </SignedIn>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden">
          <UButton
            variant="ghost"
            icon="i-lucide-menu"
            size="sm"
            @click="mobileMenuOpen = !mobileMenuOpen"
          />
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div
        v-if="mobileMenuOpen"
        class="md:hidden"
      >
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NuxtLink
            to="/"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Home
          </NuxtLink>

          <NuxtLink
            to="/dashboard"
            class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Dashboard
          </NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
const mobileMenuOpen = ref(false)
</script>
