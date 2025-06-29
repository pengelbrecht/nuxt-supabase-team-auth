import { defineEventHandler, readBody, setCookie, createError } from "h3";
import jwt from "jsonwebtoken";
import { createServiceRoleClient, getCurrentUser } from "../utils/supabase.js";
export default defineEventHandler(async (event) => {
  console.log("Impersonation request received");
  try {
    const user = await getCurrentUser(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        message: "Not authenticated"
      });
    }
    const adminClient = createServiceRoleClient(event);
    const { data: memberData, error: memberError } = await adminClient.from("team_members").select("role").eq("user_id", user.id).single();
    if (memberError || !memberData) {
      throw createError({
        statusCode: 403,
        message: "Access denied"
      });
    }
    if (memberData.role !== "super_admin") {
      throw createError({
        statusCode: 403,
        message: "Only super admins can impersonate users"
      });
    }
    console.log("Super admin verified:", user.id);
    const { targetUserId, reason } = await readBody(event);
    console.log("Request body:", { targetUserId, reason });
    if (!targetUserId) {
      throw createError({
        statusCode: 400,
        message: "Target user ID is required"
      });
    }
    if (!reason || reason.trim().length < 10) {
      throw createError({
        statusCode: 400,
        message: "A valid reason (at least 10 characters) is required for impersonation"
      });
    }
    const { data: targetMember, error: targetError } = await adminClient.from("team_members").select(`
        user_id,
        role,
        teams (
          id,
          name
        ),
        profiles!inner (
          id,
          email,
          full_name
        )
      `).eq("user_id", targetUserId).single();
    if (targetError || !targetMember) {
      console.error("Target user query error:", targetError);
      throw createError({
        statusCode: 404,
        message: "Target user not found"
      });
    }
    if (targetMember.role === "super_admin") {
      throw createError({
        statusCode: 403,
        message: "Cannot impersonate other super admin users"
      });
    }
    const insertData = {
      admin_user_id: user.id,
      target_user_id: targetUserId,
      reason: reason.trim(),
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1e3).toISOString()
      // 30 minutes
    };
    console.log("Inserting impersonation session with data:", { ...insertData });
    const { data: sessionLog, error: logError } = await adminClient.from("impersonation_sessions").insert(insertData).select().single();
    if (logError || !sessionLog) {
      console.error("Failed to create impersonation log:", logError);
      throw createError({
        statusCode: 500,
        message: "Failed to create impersonation session"
      });
    }
    const targetEmail = targetMember.profiles.email;
    if (!targetEmail) {
      throw createError({
        statusCode: 400,
        message: "Target user does not have a valid email address"
      });
    }
    console.log("Creating session for user:", targetUserId, "with email:", targetEmail);
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (authUserError || !authUserData.user) {
      console.error("Failed to get auth user:", authUserError);
      throw createError({
        statusCode: 500,
        message: "Failed to retrieve target user authentication data"
      });
    }
    const { data: magicLinkData, error: magicLinkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: {
        data: {
          impersonation_session_id: sessionLog.id,
          impersonated_by: user.id,
          impersonation_expires_at: sessionLog.expires_at
        }
      }
    });
    if (magicLinkError || !magicLinkData.properties?.hashed_token) {
      console.error("Failed to generate magic link:", magicLinkError);
      throw createError({
        statusCode: 500,
        message: "Failed to generate impersonation session"
      });
    }
    console.log("Magic link generated, verifying OTP...");
    const { data: sessionData, error: verifyError } = await adminClient.auth.verifyOtp({
      token_hash: magicLinkData.properties.hashed_token,
      type: "magiclink"
    });
    if (verifyError || !sessionData.session) {
      console.error("Failed to verify OTP:", verifyError);
      throw createError({
        statusCode: 500,
        message: "Failed to create impersonation session"
      });
    }
    console.log("Impersonation session created successfully");
    const adminEmail = user.email;
    if (!adminEmail) {
      throw createError({
        statusCode: 400,
        message: "Admin user does not have a valid email address"
      });
    }
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || "fallback-secret-for-dev";
    const impersonationToken = jwt.sign(
      {
        admin_email: adminEmail,
        admin_id: user.id,
        session_id: sessionLog.id,
        exp: Math.floor(Date.now() / 1e3) + 30 * 60
        // 30 minutes
      },
      jwtSecret
    );
    setCookie(event, "admin-impersonation", impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60,
      // 30 minutes, same as impersonation session
      path: "/"
    });
    console.log("Stored admin impersonation token in secure cookie");
    return {
      success: true,
      impersonation: {
        session_id: sessionLog.id,
        target_user: {
          id: targetMember.user_id,
          email: targetEmail,
          full_name: targetMember.profiles.full_name,
          role: targetMember.role,
          team: targetMember.teams
        },
        expires_at: sessionLog.expires_at
      },
      // New session for the impersonated user
      session: sessionData.session,
      // Only return admin user ID (tokens stored securely server-side)
      originalUser: {
        id: user.id,
        email: user.email
      }
    };
  } catch (error) {
    console.error("Impersonation error:", error);
    const errorObj = error;
    if (errorObj.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: errorObj.message || "Internal server error during impersonation"
    });
  }
});
