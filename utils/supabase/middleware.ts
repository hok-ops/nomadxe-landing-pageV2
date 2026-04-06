import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // PROTECTED ROUTES LOGIC
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isAdmin = request.nextUrl.pathname.startsWith('/admin')

  if ((isDashboard || isAdmin) && !user) {
    console.log(`[MIDDLEWARE] Unauthorized access. Redirecting to /login`);
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ROLE-BASED PROTECTION for /admin routes
  // CRITICAL: Use createClient (not createServerClient) with service_role key.
  // createServerClient passes cookies which trigger the user's RLS session context,
  // causing recursive RLS policy evaluation. createClient with service_role bypasses
  // RLS entirely and avoids infinite recursion.
  if (isAdmin && user) {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log(`[MIDDLEWARE] RBAC Check: user=${user.email} role=${profile?.role || 'null'} error=${profileError?.message || 'none'}`);

    if (profile?.role !== 'admin') {
      console.warn(`[MIDDLEWARE] Forbidden: ${user.email} is not admin. Bouncing to /dashboard.`);
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    
    console.log(`[MIDDLEWARE] Access granted to Ops_Console for ${user.email}`);
  }

  return response
}
