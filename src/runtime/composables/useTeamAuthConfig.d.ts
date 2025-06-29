import type { SocialProvidersConfig } from '../types/index.js';
/**
 * Team Auth configuration composable
 * Provides access to module configuration values
 */
export declare function useTeamAuthConfig(): {
    config: import("vue").ComputedRef<any>;
    debug: import("vue").ComputedRef<any>;
    redirectTo: import("vue").ComputedRef<any>;
    loginPage: import("vue").ComputedRef<any>;
    supabaseUrl: import("vue").ComputedRef<any>;
    supabaseKey: import("vue").ComputedRef<any>;
    socialProviders: import("vue").ComputedRef<SocialProvidersConfig>;
    isGoogleEnabled: import("vue").ComputedRef<boolean>;
    isGithubEnabled: import("vue").ComputedRef<boolean>;
    hasAnySocialProvider: import("vue").ComputedRef<boolean>;
};
//# sourceMappingURL=useTeamAuthConfig.d.ts.map