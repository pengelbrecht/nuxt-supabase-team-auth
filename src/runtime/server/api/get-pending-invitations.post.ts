import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization header',
    })
  }

  // Forward to Supabase Edge Function
  const supabaseUrl = useRuntimeConfig().supabaseUrl
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/get-pending-invitations`

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    })

    return response
  }
  catch (error: any) {
    console.error('Get pending invitations proxy error:', error)
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Failed to get pending invitations',
    })
  }
})
