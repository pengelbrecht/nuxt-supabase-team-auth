import { defineNuxtModule, createResolver, addImports, addComponentsDir, installModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { defu } from 'defu'
import type { PasswordPolicy } from './runtime/types/password-policy'

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
  /**
   * Password policy configuration
   */
  passwordPolicy?: PasswordPolicy
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

    // Automatically install Nuxt UI for components and composables
    await installModule('@nuxt/ui')

    // Ensure proper transpilation for the module runtime
    nuxt.options.build = nuxt.options.build || {}
    nuxt.options.build.transpile = nuxt.options.build.transpile || []

    // Set up standard Supabase configuration for @nuxtjs/supabase
    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL
    const supabaseKey = options.supabaseKey || process.env.SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_KEY

    // Validate required configuration
    if (!supabaseUrl) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase URL. Please set SUPABASE_URL environment variable or configure supabaseUrl in module options.`)
    }
    if (!supabaseKey) {
      throw new Error(`[nuxt-supabase-team-auth] Missing Supabase anon key. Please set SUPABASE_ANON_KEY environment variable or configure supabaseKey in module options.`)
    }
    if (!serviceKey && nuxt.options.dev) {
      console.warn(`[nuxt-supabase-team-auth] Warning: No service role key found. Server-side operations may not work. Please set SUPABASE_SERVICE_KEY environment variable.`)
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
      // Public by default mode - not used since we disable redirects entirely below
      excludePaths = []
    }
    else {
      // Protected by default - exclude specific public routes
      excludePaths = [
        '/', // Home page public by default
        ...authRoutes, // Auth routes always public
        ...(options.publicRoutes || []), // Additional public routes
      ]
    }

    // Only set redirect options for protected mode
    // In public mode, let our middleware handle everything
    const supabaseConfig = {
      url: supabaseUrl,
      key: supabaseKey,
      useSsrCookies: true,
      clientOptions: {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: true,
        },
      },
    }

    // Configure redirect options for Supabase middleware
    let redirectOptions

    if (options.defaultProtection === 'public') {
      // For public mode, disable Supabase redirects entirely - our middleware handles everything
      redirectOptions = {
        login: false, // Disable automatic login redirects
        callback: '/auth/callback', // Still handle OAuth callbacks
        exclude: ['/**'], // Exclude everything from Supabase auth redirects
      }
    } else {
      // For protected mode, use normal redirect behavior
      redirectOptions = {
        login: options.loginPage || '/signin',
        callback: '/auth/callback',
        exclude: excludePaths,
      }
    }

    supabaseConfig.redirectOptions = redirectOptions

    const runtimeConfig = {
      url: supabaseUrl,
      key: supabaseKey,
      redirectOptions: {
        login: redirectOptions.login,
        callback: redirectOptions.callback,
        exclude: redirectOptions.exclude,
      },
    }

    // Set both nuxt.options.supabase and runtime config for @nuxtjs/supabase
    nuxt.options.supabase = defu(nuxt.options.supabase || {}, supabaseConfig)

    // Set up runtime config structure that @nuxtjs/supabase expects
    nuxt.options.runtimeConfig.public.supabase = defu(
      nuxt.options.runtimeConfig.public.supabase || {},
      runtimeConfig,
    )

    // Development logging removed - module is stable

    // Also ensure the configuration is applied before @nuxtjs/supabase initializes
    nuxt.hook('modules:before', () => {
      nuxt.options.supabase = defu(nuxt.options.supabase || {}, supabaseConfig)

      // Development logging removed - module is stable
    })

    // Install @nuxtjs/supabase with our configuration
    const supabaseModuleOptions: any = {
      url: supabaseUrl,
      key: supabaseKey,
      // Hybrid approach: implicit flow for invitations + SSR cookies for persistence
      // This solves page reload issues while maintaining invitation functionality
      //
      // Key benefits:
      // - Page reload maintains authentication (no redirect to login)
      // - Server-side rendering has access to user sessions
      // - Invitation system continues to work with inviteUserByEmail
      // - All existing functionality preserved
      useSsrCookies: true,
      clientOptions: {
        auth: {
          flowType: 'implicit', // Required for inviteUserByEmail compatibility
          detectSessionInUrl: true, // parse #access_token automatically
        },
      },
    }

    // Always add redirectOptions - our middleware will handle the public logic
    supabaseModuleOptions.redirectOptions = redirectOptions

    await installModule('@nuxtjs/supabase', supabaseModuleOptions)

    // Keep our custom teamAuth config for backward compatibility + route protection
    nuxt.options.runtimeConfig.public.teamAuth = defu(
      nuxt.options.runtimeConfig.public.teamAuth || {},
      {
        supabaseUrl,
        supabaseKey,
        redirectTo: options.redirectTo,
        loginPage: options.loginPage,
        defaultProtection: options.defaultProtection,
        protectedRoutes: options.protectedRoutes,
        publicRoutes: options.publicRoutes,
        socialProviders: options.socialProviders,
        passwordPolicy: options.passwordPolicy,
      },
    )

    // Add composables
    addImports([
      {
        name: 'useTeamAuth',
        from: resolver.resolve('./runtime/composables/useTeamAuth'),
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
        name: 'usePasswordPolicy',
        from: resolver.resolve('./runtime/composables/usePasswordPolicy'),
      },
      // Note: useSupabaseClient, useSupabaseSession, useSupabaseUser are NOT exported
      // They're internal wrappers used only within our module's runtime code
      // Consumer apps should use the composables from @nuxtjs/supabase directly
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

    // Force auth/confirm page to be client-side only to fix SSR cookie + implicit flow conflict
    nuxt.options.nitro = nuxt.options.nitro || {}
    nuxt.options.nitro.routeRules = nuxt.options.nitro.routeRules || {}
    nuxt.options.nitro.routeRules['/auth/confirm'] = { ssr: false }

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
        'process-invitation',
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

      // Add auth endpoints with nested paths
      nitroConfig.handlers.push({
        route: '/api/auth/sync-session',
        method: 'post',
        handler: resolver.resolve('./runtime/server/api/auth/sync-session.post'),
      })
    })

    // Add pages
    nuxt.hook('pages:extend', (pages) => {
      pages.push({
        name: 'auth-callback',
        path: '/auth/callback',
        file: resolver.resolve('./runtime/pages/auth/callback.vue'),
      })
      pages.push({
        name: 'auth-confirm',
        path: '/auth/confirm',
        file: resolver.resolve('./runtime/pages/auth/confirm.vue'),
      })
      pages.push({
        name: 'auth-forgot-password',
        path: '/auth/forgot-password',
        file: resolver.resolve('./runtime/pages/auth/forgot-password.vue'),
      })
      pages.push({
        name: 'accept-invite',
        path: '/accept-invite',
        file: resolver.resolve('./runtime/pages/accept-invite.vue'),
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
