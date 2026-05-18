// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // Pages in this test app use Nuxt's filename-as-route convention,
    // which produces single-word names like Index/About/Recipes.
    // The default vue/multi-word-component-names rule doesn't fit here.
    files: ['app/pages/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
