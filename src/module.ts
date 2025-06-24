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
      nuxt: '^3.0.0',
    },
  },
  defaults: {
    debug: undefined, // Will be auto-detected based on Nuxt dev mode
    redirectTo: '/dashboard',
    emailTemplates: {},
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Merge options with runtime config
    // Debug mode hierarchy: explicit option > env var > nuxt dev mode
    const debugMode = options.debug !== undefined 
      ? options.debug 
      : process.env.TEAM_AUTH_DEBUG === 'true' 
        ? true 
        : nuxt.options.dev
    
    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl: options.supabaseUrl || process.env.SUPABASE_URL,
        supabaseKey: options.supabaseKey || process.env.SUPABASE_ANON_KEY,
        debug: debugMode,
        redirectTo: options.redirectTo,
      },
    )

    // Add plugin for Supabase client initialization
    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.client.ts'),
      mode: 'client',
    })

    // Add server plugin for SSR
    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.server.ts'),
      mode: 'server',
    })

    // Add composables
    addImports([
      {
        name: 'useTeamAuth',
        from: resolver.resolve('./runtime/composables/useTeamAuth'),
      },
      {
        name: 'useSupabaseClient',
        from: resolver.resolve('./runtime/composables/useSupabaseClient'),
      },
      {
        name: 'useImpersonation',
        from: resolver.resolve('./runtime/composables/useImpersonation'),
      },
      {
        name: 'useSession',
        from: resolver.resolve('./runtime/composables/useSession'),
      },
      {
        name: 'useTeamAuthConfig',
        from: resolver.resolve('./runtime/composables/useTeamAuthConfig'),
      },
      {
        name: 'usePerformance',
        from: resolver.resolve('./runtime/composables/usePerformance'),
      },
    ])

    // Add components directory
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      prefix: '',
    })

    // Add CSS for components - only our custom styles, not conflicting with Nuxt UI
    nuxt.options.css = nuxt.options.css || []
    nuxt.options.css.push(resolver.resolve('./runtime/assets/css/components.css'))

    // Add server API routes
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.handlers = nitroConfig.handlers || []

      // Add impersonation API endpoints
      nitroConfig.handlers.push({
        route: '/api/impersonate',
        method: 'post',
        handler: resolver.resolve('./runtime/server/api/impersonate.post.ts'),
      })

      nitroConfig.handlers.push({
        route: '/api/stop-impersonation',
        method: 'post',
        handler: resolver.resolve('./runtime/server/api/stop-impersonation.post.ts'),
      })
    })

    // Add type declarations
    nuxt.hook('prepare:types', (options) => {
      options.references.push({
        path: resolver.resolve('./runtime/types/index.d.ts'),
      })
    })
  },
})
