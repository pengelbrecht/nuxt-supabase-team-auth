import { vi } from 'vitest'

/**
 * Test utilities for mocking Supabase Edge Functions and their dependencies
 */

// Mock environment variables for testing
export const mockEnvironment = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SITE_URL: 'http://localhost:3000',
}

// Mock Supabase Auth Admin API
export class MockSupabaseAuth {
  admin = {
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getUserById: vi.fn(),
    generateLink: vi.fn(),
  }

  getUser = vi.fn()
  verifyOtp = vi.fn()
}

// Mock Supabase Query Builder
export class MockQueryBuilder {
  private _table: string
  private _selectFields: string = '*'
  private _filters: Array<{ column: string, operator: string, value: any }> = []
  private _data: any = null

  constructor(table: string) {
    this._table = table
  }

  select(fields: string = '*') {
    this._selectFields = fields
    return this
  }

  insert(data: any) {
    this._data = data
    return this
  }

  update(data: any) {
    this._data = data
    return this
  }

  delete() {
    return this
  }

  eq(column: string, value: any) {
    this._filters.push({ column, operator: 'eq', value })
    return this
  }

  neq(column: string, value: any) {
    this._filters.push({ column, operator: 'neq', value })
    return this
  }

  single() {
    // Return a promise-like object that vitest can mock
    return Promise.resolve({ data: null, error: null })
  }

  // Helper to get the built query for testing
  getQuery() {
    return {
      table: this._table,
      fields: this._selectFields,
      filters: this._filters,
      data: this._data,
    }
  }
}

// Mock Supabase Client
export class MockSupabaseClient {
  auth = new MockSupabaseAuth()

  from(table: string) {
    return new MockQueryBuilder(table)
  }

  functions = {
    invoke: vi.fn(),
  }
}

// Create mock request helper
export function createMockRequest(
  body: any,
  options: {
    method?: string
    headers?: Record<string, string>
    authHeader?: string
  } = {},
): Request {
  const { method = 'POST', headers = {}, authHeader } = options

  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers,
  })

  if (authHeader) {
    requestHeaders.set('Authorization', authHeader)
  }

  return new Request('https://test.supabase.co/functions/v1/test', {
    method,
    headers: requestHeaders,
    body: JSON.stringify(body),
  })
}

// Create mock CORS OPTIONS request
export function createOptionsRequest(): Request {
  return new Request('https://test.supabase.co/functions/v1/test', {
    method: 'OPTIONS',
    headers: new Headers({
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, content-type',
    }),
  })
}

// Mock Response helpers
export async function parseJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  }
  catch {
    return { error: 'Invalid JSON', text }
  }
}

// Assertion helpers for Edge Function responses
export function expectSuccessResponse(response: Response, expectedData?: any) {
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')

  if (expectedData) {
    return response.json().then((data) => {
      expect(data).toMatchObject(expectedData)
      return data
    })
  }

  return response.json()
}

export function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string | { error: string, message?: string },
) {
  expect(response.status).toBe(expectedStatus)
  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')

  return response.json().then((data) => {
    if (typeof expectedError === 'string') {
      expect(data.error).toBe(expectedError)
    }
    else if (expectedError) {
      expect(data).toMatchObject(expectedError)
    }
    return data
  })
}

export function expectCorsResponse(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
}

// Test data factories
export const testUsers = {
  validUser: {
    id: 'user-123',
    email: 'test@example.com',
    password: 'securePassword123',
  },
  adminUser: {
    id: 'admin-456',
    email: 'admin@example.com',
    password: 'adminPassword123',
  },
  targetUser: {
    id: 'target-789',
    email: 'target@example.com',
  },
}

export const testTeams = {
  validTeam: {
    id: 'team-123',
    name: 'Test Team',
  },
  existingTeam: {
    id: 'team-456',
    name: 'Existing Team',
  },
}

export const testInvites = {
  validInvite: {
    id: 'invite-123',
    team_id: 'team-123',
    email: 'test@example.com',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  expiredInvite: {
    id: 'invite-456',
    team_id: 'team-123',
    email: 'test@example.com',
    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
}

// Mock environment setup helper
export function setupMockEnvironment() {
  Object.entries(mockEnvironment).forEach(([key, value]) => {
    vi.stubEnv(key, value)
  })
}

// Cleanup helper
export function cleanupMockEnvironment() {
  vi.unstubAllEnvs()
}

// Create mock Deno environment for edge functions
export function setupDenoMocks() {
  // Mock Deno.env
  const mockEnv = {
    get: vi.fn((key: string) => mockEnvironment[key as keyof typeof mockEnvironment]),
  }

  // @ts-ignore - Mock global Deno for edge function compatibility
  global.Deno = {
    env: mockEnv,
  }

  return mockEnv
}
