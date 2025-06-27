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
  /**
   * Social authentication providers configuration
   */
  socialProviders?: {
    /**
     * Google OAuth provider configuration
     */
    google?: {
      enabled?: boolean
      // Future: clientId, redirectUrl, scopes, etc.
    }
    // Future providers can be added here when implemented: github, apple, microsoft, facebook, etc.
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
    socialProviders: {
      google: {
        enabled: true, // Default enabled for backward compatibility
      },
      // Future providers will be added here when implemented
    },
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Validate Nuxt UI dependency
    const hasNuxtUI = nuxt.options.modules?.some(module => 
      typeof module === 'string' 
        ? module === '@nuxt/ui'
        : Array.isArray(module) 
          ? module[0] === '@nuxt/ui'
          : false
    )
    
    if (!hasNuxtUI && nuxt.options.dev) {
      console.warn(`[nuxt-supabase-team-auth] Warning: @nuxt/ui not found in modules. Please add '@nuxt/ui' to your modules array in nuxt.config.ts for components to work properly.`)
    }

    // Fix ESM/CJS module conflicts for Supabase dependencies
    nuxt.options.vite = nuxt.options.vite || {}
    nuxt.options.vite.optimizeDeps = nuxt.options.vite.optimizeDeps || {}
    nuxt.options.vite.optimizeDeps.exclude = nuxt.options.vite.optimizeDeps.exclude || []
    
    // Exclude problematic Supabase packages from Vite optimization
    const supabaseExcludes = ['@supabase/postgrest-js', '@supabase/storage-js', '@supabase/realtime-js']
    supabaseExcludes.forEach(pkg => {
      if (!nuxt.options.vite.optimizeDeps.exclude.includes(pkg)) {
        nuxt.options.vite.optimizeDeps.exclude.push(pkg)
      }
    })

    // Merge options with runtime config
    // Debug mode hierarchy: explicit option > env var > nuxt dev mode
    const debugMode = options.debug !== undefined
      ? options.debug
      : process.env.TEAM_AUTH_DEBUG === 'true'
        ? true
        : nuxt.options.dev

    // Set up runtime config for both client and server  
    // Auto-detect service role key from common environment variable names
    const serviceKey = process.env.SUPABASE_SERVICE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.SUPABASE_ANON_KEY // Fallback for development
    
    nuxt.options.runtimeConfig = defu(nuxt.options.runtimeConfig, {
      supabaseServiceKey: serviceKey,
    })

    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL
    const supabaseKey = options.supabaseKey || process.env.SUPABASE_ANON_KEY

    // Validate required configuration
    if (!supabaseUrl) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase URL. Please set SUPABASE_URL environment variable or configure supabaseUrl in module options.`)
    }
    if (!supabaseKey) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase anon key. Please set SUPABASE_ANON_KEY environment variable or configure supabaseKey in module options.`)
    }
    if (!serviceKey && nuxt.options.dev) {
      console.warn(`[nuxt-supabase-team-auth] Warning: No service role key found. Server-side operations may not work. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.`)
    }

    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl,
        supabaseKey,
        debug: debugMode,
        redirectTo: options.redirectTo,
        socialProviders: options.socialProviders,
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
