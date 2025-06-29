import { defineEventHandler, readBody, createError } from "h3";
import { createServiceRoleClient, getCurrentUser } from "../utils/supabase.js";
export default defineEventHandler(async (event) => {
  const currentUser = await getCurrentUser(event);
  if (!currentUser) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required"
    });
  }
  const body = await readBody(event);
  const { userId } = body;
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing userId"
    });
  }
  try {
    const supabaseAdmin = createServiceRoleClient(event);
    const { data: currentUserTeams, error: currentUserError } = await supabaseAdmin.from("team_members").select("team_id, role").eq("user_id", currentUser.id).in("role", ["admin", "owner", "super_admin"]);
    if (currentUserError || !currentUserTeams?.length) {
      throw createError({
        statusCode: 403,
        statusMessage: "You do not have permission to delete users"
      });
    }
    const { data: targetUserTeams, error: targetUserError } = await supabaseAdmin.from("team_members").select("team_id, role").eq("user_id", userId);
    if (targetUserError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Failed to find target user"
      });
    }
    const sharedTeams = currentUserTeams.filter(
      (currentTeam) => targetUserTeams?.some((targetTeam) => targetTeam.team_id === currentTeam.team_id)
    );
    if (!sharedTeams.length) {
      throw createError({
        statusCode: 403,
        statusMessage: "You can only delete users from your own teams"
      });
    }
    const targetIsOwner = targetUserTeams?.some((team) => team.role === "owner");
    const currentIsSuperAdmin = currentUserTeams.some((team) => team.role === "super_admin");
    if (targetIsOwner && !currentIsSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only super admins can delete team owners"
      });
    }
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete user:", deleteError);
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to delete user: ${deleteError.message}`
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error in delete-user API:", error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Internal server error"
    });
  }
});
