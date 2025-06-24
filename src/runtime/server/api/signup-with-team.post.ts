export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Forward to Supabase Edge Function
  const supabaseUrl = useRuntimeConfig().supabaseUrl
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/signup-with-team`

  try {
    const response = await $fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
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
