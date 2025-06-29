import { createClient } from "@supabase/supabase-js";
import { useRuntimeConfig } from "#imports";
export const serverSupabaseServiceRole = (event) => {
  const {
    supabase: { serviceKey },
    public: {
      supabase: { url }
    }
  } = useRuntimeConfig(event);
  if (!serviceKey) {
    throw new Error("Missing `SUPABASE_SERVICE_KEY` in `.env`");
  }
  if (!event.context._supabaseServiceRole) {
    event.context._supabaseServiceRole = createClient(url, serviceKey, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return event.context._supabaseServiceRole;
};
export const serverSupabaseClient = (event) => {
  const {
    public: {
      supabase: { url, key }
    }
  } = useRuntimeConfig(event);
  if (!event.context._supabaseClient) {
    event.context._supabaseClient = createClient(url, key, {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return event.context._supabaseClient;
};
export const serverSupabaseUser = async (event) => {
  const client = serverSupabaseClient(event);
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    return null;
  }
  return user;
};
export const serverSupabaseSession = async (event) => {
  const client = serverSupabaseClient(event);
  const { data: { session }, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return session;
};
export const createServiceRoleClient = serverSupabaseServiceRole;
export const createSupabaseClientFromEvent = serverSupabaseClient;
export const getCurrentUser = serverSupabaseUser;
