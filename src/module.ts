import { defineNuxtModule, addPlugin, createResolver, addImports, addComponentsDir } from '@nuxt/kit'
import { defu } from 'defu'

export interface ModuleOptions {
  /**
   * Supabase project URL
   */
  supabaseUrl?: string
  /**
   * Supabase anon key
   */
  supabaseKey?: string
  /**
   * Enable debug mode
   */
  debug?: boolean
  /**
   * Redirect URL after authentication
   */
  redirectTo?: string
  /**
   * Custom email templates
   */
  emailTemplates?: {
    invite?: string
    welcome?: string
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-supabase-team-auth',
    configKey: 'teamAuth',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    debug: false,
    redirectTo: '/dashboard',
    emailTemplates: {}
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Merge options with runtime config
    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl: options.supabaseUrl || process.env.SUPABASE_URL,
        supabaseKey: options.supabaseKey || process.env.SUPABASE_ANON_KEY,
        debug: options.debug,
        redirectTo: options.redirectTo
      }
    )

    // Add plugin for Supabase client initialization
    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.client.ts'),
      mode: 'client'
    })

    // Add server plugin for SSR
    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.server.ts'),
      mode: 'server'
    })

    // Add composables
    addImports([
      {
        name: 'useTeamAuth',
        from: resolver.resolve('./runtime/composables/useTeamAuth')
      },
      {
        name: 'useSupabaseClient',
        from: resolver.resolve('./runtime/composables/useSupabaseClient')
      }
    ])

    // Add components directory
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      prefix: ''
    })

    // Add CSS for components - only our custom styles, not conflicting with Nuxt UI
    nuxt.options.css = nuxt.options.css || []
    nuxt.options.css.push(resolver.resolve('./runtime/assets/css/components.css'))

    // Add type declarations
    nuxt.hook('prepare:types', (options) => {
      options.references.push({
        path: resolver.resolve('./runtime/types/index.d.ts')
      })
    })
  }
})