// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  // Use app/ directory structure
  srcDir: 'app',

  // Explicitly enable SSR to test server-side authentication
  ssr: true,

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-supabase-team-auth',
  ],

  // Fix for @supabase/postgrest-js CommonJS/ESM import issues
  build: {
    transpile: ['@supabase/postgrest-js', '@supabase/supabase-js']
  },

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
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  },
})
