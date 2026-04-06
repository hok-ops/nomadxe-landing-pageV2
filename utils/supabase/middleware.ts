import { createServerClient } from '@supabase/ssr'
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

  // ROLE-BASED PROTECTION (Elevated for /admin routes)
  if (isAdmin && user) {
    // 🗺️ We use a separate admin check here to bypass RLS latency during initial login
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for definitive check
      { cookies: { getAll() { return request.cookies.getAll() }, setAll() {} } }
    )

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log(`[MIDDLEWARE] RBAC Check: user=${user.email} role=${profile?.role || 'null'}`);

    if (profile?.role !== 'admin') {
      console.warn(`[MIDDLEWARE] Forbidden access attempt to /admin by ${user.email}. Bouncing to /dashboard.`);
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard' 
      return NextResponse.redirect(url)
    }
    
    console.log(`[MIDDLEWARE] Access granted to Ops_Console for ${user.email}`);
  }

  return response
}

