type Session = any;
/**
 * Centralized session management composable
 * Provides cached session access and prevents concurrent getSession() calls
 */
export declare function useSession(): {
    getSession: (force?: boolean) => Promise<Session | null>;
    clearSession: () => void;
    invalidateSession: () => Promise<any>;
    getCachedSession: () => any;
    hasCachedSession: () => any;
    sessionCache: Readonly<import("vue").Ref<any, any>>;
};
/**
 * Reset all global session state - for testing only
 * @internal
 */
export declare function resetSessionState(): void;
export {};
//# sourceMappingURL=useSession.d.ts.map