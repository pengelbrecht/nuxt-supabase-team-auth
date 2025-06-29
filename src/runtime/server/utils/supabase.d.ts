import type { H3Event } from 'h3';
/**
 * Create a Supabase service role client (compatible with @nuxtjs/supabase)
 * This mirrors the implementation from @nuxtjs/supabase
 */
export declare const serverSupabaseServiceRole: (event: H3Event) => any;
/**
 * Create a Supabase client for the current user
 * This mirrors the implementation from @nuxtjs/supabase
 */
export declare const serverSupabaseClient: (event: H3Event) => any;
/**
 * Get the current user from the session
 * This mirrors the implementation from @nuxtjs/supabase
 */
export declare const serverSupabaseUser: (event: H3Event) => Promise<any>;
/**
 * Get the current session
 * This mirrors the implementation from @nuxtjs/supabase
 */
export declare const serverSupabaseSession: (event: H3Event) => Promise<any>;
export declare const createServiceRoleClient: (event: H3Event) => any;
export declare const createSupabaseClientFromEvent: (event: H3Event) => any;
export declare const getCurrentUser: (event: H3Event) => Promise<any>;
//# sourceMappingURL=supabase.d.ts.map