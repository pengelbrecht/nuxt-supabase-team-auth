export default defineNuxtConfig({
  modules: [
    './src/module',
  ],
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  css: ['~/assets/css/main.css'],
  teamAuth: {
    debug: true,
  },
})
