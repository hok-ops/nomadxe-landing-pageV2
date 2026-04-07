import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Standard anon client for session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
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

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isAdmin = request.nextUrl.pathname.startsWith('/admin')

  // Auth callback and password pages are public — never block them.
  const isPublicAuthRoute =
    request.nextUrl.pathname.startsWith('/auth/') ||
    request.nextUrl.pathname === '/activate-account' ||
    request.nextUrl.pathname === '/reset-password' ||
    request.nextUrl.pathname === '/forgot-password' ||
    request.nextUrl.pathname === '/login'

  if (isPublicAuthRoute) return response

  // Redirect unauthenticated users away from protected routes
  if ((isDashboard || isAdmin) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // For /admin routes: verify admin role using a service-role client.
  // CRITICAL: Use createServerClient with the service role key but pass NO cookies.
  // Passing an empty cookie handler means the client uses only the service_role key
  // and does NOT inherit the user's session context, avoiding recursive RLS evaluation.
  if (isAdmin && user) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      console.error('[MIDDLEWARE] SUPABASE_SERVICE_ROLE_KEY is not set — cannot verify admin role')
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Use createServerClient with service_role key and empty cookie handlers
    // This keeps us in Edge-compatible territory while bypassing user RLS context
    const adminCheck = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        cookies: {
          getAll() { return [] },   // No cookies — service_role context only
          setAll() {},
        },
      }
    )

    const { data: profile, error: profileError } = await adminCheck
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log(`[MIDDLEWARE] RBAC: user=${user.email} role=${profile?.role ?? 'null'} error=${profileError?.message ?? 'none'}`)

    if (profile?.role !== 'admin') {
      console.warn(`[MIDDLEWARE] Access denied for ${user.email} — not admin`)
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    console.log(`[MIDDLEWARE] Admin access granted to ${user.email}`)
  }

  return response
}
