import { defineNuxtModule, createResolver, addImports, addComponentsDir, installModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
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
   * Login page path (where unauthenticated users are redirected)
   */
  loginPage?: string
  /**
   * Additional routes to exclude from authentication (beyond defaults)
   */
  publicRoutes?: string[]
  /**
   * Routes that require authentication (if specified, ONLY these routes will be protected)
   * If not specified, all routes except publicRoutes will be protected
   */
  protectedRoutes?: string[]
  /**
   * Default protection mode: 'protected' (default) or 'public'
   * - 'protected': All routes protected except those in publicRoutes
   * - 'public': All routes public except those in protectedRoutes
   */
  defaultProtection?: 'protected' | 'public'
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

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
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
    loginPage: '/signin', // Use /signin as default, can be overridden
    defaultProtection: 'public', // Default to public (opt-in protection)
    publicRoutes: [], // Additional public routes beyond auth pages
    protectedRoutes: ['/dashboard'], // Default protected routes
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
          : false,
    )

    if (!hasNuxtUI && nuxt.options.dev) {
      console.warn(`[nuxt-supabase-team-auth] Warning: @nuxt/ui not found in modules. Please add '@nuxt/ui' to your modules array in nuxt.config.ts for components to work properly.`)
    }

    // Ensure proper transpilation for the module runtime
    nuxt.options.build = nuxt.options.build || {}
    nuxt.options.build.transpile = nuxt.options.build.transpile || []

    // Merge options with runtime config
    // Debug mode hierarchy: explicit option > env var > nuxt dev mode
    const debugMode = options.debug !== undefined
      ? options.debug
      : process.env.TEAM_AUTH_DEBUG === 'true'
        ? true
        : nuxt.options.dev

    // Set up standard Supabase configuration for @nuxtjs/supabase
    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL
    const supabaseKey = options.supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_ANON_KEY // Fallback for development

    // Validate required configuration
    if (!supabaseUrl) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase URL. Please set SUPABASE_URL environment variable or configure supabaseUrl in module options.`)
    }
    if (!supabaseKey) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase anon key. Please set SUPABASE_KEY or SUPABASE_ANON_KEY environment variable or configure supabaseKey in module options.`)
    }
    if (!serviceKey && nuxt.options.dev) {
      console.warn(`[nuxt-supabase-team-auth] Warning: No service role key found. Server-side operations may not work. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.`)
    }

    // Configure runtime config before installing @nuxtjs/supabase
    nuxt.options.runtimeConfig = defu(nuxt.options.runtimeConfig, {
      supabaseUrl,
      supabaseKey,
      supabaseServiceKey: serviceKey,
    })

    nuxt.options.runtimeConfig.public = defu(nuxt.options.runtimeConfig.public, {
      supabaseUrl,
      supabaseKey,
    })

    // Configure route protection based on user preferences
    const authRoutes = [
      '/signup',
      '/signin',
      '/login',
      '/accept-invite',
      '/auth/confirm', // Allow email confirmations
      '/auth/forgot-password',
      '/auth/callback', // Allow OAuth callbacks
      '/auth/reset-password',
    ]

    let excludePaths: string[]

    if (options.defaultProtection === 'public') {
      // Public by default mode - exclude most routes, let middleware handle protection
      excludePaths = [
        '/', // Home page
        ...authRoutes, // Auth routes always public
        ...(options.publicRoutes || []), // Additional public routes
        // Add a catch-all pattern to make most routes public
        '/api/**', // API routes
        '/_nuxt/**', // Nuxt assets
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
      ]
    }
    else {
      // Protected by default - exclude specific public routes
      excludePaths = [
        '/', // Home page public by default
        ...authRoutes, // Auth routes always public
        ...(options.publicRoutes || []), // Additional public routes
      ]
    }

    const redirectOptions = {
      login: options.loginPage || '/signin',
      callback: '/auth/callback', // Use default callback for OAuth
      exclude: excludePaths,
    }

    // Set both nuxt.options.supabase and runtime config for @nuxtjs/supabase
    nuxt.options.supabase = defu(nuxt.options.supabase || {}, {
      url: supabaseUrl,
      key: supabaseKey,
      redirectOptions,
    })

    // Set up runtime config structure that @nuxtjs/supabase expects
    // This allows NUXT_PUBLIC_SUPABASE_* env vars to override these defaults
    nuxt.options.runtimeConfig.public.supabase = defu(
      nuxt.options.runtimeConfig.public.supabase || {},
      {
        url: supabaseUrl,
        key: supabaseKey,
        redirectOptions: {
          login: redirectOptions.login,
          callback: redirectOptions.callback,
          exclude: redirectOptions.exclude,
        },
      },
    )

    if (nuxt.options.dev) {
      console.log('[team-auth] Supabase redirectOptions configured:', redirectOptions)
      console.log('[team-auth] Final supabase config:', nuxt.options.supabase)
      console.log('[team-auth] Runtime supabase config:', nuxt.options.runtimeConfig.public.supabase)
    }

    // Also ensure the configuration is applied before @nuxtjs/supabase initializes
    nuxt.hook('modules:before', () => {
      nuxt.options.supabase = defu(nuxt.options.supabase || {}, {
        url: supabaseUrl,
        key: supabaseKey,
        redirectOptions,
      })

      if (nuxt.options.dev) {
        console.log('[team-auth] modules:before - Final supabase config:', nuxt.options.supabase)
      }
    })

    // Install @nuxtjs/supabase with our configuration
    const supabaseModuleOptions: any = {
      url: supabaseUrl,
      key: supabaseKey,
    }

    // Only add redirectOptions if we're using protected by default mode
    if (options.defaultProtection !== 'public') {
      supabaseModuleOptions.redirectOptions = redirectOptions
    }

    await installModule('@nuxtjs/supabase', supabaseModuleOptions)

    // Keep our custom teamAuth config for backward compatibility + route protection
    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl,
        supabaseKey,
        debug: debugMode,
        redirectTo: options.redirectTo,
        loginPage: options.loginPage,
        defaultProtection: options.defaultProtection,
        protectedRoutes: options.protectedRoutes,
        publicRoutes: options.publicRoutes,
        socialProviders: options.socialProviders,
      },
    )

    // Add composables (useSupabaseClient is provided by @nuxtjs/supabase)
    addImports([
      {
        name: 'useTeamAuth',
        from: resolver.resolve('./runtime/composables/useTeamAuth'),
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

    // Add components directory with transpilation
    addComponentsDir({
      path: resolver.resolve('./runtime/components'),
      prefix: '',
      transpile: true, // Enable transpilation for module components
      pathPrefix: false, // Don't use path-based prefixes
      global: true, // Register components globally
    })

    // Add our runtime to transpile for proper compilation
    if (!nuxt.options.build.transpile.includes(resolver.resolve('./runtime'))) {
      nuxt.options.build.transpile.push(resolver.resolve('./runtime'))
    }

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

export default module
