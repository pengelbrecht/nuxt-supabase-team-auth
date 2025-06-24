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
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
    redirectTo: '/dashboard',
    loginPage: '/', // Redirect to home page instead of /signin
    debug: true,
  },
})
