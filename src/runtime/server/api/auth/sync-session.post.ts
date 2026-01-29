import { defineEventHandler, readBody, createError } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)
    const body = await readBody<{ accessToken?: string, refreshToken?: string }>(event)
    const { accessToken, refreshToken } = body || {}

    if (!accessToken || !refreshToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Access Token and Refresh Token are required',
      })
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (error) {
      throw createError({
        statusCode: error.status || 500,
        statusMessage: error.message || 'Failed to set session',
      })
    }

    return {
      success: true,
      message: 'Session synchronized and cookie set successfully',
      userId: data?.session?.user?.id,
      userEmail: data?.session?.user?.email,
    }
  }
  catch (error: unknown) {
    const errorObj = error as any

    // If it's already a createError, just re-throw it
    if (errorObj.statusCode) {
      throw error
    }

    // Otherwise, wrap it
    throw createError({
      statusCode: 500,
      statusMessage: errorObj.message || 'Failed to sync session',
    })
  }
})
