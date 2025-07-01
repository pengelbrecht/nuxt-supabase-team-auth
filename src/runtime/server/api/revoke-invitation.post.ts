import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const authHeader = getHeader(event, 'authorization')

  console.log('=== REVOKE INVITATION API ===')
  console.log('Request body:', body)
  console.log('Auth header present:', !!authHeader)

  if (!authHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization header',
    })
  }

  // Forward to Supabase Edge Function
  const supabaseUrl = useRuntimeConfig().supabaseUrl
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/revoke-invitation`

  console.log('Forwarding to:', edgeFunctionUrl)

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    })

    console.log('Edge function response:', response)
    return response
  }
  catch (error: any) {
    console.error('Revoke invitation proxy error:', error)
    console.error('Error details:', error.data)
    console.error('Error status:', error.status)
    console.error('Error statusText:', error.statusText)

    // Try to get the actual error message from the response
    let errorMessage = error.message || 'Failed to revoke invitation'
    if (error.data && typeof error.data === 'object') {
      errorMessage = error.data.error || error.data.message || errorMessage
    }

    throw createError({
      statusCode: error.status || 500,
      statusMessage: errorMessage,
    })
  }
})
