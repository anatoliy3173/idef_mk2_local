// Supabase Edge Function: captcha-verify
// Creates user account with server-side validation
//
// Deploy with: supabase functions deploy captcha-verify
// Set secrets:
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EMAIL_DOMAIN = 'agentdiagram.local'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version',
}

interface RequestBody {
  username: string
  password: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: CORS_HEADERS }
    )
  }

  try {
    const body: RequestBody = await req.json()
    const { username, password } = body

    // Validate input
    if (!username || username.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Username must be at least 3 characters' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Only alphanumeric + underscore/dash for usernames
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return new Response(
        JSON.stringify({ error: 'Username can only contain letters, numbers, underscores, and dashes' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Create user via Supabase Admin API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const email = `${username}@${EMAIL_DOMAIN}`

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(
      (u: { email?: string }) => u.email === email
    )

    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'Username already taken' }),
        { status: 409, headers: CORS_HEADERS }
      )
    }

    // Create user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    return new Response(
      JSON.stringify({ success: true, userId: data.user.id }),
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
