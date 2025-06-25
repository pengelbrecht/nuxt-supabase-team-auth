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

    // Note: Consumer must add '@nuxt/ui' to their modules array
    // Auto-installation doesn't properly initialize context providers

    // Merge options with runtime config
    // Debug mode hierarchy: explicit option > env var > nuxt dev mode
    const debugMode = options.debug !== undefined
      ? options.debug
      : process.env.TEAM_AUTH_DEBUG === 'true'
        ? true
        : nuxt.options.dev

    // Set up runtime config for both client and server
    nuxt.options.runtimeConfig = defu(nuxt.options.runtimeConfig, {
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    })

    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl: options.supabaseUrl || process.env.SUPABASE_URL,
        supabaseKey: options.supabaseKey || process.env.SUPABASE_ANON_KEY,
        debug: debugMode,
        redirectTo: options.redirectTo,
      },
    )

    // Add plugins with dependency order - load after UI framework
    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.client'),
      mode: 'client',
      order: 10, // Load after default plugins (0)
    })

    addPlugin({
      src: resolver.resolve('./runtime/plugins/supabase.server'),
      mode: 'server',
      order: 10, // Load after default plugins (0)
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
    ])

    // Add components directory
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      prefix: '',
    })

    // Add middleware directory
    nuxt.hook('app:resolve', (app) => {
      // Add our middleware directory to the middleware paths
      app.middleware.push(...[
        {
          name: 'require-auth',
          path: resolver.resolve('./runtime/middleware/require-auth'),
          global: false,
        },
        {
          name: 'require-team',
          path: resolver.resolve('./runtime/middleware/require-team'),
          global: false,
        },
        {
          name: 'require-role',
          path: resolver.resolve('./runtime/middleware/require-role'),
          global: false,
        },
        {
          name: 'redirect-authenticated',
          path: resolver.resolve('./runtime/middleware/redirect-authenticated'),
          global: false,
        },
        {
          name: 'impersonation',
          path: resolver.resolve('./runtime/middleware/impersonation'),
          global: false,
        },
      ])
    })

    // Add CSS for components - only our custom styles, not conflicting with Nuxt UI
    nuxt.options.css = nuxt.options.css || []
    nuxt.options.css.push(resolver.resolve('./runtime/assets/css/components.css'))

    // Add server API routes
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.handlers = nitroConfig.handlers || []

      // Register all server API endpoints
      const apiEndpoints = [
        'accept-invite',
        'delete-user',
        'get-pending-invitations',
        'impersonate',
        'invite-member',
        'revoke-invitation',
        'signup-with-team',
        'stop-impersonation',
        'transfer-ownership',
      ]

      apiEndpoints.forEach((endpoint) => {
        nitroConfig.handlers.push({
          route: `/api/${endpoint}`,
          method: 'post',
          handler: resolver.resolve(`./runtime/server/api/${endpoint}.post`),
        })
      })
    })

    // Add pages
    nuxt.hook('pages:extend', (pages) => {
      pages.push({
        name: 'auth-callback',
        path: '/auth/callback',
        file: resolver.resolve('./runtime/pages/auth/callback.vue'),
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
