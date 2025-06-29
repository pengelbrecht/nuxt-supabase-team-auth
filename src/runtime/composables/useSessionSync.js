import { ref, watch } from "vue";
const SESSION_SYNC_EVENTS = {
  TEAM_CHANGED: "team_changed",
  ROLE_CHANGED: "role_changed",
  IMPERSONATION_STARTED: "impersonation_started",
  IMPERSONATION_STOPPED: "impersonation_stopped",
  SESSION_CONFLICT: "session_conflict",
  SESSION_RECOVERY: "session_recovery"
};
const STORAGE_KEYS = {
  TEAM_SESSION_STATE: "team_auth_session_sync",
  ACTIVE_TABS: "team_auth_active_tabs",
  IMPERSONATION_LOCK: "team_auth_impersonation_lock"
};
export function useSessionSync() {
  const tabId = ref(generateTabId());
  const isActiveTab = ref(true);
  const lastSyncTime = ref(/* @__PURE__ */ new Date());
  const conflictResolution = ref("primary");
  function generateTabId() {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  function getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt) {
    return {
      currentUser: currentUser.value,
      currentTeam: currentTeam.value,
      currentRole: currentRole.value,
      isImpersonating: isImpersonating.value,
      impersonationExpiresAt: impersonationExpiresAt.value?.toISOString() || null,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      tabId: tabId.value
    };
  }
  function broadcastSessionState(state, eventType) {
    try {
      if (typeof window === "undefined") return;
      const syncData = {
        event: eventType,
        state,
        timestamp: Date.now(),
        sourceTab: tabId.value
      };
      localStorage.setItem(STORAGE_KEYS.TEAM_SESSION_STATE, JSON.stringify(syncData));
      lastSyncTime.value = /* @__PURE__ */ new Date();
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.TEAM_SESSION_STATE);
      }, 100);
    } catch (error) {
      console.error("Failed to broadcast session state:", error);
    }
  }
  function setupCrossTabListener(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt, onStateUpdate) {
    const handleStorageChange = (event) => {
      if (event.key !== STORAGE_KEYS.TEAM_SESSION_STATE || !event.newValue) {
        return;
      }
      try {
        const syncData = JSON.parse(event.newValue);
        if (syncData.sourceTab === tabId.value) {
          return;
        }
        const eventAge = Date.now() - syncData.timestamp;
        if (eventAge > 5e3) {
          return;
        }
        switch (syncData.event) {
          case SESSION_SYNC_EVENTS.TEAM_CHANGED:
            handleTeamChange(syncData.state, currentUser, currentTeam, currentRole);
            break;
          case SESSION_SYNC_EVENTS.ROLE_CHANGED:
            handleRoleChange(syncData.state, currentRole);
            break;
          case SESSION_SYNC_EVENTS.IMPERSONATION_STARTED:
            handleImpersonationStart(syncData.state, isImpersonating, impersonationExpiresAt);
            break;
          case SESSION_SYNC_EVENTS.IMPERSONATION_STOPPED:
            handleImpersonationStop(isImpersonating, impersonationExpiresAt);
            break;
          case SESSION_SYNC_EVENTS.SESSION_RECOVERY:
            handleSessionRecovery(syncData.state, currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
            break;
        }
        onStateUpdate(syncData.state, syncData.event);
      } catch (error) {
        console.error("Failed to handle cross-tab session sync:", error);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }
  function handleTeamChange(state, currentUser, currentTeam, currentRole) {
    if (currentUser.value?.id === state.currentUser?.id) {
      currentTeam.value = state.currentTeam;
      currentRole.value = state.currentRole;
    }
  }
  function handleRoleChange(state, currentRole) {
    currentRole.value = state.currentRole;
  }
  function handleImpersonationStart(state, isImpersonating, impersonationExpiresAt) {
    if (isImpersonating.value && state.isImpersonating) {
      console.warn("Impersonation conflict detected across tabs");
      handleImpersonationConflict(state);
      return;
    }
    isImpersonating.value = state.isImpersonating;
    impersonationExpiresAt.value = state.impersonationExpiresAt ? new Date(state.impersonationExpiresAt) : null;
  }
  function handleImpersonationStop(isImpersonating, impersonationExpiresAt) {
    isImpersonating.value = false;
    impersonationExpiresAt.value = null;
  }
  function handleSessionRecovery(state, currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt) {
    currentUser.value = state.currentUser;
    currentTeam.value = state.currentTeam;
    currentRole.value = state.currentRole;
    isImpersonating.value = state.isImpersonating;
    impersonationExpiresAt.value = state.impersonationExpiresAt ? new Date(state.impersonationExpiresAt) : null;
  }
  function handleImpersonationConflict(conflictState) {
    try {
      const lockData = {
        tabId: tabId.value,
        timestamp: Date.now(),
        action: "resolving_conflict"
      };
      localStorage.setItem(STORAGE_KEYS.IMPERSONATION_LOCK, JSON.stringify(lockData));
      const conflictTime = new Date(conflictState.lastUpdated).getTime();
      const currentTime = Date.now();
      if (conflictTime > currentTime - 1e3) {
        conflictResolution.value = "secondary";
        console.info("Impersonation conflict resolved: deferring to newer session");
      } else {
        conflictResolution.value = "primary";
        console.info("Impersonation conflict resolved: maintaining current session");
      }
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEYS.IMPERSONATION_LOCK);
      }, 1e3);
    } catch (error) {
      console.error("Failed to resolve impersonation conflict:", error);
      conflictResolution.value = "conflict";
    }
  }
  function registerActiveTab() {
    try {
      if (typeof window === "undefined") return;
      const activeTabs = getActiveTabs();
      activeTabs.push({
        tabId: tabId.value,
        timestamp: Date.now(),
        url: window.location.href
      });
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TABS, JSON.stringify(activeTabs));
    } catch (error) {
      console.error("Failed to register active tab:", error);
    }
  }
  function unregisterActiveTab() {
    try {
      if (typeof window === "undefined") return;
      const activeTabs = getActiveTabs().filter((tab) => tab.tabId !== tabId.value);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TABS, JSON.stringify(activeTabs));
    } catch (error) {
      console.error("Failed to unregister active tab:", error);
    }
  }
  function getActiveTabs() {
    try {
      if (typeof window === "undefined") return [];
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_TABS);
      if (!stored) return [];
      const tabs = JSON.parse(stored);
      const now = Date.now();
      return tabs.filter((tab) => now - tab.timestamp < 5 * 60 * 1e3);
    } catch (error) {
      console.error("Failed to get active tabs:", error);
      return [];
    }
  }
  function isPrimaryTab() {
    if (typeof window === "undefined") return true;
    const activeTabs = getActiveTabs();
    if (activeTabs.length === 0) return true;
    activeTabs.sort((a, b) => a.timestamp - b.timestamp);
    return activeTabs[0].tabId === tabId.value;
  }
  function performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt) {
    const issues = [];
    if (currentUser.value && !currentTeam.value && !isImpersonating.value) {
      issues.push("User authenticated but no team selected");
    }
    if (currentTeam.value && !currentRole.value) {
      issues.push("Team selected but no role assigned");
    }
    if (isImpersonating.value && impersonationExpiresAt.value) {
      if (/* @__PURE__ */ new Date() >= impersonationExpiresAt.value) {
        issues.push("Impersonation session expired");
      }
    }
    if (isImpersonating.value && !impersonationExpiresAt.value) {
      issues.push("Impersonation state without expiration");
    }
    return {
      isHealthy: issues.length === 0,
      issues
    };
  }
  function initializeSessionSync(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt, onStateUpdate = () => {
  }) {
    if (typeof window === "undefined") {
      return () => {
      };
    }
    registerActiveTab();
    const cleanup = setupCrossTabListener(
      currentUser,
      currentTeam,
      currentRole,
      isImpersonating,
      impersonationExpiresAt,
      onStateUpdate
    );
    const stopWatchers = [
      watch(currentTeam, (newTeam, oldTeam) => {
        if (newTeam?.id !== oldTeam?.id) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
          broadcastSessionState(state, SESSION_SYNC_EVENTS.TEAM_CHANGED);
        }
      }),
      watch(currentRole, (newRole, oldRole) => {
        if (newRole !== oldRole) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
          broadcastSessionState(state, SESSION_SYNC_EVENTS.ROLE_CHANGED);
        }
      }),
      watch(isImpersonating, (newValue, oldValue) => {
        if (newValue !== oldValue) {
          const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
          if (newValue) {
            broadcastSessionState(state, SESSION_SYNC_EVENTS.IMPERSONATION_STARTED);
          } else {
            broadcastSessionState(state, SESSION_SYNC_EVENTS.IMPERSONATION_STOPPED);
          }
        }
      })
    ];
    const healthCheckInterval = setInterval(() => {
      const health = performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
      if (!health.isHealthy) {
        console.warn("Session health issues detected:", health.issues);
      }
    }, 6e4);
    return () => {
      unregisterActiveTab();
      cleanup();
      stopWatchers.forEach((stop) => stop());
      clearInterval(healthCheckInterval);
    };
  }
  function triggerSessionRecovery(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt) {
    const state = getCurrentSessionState(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt);
    broadcastSessionState(state, SESSION_SYNC_EVENTS.SESSION_RECOVERY);
  }
  return {
    // State
    tabId: tabId.value,
    isActiveTab,
    isPrimaryTab: isPrimaryTab(),
    lastSyncTime,
    conflictResolution,
    // Methods
    initializeSessionSync,
    broadcastSessionState,
    triggerSessionRecovery,
    performSessionHealthCheck,
    getActiveTabs,
    // Constants
    SESSION_SYNC_EVENTS
  };
}
