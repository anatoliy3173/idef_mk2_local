/**
 * Manual test script for verifying safety layers of the /api/generate-xml endpoint.
 *
 * Prerequisites:
 *   1. Deploy to Vercel (or run `vercel dev` locally)
 *   2. Set environment variables: GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_URL,
 *      SUPABASE_SERVICE_ROLE_KEY, MONTHLY_REQUEST_LIMIT, DAILY_REQUEST_LIMIT
 *   3. Have a valid Supabase auth token for a test user
 *
 * Usage:
 *   npx tsx scripts/test-safety-layers.ts <base-url> <auth-token>
 *
 * Example:
 *   npx tsx scripts/test-safety-layers.ts http://localhost:3000 eyJhbGciOiJIUzI1NiIs...
 *
 * Tests:
 *   1. Auth rejection (no token)
 *   2. Auth rejection (invalid token)
 *   3. Validation rejection (empty description)
 *   4. Validation rejection (invalid mode)
 *   5. Successful generation (if quota available)
 *   6. Usage stats endpoint
 *   7. Token estimation rejection (oversized prompt)
 */

const BASE_URL = process.argv[2]
const AUTH_TOKEN = process.argv[3]

if (!BASE_URL || !AUTH_TOKEN) {
  console.error('Usage: npx tsx scripts/test-safety-layers.ts <base-url> <auth-token>')
  console.error('Example: npx tsx scripts/test-safety-layers.ts http://localhost:3000 eyJhbG...')
  process.exit(1)
}

interface TestResult {
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

async function test(
  name: string,
  fn: () => Promise<{ passed: boolean; details: string }>
): Promise<void> {
  try {
    const result = await fn()
    results.push({ name, ...result })
    const icon = result.passed ? '\u2705' : '\u274C'
    console.log(`${icon} ${name}: ${result.details}`)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    results.push({ name, passed: false, details: `Exception: ${message}` })
    console.log(`\u274C ${name}: Exception: ${message}`)
  }
}

async function fetchApi(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, options)
  const body = (await res.json()) as Record<string, unknown>
  return { status: res.status, body }
}

async function run(): Promise<void> {
  console.log(`\nTesting safety layers against: ${BASE_URL}\n`)
  console.log('─'.repeat(60))

  // Test 1: No auth token
  await test('Auth rejection (no token)', async () => {
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'test', mode: 'create' }),
    })
    return {
      passed: status === 401,
      details: `Status ${status}, error: ${body.error}`,
    }
  })

  // Test 2: Invalid auth token
  await test('Auth rejection (invalid token)', async () => {
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-12345',
      },
      body: JSON.stringify({ description: 'test', mode: 'create' }),
    })
    return {
      passed: status === 401,
      details: `Status ${status}, error: ${body.error}`,
    }
  })

  // Test 3: Empty description
  await test('Validation rejection (empty description)', async () => {
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ description: '', mode: 'create' }),
    })
    return {
      passed: status === 400,
      details: `Status ${status}, error: ${body.error}`,
    }
  })

  // Test 4: Invalid mode
  await test('Validation rejection (invalid mode)', async () => {
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ description: 'test', mode: 'invalid' }),
    })
    return {
      passed: status === 400,
      details: `Status ${status}, error: ${body.error}`,
    }
  })

  // Test 5: Usage stats endpoint
  await test('Usage stats returns data', async () => {
    const { status, body } = await fetchApi('/api/usage-stats', {
      method: 'GET',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    })
    const hasMonthly = body.monthly && typeof (body.monthly as Record<string, unknown>).used === 'number'
    const hasDaily = body.daily && typeof (body.daily as Record<string, unknown>).used === 'number'
    return {
      passed: status === 200 && Boolean(hasMonthly) && Boolean(hasDaily),
      details: `Status ${status}, monthly: ${JSON.stringify(body.monthly)}, daily: ${JSON.stringify(body.daily)}`,
    }
  })

  // Test 6: Token estimation rejection (oversized prompt)
  await test('Token estimation rejection (oversized prompt)', async () => {
    // Create a very large description (~500K chars = ~125K estimated tokens > 100K limit)
    const largeDesc = 'Create an agent system with '.padEnd(500_000, 'x')
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ description: largeDesc, mode: 'create' }),
    })
    return {
      passed: status === 400 && body.code === 'TOKEN_LIMIT_EXCEEDED',
      details: `Status ${status}, code: ${body.code}`,
    }
  })

  // Test 7: Successful generation (only runs if quota is available)
  await test('Successful generation', async () => {
    const { status, body } = await fetchApi('/api/generate-xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        description:
          'Create a simple customer support system with 2 agents: one for FAQ lookup and one for ticket creation.',
        mode: 'create',
      }),
    })

    if (status === 429) {
      return {
        passed: true, // quota hit is a valid safety layer response
        details: `Status 429 (quota limit active): ${body.error}`,
      }
    }

    const hasXml = typeof body.xml === 'string' && (body.xml as string).includes('<agentSystem')
    const hasUsage = body.usage && typeof (body.usage as Record<string, unknown>).monthlyUsed === 'number'
    return {
      passed: status === 200 && Boolean(hasXml) && Boolean(hasUsage),
      details: `Status ${status}, xml length: ${typeof body.xml === 'string' ? (body.xml as string).length : 0}, usage: ${JSON.stringify(body.usage)}`,
    }
  })

  // Summary
  console.log('\n' + '─'.repeat(60))
  const passed = results.filter((r: TestResult) => r.passed).length
  const total = results.length
  console.log(`\nResults: ${passed}/${total} passed`)

  if (passed < total) {
    console.log('\nFailed tests:')
    results
      .filter((r: TestResult) => !r.passed)
      .forEach((r: TestResult) => console.log(`  - ${r.name}: ${r.details}`))
  }

  console.log('')
}

run().catch((err: unknown) => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
