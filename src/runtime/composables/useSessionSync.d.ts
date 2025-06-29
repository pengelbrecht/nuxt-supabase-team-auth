import type { Ref } from 'vue';
import type { User, Team } from '../types/index.js';
/**
 * Enhanced cross-tab synchronization for team-specific session data
 * Builds on top of Supabase's built-in auth state sync
 */
interface TeamSessionState {
    currentUser: User | null;
    currentTeam: Team | null;
    currentRole: string | null;
    isImpersonating: boolean;
    impersonationExpiresAt: string | null;
    lastUpdated: string;
    tabId: string;
}
interface SessionSyncEvents {
    TEAM_CHANGED: 'team_changed';
    ROLE_CHANGED: 'role_changed';
    IMPERSONATION_STARTED: 'impersonation_started';
    IMPERSONATION_STOPPED: 'impersonation_stopped';
    SESSION_CONFLICT: 'session_conflict';
    SESSION_RECOVERY: 'session_recovery';
}
export declare function useSessionSync(): {
    tabId: string;
    isActiveTab: Ref<boolean, boolean>;
    isPrimaryTab: boolean;
    lastSyncTime: Ref<Date, Date>;
    conflictResolution: Ref<"primary" | "secondary" | "conflict", "primary" | "secondary" | "conflict">;
    initializeSessionSync: (currentUser: Ref<User | null>, currentTeam: Ref<Team | null>, currentRole: Ref<string | null>, isImpersonating: Ref<boolean>, impersonationExpiresAt: Ref<Date | null>, onStateUpdate?: (state: TeamSessionState, eventType: keyof SessionSyncEvents) => void) => () => void;
    broadcastSessionState: (state: TeamSessionState, eventType: keyof SessionSyncEvents) => void;
    triggerSessionRecovery: (currentUser: Ref<User | null>, currentTeam: Ref<Team | null>, currentRole: Ref<string | null>, isImpersonating: Ref<boolean>, impersonationExpiresAt: Ref<Date | null>) => void;
    performSessionHealthCheck: (currentUser: Ref<User | null>, currentTeam: Ref<Team | null>, currentRole: Ref<string | null>, isImpersonating: Ref<boolean>, impersonationExpiresAt: Ref<Date | null>) => {
        isHealthy: boolean;
        issues: string[];
    };
    getActiveTabs: () => any;
    SESSION_SYNC_EVENTS: SessionSyncEvents;
};
export {};
//# sourceMappingURL=useSessionSync.d.ts.map