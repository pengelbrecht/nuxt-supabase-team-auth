import { defineEventHandler, readBody, createError } from 'h3'
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

  // Transform body to match Edge Function expectations
  const transformedBody = {
    email: body.email,
    password: body.password,
    team_name: body.teamName, // Convert camelCase to snake_case
  }

  // Forward to Supabase Edge Function with service role key
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-team-and-owner`

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
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
