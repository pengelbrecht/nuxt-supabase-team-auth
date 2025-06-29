import { defineEventHandler, readBody, getHeader, createError } from "h3";
import { $fetch } from "ofetch";
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const authHeader = getHeader(event, "authorization");
  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing authorization header"
    });
  }
  const supabaseUrl = useRuntimeConfig().supabaseUrl;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-team-and-owner`;
  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader
      },
      body
    });
    return response;
  } catch (error) {
    console.error("Signup with team proxy error:", error);
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || "Failed to signup with team"
    });
  }
});
