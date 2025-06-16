export default {
  declaration: true,
  entries: [
    'src/module',
    'src/cli'
  ],
  externals: [
    '@nuxt/kit',
    '@nuxt/schema', 
    'nuxt'
  ]
}