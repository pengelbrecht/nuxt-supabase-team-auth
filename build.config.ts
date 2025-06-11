import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
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
})