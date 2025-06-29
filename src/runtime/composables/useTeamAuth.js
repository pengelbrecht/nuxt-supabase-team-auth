import { ref, computed, triggerRef } from "vue";
import { useSessionSync } from "./useSessionSync.js";
import { useSession } from "./useSession.js";
import { useState, useNuxtApp } from "#app";
const getToast = async () => {
  try {
    const nuxtApp = useNuxtApp();
    if (nuxtApp?.$toast || globalThis?.useToast) {
      return nuxtApp.$toast || globalThis.useToast();
    }
    if (import.meta.client && window?.useToast) {
      return window.useToast();
    }
    throw new Error("No toast available");
  } catch {
    return {
      add: (notification) => {
        console.log("Toast notification:", notification);
      }
    };
  }
};
function getErrorForLogging(error) {
  if (error && typeof error === "object") {
    return error;
  }
  return { message: String(error) };
}
async function createAuthHeaders(supabaseClient) {
  const headers = {
    "Content-Type": "application/json"
  };
  try {
    if (supabaseClient) {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (!error && session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } else {
      const { getSession } = useSession();
      const session = await getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    }
  } catch (error) {
    console.warn("Failed to get session for auth headers:", error);
  }
  return headers;
}
let authListenerRegistered = false;
let cachedClient = null;
export function resetTeamAuthState() {
  cachedClient = null;
}
const IMPERSONATION_STORAGE_KEY = "team_auth_impersonation";
const loadImpersonationFromStorage = () => {
  if (!import.meta.client) return {};
  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (new Date(data.expiresAt) > /* @__PURE__ */ new Date()) {
        return {
          impersonating: true,
          impersonatedUser: data.targetUser,
          impersonationExpiresAt: new Date(data.expiresAt),
          impersonationSessionId: data.sessionId
        };
      } else {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  } catch (error) {
    console.error("Failed to load impersonation data:", getErrorForLogging(error));
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  }
  return {};
};
const saveImpersonationToStorage = (data) => {
  if (!import.meta.client) return;
  try {
    const storageData = {
      sessionId: data.impersonationSessionId,
      targetUser: data.impersonatedUser,
      expiresAt: data.impersonationExpiresAt?.toISOString()
    };
    localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(storageData));
  } catch (error) {
    console.error("Failed to save impersonation data:", getErrorForLogging(error));
  }
};
const createInitialAuthState = () => {
  const impersonationState = loadImpersonationFromStorage();
  return {
    // Core auth
    user: null,
    profile: null,
    team: null,
    role: null,
    teamMembers: [],
    // Impersonation state (unified here) - restored from localStorage
    impersonating: impersonationState.impersonating || false,
    impersonatedUser: impersonationState.impersonatedUser || null,
    impersonationExpiresAt: impersonationState.impersonationExpiresAt || null,
    originalUser: null,
    // Store the super admin
    impersonationSessionId: impersonationState.impersonationSessionId || null,
    justStartedImpersonation: false,
    // UI flag for modal dismissal
    stoppingImpersonation: false,
    // Flag to indicate stopping in progress
    // State management
    loading: true,
    initialized: false
  };
};
export function useTeamAuth(injectedClient) {
  const authState = useState("team-auth", () => createInitialAuthState());
  const updateAuthState = (updates) => {
    authState.value = { ...authState.value, ...updates };
    if ("impersonating" in updates || "impersonatedUser" in updates || "impersonationSessionId" in updates) {
      if (authState.value.impersonating) {
        saveImpersonationToStorage(authState.value);
      } else {
        if (import.meta.client) {
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        }
      }
    }
  };
  const currentUser = computed(() => authState.value.user);
  const currentProfile = computed(() => authState.value.profile);
  const currentTeam = computed(() => authState.value.team);
  const currentRole = computed(() => authState.value.role);
  const teamMembers = computed(() => authState.value.teamMembers);
  const isLoading = computed(() => authState.value.loading);
  const isImpersonating = computed(() => authState.value.impersonating);
  const impersonationExpiresAt = computed(() => authState.value.impersonationExpiresAt);
  const impersonatedUser = computed(() => authState.value.impersonatedUser);
  const originalUser = computed(() => authState.value.originalUser);
  const justStartedImpersonation = computed(() => authState.value.justStartedImpersonation);
  const sessionSync = useSessionSync();
  const getSupabaseClient = () => {
    if (injectedClient) return injectedClient;
    return useSupabaseClient();
  };
  const getClient = () => {
    if (import.meta.server) {
      throw new Error("Supabase client not available during SSR");
    }
    if (!cachedClient) {
      cachedClient = getSupabaseClient();
    }
    return cachedClient;
  };
  const updateCompleteAuthState = async (user) => {
    try {
      if (authState.value.impersonating && authState.value.impersonatedUser) {
        const impersonatedData = authState.value.impersonatedUser;
        updateAuthState({
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          },
          profile: {
            id: impersonatedData.id,
            full_name: impersonatedData.full_name,
            email: impersonatedData.email
          },
          team: impersonatedData.team ? {
            id: impersonatedData.team.id,
            name: impersonatedData.team.name
          } : null,
          role: impersonatedData.role,
          loading: false
        });
        return;
      }
      if (authState.value.stoppingImpersonation) {
        updateAuthState({
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          },
          profile: null,
          // Will be populated by background refresh if needed
          team: null,
          // Will be populated by background refresh if needed
          role: null,
          // Will be populated by background refresh if needed
          stoppingImpersonation: false,
          // Clear the flag
          loading: false
        });
        return;
      }
      try {
        const [profileResult, teamResult] = await Promise.all([
          getClient().from("profiles").select("*").eq("id", user.id).single(),
          getClient().from("team_members").select(`
            role,
            teams!inner (
              id, name, created_at, company_name,
              company_address_line1, company_address_line2,
              company_city, company_state, company_postal_code,
              company_country, company_vat_number
            )
          `).eq("user_id", user.id).single()
        ]);
        updateAuthState({
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          },
          profile: profileResult.data || null,
          team: teamResult.data ? {
            id: teamResult.data.teams.id,
            name: teamResult.data.teams.name,
            created_at: teamResult.data.teams.created_at,
            company_name: teamResult.data.teams.company_name,
            company_address_line1: teamResult.data.teams.company_address_line1,
            company_address_line2: teamResult.data.teams.company_address_line2,
            company_city: teamResult.data.teams.company_city,
            company_state: teamResult.data.teams.company_state,
            company_postal_code: teamResult.data.teams.company_postal_code,
            company_country: teamResult.data.teams.company_country,
            company_vat_number: teamResult.data.teams.company_vat_number
          } : null,
          role: teamResult.data?.role || null,
          loading: false
        });
      } catch (error) {
        console.error("Failed to update auth state:", getErrorForLogging(error));
        updateAuthState({
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata
          },
          profile: null,
          team: null,
          role: null,
          loading: false
        });
      }
    } catch (outerError) {
      console.error("Auth state update failed:", getErrorForLogging(outerError));
    }
  };
  const resetAuthState = () => {
    authState.value = {
      ...authState.value,
      user: null,
      profile: null,
      team: null,
      role: null,
      impersonating: false,
      impersonationExpiresAt: null,
      loading: false
    };
  };
  const lastProcessedEvent = ref("");
  const initializeAuth = async () => {
    if (authState.value.initialized) {
      return;
    }
    try {
      const { data: { session } } = await getClient().auth.getSession();
      if (session?.user) {
        await updateCompleteAuthState(session.user);
      } else {
        if (authState.value.impersonating) {
          if (import.meta.client) {
            localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
          }
          authState.value = {
            ...createInitialAuthState(),
            impersonating: false,
            impersonatedUser: null,
            impersonationExpiresAt: null,
            impersonationSessionId: null,
            loading: false,
            initialized: false
          };
        } else {
          authState.value = { ...authState.value, loading: false };
        }
      }
      if (!authListenerRegistered) {
        authListenerRegistered = true;
        getClient().auth.onAuthStateChange(async (event, session2) => {
          const eventKey = `${event}:${session2?.user?.id || "none"}:${session2?.user?.email || "none"}`;
          if (lastProcessedEvent.value === eventKey) {
            return;
          }
          lastProcessedEvent.value = eventKey;
          switch (event) {
            case "SIGNED_IN":
            case "TOKEN_REFRESHED":
            case "USER_UPDATED":
              if (session2?.user) {
                await updateCompleteAuthState(session2.user);
              }
              break;
            case "SIGNED_OUT":
              resetAuthState();
              lastProcessedEvent.value = "";
              break;
          }
        });
      }
      authState.value.initialized = true;
    } catch (error) {
      console.error("Auth initialization failed:", getErrorForLogging(error));
      authState.value = { ...authState.value, loading: false };
    }
  };
  if (import.meta.client && !authState.value.initialized) {
    initializeAuth();
  }
  return {
    // State
    currentUser,
    currentProfile,
    currentTeam,
    currentRole,
    teamMembers,
    isLoading,
    isImpersonating,
    impersonationExpiresAt,
    impersonatedUser,
    originalUser,
    justStartedImpersonation,
    // Authentication methods
    signUpWithTeam: async (email, password, teamName) => {
      try {
        authState.value = { ...authState.value, loading: true };
        const response = await $fetch("/api/signup-with-team", {
          method: "POST",
          body: {
            email,
            password,
            teamName
          }
        });
        if (!response.success) {
          throw { code: "SIGNUP_FAILED", message: response.message || "Signup failed" };
        }
        const { error: signInError } = await getClient().auth.signInWithPassword({
          email,
          password
        });
        if (signInError) {
          throw { code: "SIGNIN_AFTER_SIGNUP_FAILED", message: signInError.message };
        }
      } catch (error) {
        console.error("Sign up with team failed:", getErrorForLogging(error));
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    signIn: async (email, password) => {
      try {
        authState.value = { ...authState.value, loading: true };
        const { data: _data, error } = await getClient().auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          throw { code: "SIGNIN_FAILED", message: error.message };
        }
      } catch (error) {
        console.error("Sign in failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    signOut: async () => {
      try {
        authState.value = { ...authState.value, loading: true };
        await getClient().auth.signOut();
      } catch (error) {
        console.error("Sign out failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    // Profile methods
    getProfile: async () => {
      if (!currentUser.value) return null;
      const { data, error } = await getClient().from("profiles").select("*").eq("id", currentUser.value.id).single();
      if (error) {
        console.error("Failed to fetch profile:", error);
        return null;
      }
      return data;
    },
    updateProfile: async (updates) => {
      if (!currentUser.value) {
        throw new Error("No authenticated user");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        if ("password" in updates && updates.password) {
          const { error: passwordError } = await getClient().auth.updateUser({
            password: updates.password
          });
          if (passwordError) {
            throw { code: "PASSWORD_UPDATE_FAILED", message: passwordError.message };
          }
          const { password: _, ...profileUpdates } = updates;
          updates = profileUpdates;
        }
        if (Object.keys(updates).length > 0) {
          const { data, error } = await getClient().from("profiles").update(updates).eq("id", currentUser.value.id).select().single();
          if (error) {
            throw { code: "PROFILE_UPDATE_FAILED", message: error.message };
          }
          authState.value = {
            ...authState.value,
            profile: { ...authState.value.profile, ...data }
          };
          triggerRef(authState);
        }
      } catch (error) {
        console.error("Profile update failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    // Team management methods
    inviteMember: async (email, role = "member") => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      const validRoles = ["member", "admin"];
      if (!validRoles.includes(role)) {
        throw new Error("Invalid role. Must be member or admin");
      }
      if (!currentTeam.value?.id) {
        throw new Error("No team selected");
      }
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to invite members");
      }
      try {
        console.log("invite: step 1 - setting loading state");
        authState.value = { ...authState.value, loading: true };
        const headers = {
          "Content-Type": "application/json"
        };
        try {
          console.log("invite: step 2 - getting session");
          const { data: { session }, error: sessionError } = await getClient().auth.getSession();
          if (sessionError) {
            console.warn("Session error:", sessionError);
          } else if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }
          console.log("invite: step 3 - session obtained");
        } catch (error) {
          console.warn("Failed to get session for auth headers:", error);
        }
        console.log("invite: step 4 - making API call");
        const response = await $fetch("/api/invite-member", {
          method: "POST",
          headers,
          body: {
            email,
            role,
            teamId: currentTeam.value.id
          }
        });
        if (!response.success) {
          throw { code: "INVITE_FAILED", message: response.message || "Failed to send invite" };
        }
      } catch (error) {
        console.error("Invite member failed:", error);
        let errorMessage = "Failed to send invitation";
        if (error?.data?.message) {
          errorMessage = error.data.message;
        } else if (error?.statusMessage) {
          errorMessage = error.statusMessage;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.data?.error) {
          errorMessage = error.data.error;
        }
        throw new Error(errorMessage);
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    getPendingInvitations: async () => {
      if (!currentRole.value || !["owner", "admin", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to view pending invitations");
      }
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const headers = await createAuthHeaders(getClient());
        const response = await $fetch("/api/get-pending-invitations", {
          method: "POST",
          headers,
          body: {
            teamId: currentTeam.value.id
          }
        });
        if (!response.success) {
          throw { code: "GET_INVITATIONS_FAILED", message: response.message || "Failed to fetch invitations" };
        }
        return response.invitations || [];
      } catch (error) {
        console.error("Get pending invitations failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    revokeInvite: async (userId) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to revoke invites");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const headers = await createAuthHeaders(getClient());
        const response = await $fetch("/api/revoke-invitation", {
          method: "POST",
          headers,
          body: {
            userId,
            teamId: currentTeam.value.id
          }
        });
        if (!response.success) {
          throw { code: "REVOKE_INVITE_FAILED", message: response.message || "Failed to revoke invitation" };
        }
      } catch (error) {
        console.error("Revoke invite failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    resendInvite: async (userId) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const pendingInvitations = await this.getPendingInvitations();
        const invitation = pendingInvitations.find((inv) => inv.id === userId);
        if (!invitation) {
          throw { code: "INVITE_NOT_FOUND", message: "Invitation not found" };
        }
        await this.revokeInvite(userId);
        const role = invitation.user_metadata?.team_role || "member";
        await this.inviteMember(invitation.email, role);
      } catch (error) {
        console.error("Resend invite failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    promote: async (userId) => {
      if (!currentRole.value || currentRole.value !== "owner") {
        throw new Error("Only team owners can promote members");
      }
      await this.updateMemberRole(userId, "admin");
    },
    demote: async (userId) => {
      if (!currentRole.value || !["admin", "owner"].includes(currentRole.value)) {
        throw new Error("You do not have permission to demote members");
      }
      await this.updateMemberRole(userId, "member");
    },
    transferOwnership: async (userId) => {
      if (!currentTeam.value || !currentUser.value) {
        throw new Error("No current team or user available");
      }
      if (currentRole.value !== "owner") {
        throw new Error("Only the current owner can transfer ownership");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const headers = await createAuthHeaders(getClient());
        const response = await $fetch("/api/transfer-ownership", {
          method: "POST",
          headers,
          body: {
            teamId: currentTeam.value.id,
            newOwnerId: userId
          }
        });
        if (!response.success) {
          throw { code: "TRANSFER_FAILED", message: response.message || "Failed to transfer ownership" };
        }
        authState.value = {
          ...authState.value,
          role: "admin"
        };
        await this.getTeamMembers();
      } catch (error) {
        console.error("Transfer ownership failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    renameTeam: async (name) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      if (currentRole.value !== "owner") {
        throw new Error("Only team owners can rename the team");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const { data: _data, error } = await getClient().from("teams").update({ name }).eq("id", currentTeam.value.id).select().single();
        if (error) {
          throw { code: "RENAME_TEAM_FAILED", message: error.message };
        }
        authState.value = {
          ...authState.value,
          team: { ...authState.value.team, name }
        };
      } catch (error) {
        console.error("Rename team failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    updateTeam: async (updates) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      if (currentRole.value !== "owner") {
        throw new Error("Only team owners can update team settings");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const { data, error } = await getClient().from("teams").update(updates).eq("id", currentTeam.value.id).select().single();
        if (error) {
          throw { code: "UPDATE_TEAM_FAILED", message: error.message };
        }
        authState.value = {
          ...authState.value,
          team: { ...authState.value.team, ...data }
        };
      } catch (error) {
        console.error("Update team failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    deleteTeam: async () => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      if (currentRole.value !== "owner") {
        throw new Error("Only team owners can delete the team");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const headers = await createAuthHeaders();
        const response = await fetch(`${process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-team`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            team_id: currentTeam.value.id,
            confirm_deletion: true
          })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw {
            code: errorData.error || "DELETE_TEAM_FAILED",
            message: errorData.message || `HTTP ${response.status}: ${response.statusText}`
          };
        }
        const result = await response.json();
        if (result.members_removed > 0) {
          console.log(`Team deletion completed: ${result.members_removed} members removed, team "${result.deleted_team.name}" deleted`);
        }
        authState.value = {
          ...authState.value,
          team: null,
          role: null,
          teamMembers: []
        };
      } catch (error) {
        console.error("Delete team failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    // Team member methods
    getTeamMembers: async () => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      const { data: session } = await getClient().auth.getSession();
      if (!session.session) {
        throw new Error("No active session - please log in");
      }
      const { data: members, error } = await getClient().from("team_members").select(`
          user_id,
          role,
          joined_at,
          profiles!inner (
            id,
            full_name,
            email
          )
        `).eq("team_id", currentTeam.value.id);
      if (error) {
        throw new Error(`Failed to load team members: ${error.message}`);
      }
      const mappedMembers = (members || []).map((member) => ({
        id: member.user_id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        user: {
          email: member.profiles.email
        },
        profile: member.profiles
      }));
      authState.value = { ...authState.value, teamMembers: mappedMembers };
      return mappedMembers;
    },
    updateMemberRole: async (userId, newRole) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      const validRoles = ["member", "admin", "owner"];
      if (!validRoles.includes(newRole)) {
        throw new Error("Invalid role");
      }
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to update member roles");
      }
      if (newRole === "admin" && currentRole.value !== "owner") {
        throw new Error("Only owners can promote members to admin");
      }
      if (newRole === "owner") {
        throw new Error("Use transferOwnership method to change team ownership");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const { error } = await getClient().from("team_members").update({ role: newRole }).eq("team_id", currentTeam.value.id).eq("user_id", userId);
        if (error) {
          throw { code: "UPDATE_ROLE_FAILED", message: error.message };
        }
        const updatedMembers = authState.value.teamMembers.map(
          (member) => member.user_id === userId ? { ...member, role: newRole } : member
        );
        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        };
      } catch (error) {
        console.error("Update member role failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    removeMember: async (userId) => {
      if (!currentTeam.value) {
        throw new Error("No current team available");
      }
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to remove members");
      }
      if (userId === currentUser.value?.id && currentRole.value === "owner") {
        throw new Error("Team owner cannot remove themselves. Transfer ownership first.");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const headers = await createAuthHeaders();
        const response = await $fetch("/api/delete-user", {
          method: "POST",
          headers,
          body: { userId }
        });
        if (!response.success) {
          throw { code: "DELETE_USER_FAILED", message: response.error || "Failed to delete user" };
        }
        const updatedMembers = authState.value.teamMembers.filter((member) => member.user_id !== userId);
        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        };
      } catch (error) {
        console.error("Remove member failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    getTeamMemberProfile: async (userId) => {
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to view member profiles");
      }
      const { data, error } = await getClient().from("profiles").select("*").eq("id", userId).single();
      if (error) {
        console.error("Failed to fetch team member profile:", error);
        return null;
      }
      return data;
    },
    updateTeamMemberProfile: async (userId, updates) => {
      if (!currentRole.value || !["admin", "owner", "super_admin"].includes(currentRole.value)) {
        throw new Error("You do not have permission to edit member profiles");
      }
      if (userId === currentUser.value?.id) {
        throw new Error("Use updateProfile method to edit your own profile");
      }
      try {
        authState.value = { ...authState.value, loading: true };
        const allowedFields = ["full_name", "phone", "company_role"];
        const filteredUpdates = Object.keys(updates).filter((key) => allowedFields.includes(key)).reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});
        if (Object.keys(filteredUpdates).length === 0) {
          throw new Error("No valid fields to update");
        }
        const { error } = await getClient().from("profiles").update(filteredUpdates).eq("id", userId);
        if (error) {
          throw { code: "UPDATE_MEMBER_PROFILE_FAILED", message: error.message };
        }
        const updatedMembers = authState.value.teamMembers.map((member) => {
          if (member.user_id === userId) {
            return {
              ...member,
              profile: { ...member.profile, ...filteredUpdates }
            };
          }
          return member;
        });
        authState.value = {
          ...authState.value,
          teamMembers: updatedMembers
        };
      } catch (error) {
        console.error("Update team member profile failed:", error);
        throw error;
      } finally {
        authState.value = { ...authState.value, loading: false };
      }
    },
    // Utility methods
    getAvatarFallback: (overrides) => {
      const fullName = overrides?.fullName !== void 0 ? overrides.fullName : currentUser.value?.user_metadata?.name;
      const email = overrides?.email !== void 0 ? overrides.email : currentUser.value?.email;
      if (fullName && fullName.trim()) {
        return fullName.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
      }
      if (email) {
        return email[0].toUpperCase();
      }
      return "U";
    },
    // Unified impersonation methods (no delegation)
    startImpersonation: async (targetUserId, reason) => {
      try {
        updateAuthState({ loading: true });
        const originalUser2 = currentUser.value;
        if (!originalUser2) {
          throw new Error("No authenticated user to start impersonation from");
        }
        const { data: { session } } = await getClient().auth.getSession();
        if (!session) {
          throw new Error("No active session");
        }
        const response = await $fetch("/api/impersonate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: { targetUserId, reason }
        });
        if (!response.success) {
          throw new Error(response.message || "Failed to start impersonation");
        }
        updateAuthState({
          // Keep current user for now, auth listener will update it
          originalUser: originalUser2,
          impersonating: true,
          impersonatedUser: response.impersonation.target_user,
          impersonationExpiresAt: new Date(response.impersonation.expires_at),
          impersonationSessionId: response.impersonation.session_id,
          loading: false
        });
        const toast = await getToast();
        toast.add({
          title: "Impersonation Started",
          description: `Now impersonating ${response.impersonation.target_user.full_name || response.impersonation.target_user.email}`,
          color: "blue",
          icon: "i-lucide-user-check"
        });
        authState.value = { ...authState.value, justStartedImpersonation: true };
        await getClient().auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token
        });
      } catch (error) {
        console.error("Start impersonation failed:", error);
        updateAuthState({ loading: false });
        const toast = await getToast();
        toast.add({
          title: "Impersonation Failed",
          description: error.data?.message || error.message || "Failed to start impersonation",
          color: "red",
          icon: "i-lucide-alert-circle"
        });
        throw error;
      }
    },
    stopImpersonation: async () => {
      try {
        updateAuthState({ loading: true });
        if (!isImpersonating.value || !authState.value.impersonationSessionId) {
          throw new Error("No active impersonation session");
        }
        const { data: { session } } = await getClient().auth.getSession();
        if (!session) {
          updateAuthState({
            impersonating: false,
            impersonatedUser: null,
            impersonationExpiresAt: null,
            impersonationSessionId: null,
            originalUser: null,
            loading: false
          });
          const toast2 = await getToast();
          toast2.add({
            title: "Impersonation Cleared",
            description: "Stale impersonation state has been cleared",
            color: "green",
            icon: "i-lucide-user-x"
          });
          return;
        }
        const response = await $fetch("/api/stop-impersonation", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            sessionId: authState.value.impersonationSessionId
          }
        });
        updateAuthState({
          stoppingImpersonation: true
        });
        updateAuthState({
          impersonating: false,
          impersonatedUser: null,
          impersonationExpiresAt: null,
          impersonationSessionId: null,
          originalUser: null,
          loading: false
        });
        if (response.session) {
          try {
            await getClient().auth.setSession({
              access_token: response.session.access_token,
              refresh_token: response.session.refresh_token
            });
            setTimeout(async () => {
              try {
                const { data: { session: session2 } } = await getClient().auth.getSession();
                if (session2?.user) {
                  await updateCompleteAuthState(session2.user);
                }
              } catch (error) {
                console.warn("Failed to refresh auth state after impersonation end:", error);
              }
            }, 100);
          } catch (error) {
            console.warn("Failed to restore admin session:", error);
            updateAuthState({ stoppingImpersonation: false });
          }
        }
        const toast = await getToast();
        toast.add({
          title: "Impersonation Ended",
          description: "Returned to your original session",
          color: "green",
          icon: "i-lucide-user-x"
        });
      } catch (error) {
        console.error("Stop impersonation failed:", error);
        updateAuthState({ loading: false });
        const toast = await getToast();
        toast.add({
          title: "Error Stopping Impersonation",
          description: "Session has been cleared. Please sign in again.",
          color: "red",
          icon: "i-lucide-alert-circle"
        });
        throw error;
      }
    },
    // Session management utilities
    sessionHealth: () => sessionSync.performSessionHealthCheck(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    triggerSessionRecovery: () => sessionSync.triggerSessionRecovery(currentUser, currentTeam, currentRole, isImpersonating, impersonationExpiresAt),
    getActiveTabs: sessionSync.getActiveTabs,
    isTabPrimary: sessionSync.isPrimaryTab,
    // Testing utilities
    $initializationPromise: Promise.resolve(),
    // Force refresh auth state
    refreshAuthState: async () => {
      if (currentUser.value) {
        await updateCompleteAuthState(currentUser.value);
      }
    },
    // Clear success flag for UI components
    clearSuccessFlag: () => {
      authState.value = { ...authState.value, justStartedImpersonation: false };
    }
  };
}
