import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createError } from 'h3'
import signupEndpoint from '../../src/runtime/server/api/signup-with-team.post'

// Mock modules
vi.mock('h3', () => ({
  defineEventHandler: (handler: any) => handler,
  readBody: vi.fn(),
  createError: vi.fn().mockImplementation((error) => error),
}))

vi.mock('ofetch', () => ({
  $fetch: vi.fn(),
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(),
}))

const { readBody } = await vi.importMock('h3')
const { $fetch } = await vi.importMock('ofetch')
const { useRuntimeConfig } = await vi.importMock<{ useRuntimeConfig: any }>('#imports')

describe('signup-with-team API endpoint', () => {
  const mockEvent = { node: { req: {}, res: {} } }
  const mockRequestBody = {
    email: 'test@example.com',
    password: 'testpassword123',
    teamName: 'Test Team',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    ;(readBody as any).mockResolvedValue(mockRequestBody)
    ;(useRuntimeConfig as any).mockReturnValue({
      public: {
        supabase: {
          url: 'http://localhost:54321',
        },
      },
      supabaseServiceKey: 'test-service-key',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should NOT require authorization headers for signup', async () => {
    // Mock successful Edge Function response
    ;($fetch as any).mockResolvedValue({
      success: true,
      user: { id: '123', email: 'test@example.com' },
      team: { id: '456', name: 'Test Team' },
    })

    // Call the endpoint WITHOUT authorization header
    const response = await signupEndpoint(mockEvent)

    // Should succeed without auth
    expect(response).toMatchObject({
      success: true,
      user: { id: '123', email: 'test@example.com' },
      team: { id: '456', name: 'Test Team' },
    })
    
    // Verify it called the Edge Function with service key
    expect($fetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/create-team-and-owner',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-service-key',
        },
        body: mockRequestBody,
      }
    )
  })

  it('should use service key for Edge Function authentication', async () => {
    ;($fetch as any).mockResolvedValue({ success: true })

    await signupEndpoint(mockEvent)

    // Verify service key was used
    const fetchCall = ($fetch as any).mock.calls[0]
    expect(fetchCall[1].headers.Authorization).toBe('Bearer test-service-key')
  })

  it('should throw 500 error if service key is missing', async () => {
    // Mock missing service key
    ;(useRuntimeConfig as any).mockReturnValue({
      public: {
        supabase: {
          url: 'http://localhost:54321',
        },
      },
      supabaseServiceKey: null,
    })

    // Call endpoint
    const result = await signupEndpoint(mockEvent)

    // Should throw error
    expect(createError).toHaveBeenCalledWith({
      statusCode: 500,
      statusMessage: 'Missing Supabase service key configuration',
    })
  })

  it('should handle Edge Function errors correctly', async () => {
    const edgeFunctionError = {
      status: 400,
      message: 'Email already registered',
    }
    ;($fetch as any).mockRejectedValue(edgeFunctionError)

    await signupEndpoint(mockEvent)

    expect(createError).toHaveBeenCalledWith({
      statusCode: 400,
      statusMessage: 'Email already registered',
    })
  })

  it('should forward request body to Edge Function', async () => {
    ;($fetch as any).mockResolvedValue({ success: true })

    await signupEndpoint(mockEvent)

    // Verify body was forwarded correctly
    expect($fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: mockRequestBody,
      })
    )
  })
})