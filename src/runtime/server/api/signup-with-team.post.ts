import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Get runtime config for Supabase
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabase.url
  const serviceKey = config.supabaseServiceKey

  if (!serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing Supabase service key configuration',
    })
  }

  // Get Authorization header from client (for OAuth signup)
  const authHeader = getHeader(event, 'Authorization')

  // Transform body to match Edge Function expectations
  // Support both camelCase (from forms) and snake_case (from OAuth callback)
  const transformedBody = {
    email: body.email,
    password: body.password,
    team_name: body.team_name || body.teamName, // Support both formats
    oauth_provider: body.oauth_provider, // Pass through for OAuth signup
    user_metadata: body.user_metadata, // Pass through Google profile data
  }

  // Forward to Supabase Edge Function
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-team-and-owner`

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use client auth header for OAuth (has user session), service key for password signup
        'Authorization': authHeader || `Bearer ${serviceKey}`,
      },
      body: transformedBody,
    })

    return response
  }
  catch (error: any) {
    console.error('Signup with team proxy error:', error)
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to signup with team',
    })
  }
})
