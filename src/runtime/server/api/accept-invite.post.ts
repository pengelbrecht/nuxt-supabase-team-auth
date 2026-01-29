import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization header',
    })
  }

  // Forward to Supabase Edge Function
  const supabaseUrl = useRuntimeConfig().supabaseUrl
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/accept-invite`

  // Proxying to edge function

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    })

    return response as Record<string, unknown>
  }
  catch (error: any) {
    console.error('Accept invite proxy error:', error)
    console.error('Error details:', {
      status: error.status,
      statusCode: error.statusCode,
      data: error.data,
      message: error.message,
    })
    throw createError({
      statusCode: error.status || error.statusCode || 500,
      statusMessage: error.message || 'Failed to accept invite',
    })
  }
})
