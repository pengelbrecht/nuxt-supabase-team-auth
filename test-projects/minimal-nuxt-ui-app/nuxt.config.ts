// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-supabase-team-auth',
  ],

  css: ['~/assets/css/main.css'],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2024-11-27',

  teamAuth: {
    redirectTo: '/dashboard',
    loginPage: '/signin',
    defaultProtection: 'public', // Most routes are public by default
    protectedRoutes: ['/dashboard'], // Only these routes require auth
    publicRoutes: ['/about', '/pricing'], // Additional public routes
    debug: true,
  },
})
