import { defineEventHandler, readBody, getHeader, createError, useRuntimeConfig } from 'h3'
import { $fetch } from 'ofetch'

export default defineEventHandler(async (event) => {
  console.log('=== INVITE MEMBER API CALLED ===')
  console.log('Method:', event.node.req.method)
  console.log('URL:', event.node.req.url)

  const body = await readBody(event)
  console.log('Request body received:', body)

  const authHeader = getHeader(event, 'authorization')
  console.log('Auth header present:', !!authHeader)

  if (!authHeader) {
    console.log('Missing auth header, rejecting request')
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing authorization header',
    })
  }

  // Forward to Supabase Edge Function
  const supabaseUrl = useRuntimeConfig().supabaseUrl
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/invite-member`

  console.log('Proxying to edge function:', edgeFunctionUrl)
  console.log('Request body:', body)

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
    console.error('Invite member proxy error:', error)
    console.error('Error details:', {
      status: error.status,
      statusCode: error.statusCode,
      data: error.data,
      message: error.message,
    })

    // Extract the error message from the edge function response
    let errorMessage = 'Failed to invite member'

    if (error.data?.error) {
      // Edge function returns {error: "message"}
      errorMessage = error.data.error
    }
    else if (error.data?.message) {
      errorMessage = error.data.message
    }
    else if (error.message) {
      errorMessage = error.message
    }

    throw createError({
      statusCode: error.status || error.statusCode || 500,
      statusMessage: errorMessage,
    })
  }
})
