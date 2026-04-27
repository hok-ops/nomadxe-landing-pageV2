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

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // If we cannot verify the session, treat as unauthenticated
  }

  const { pathname } = request.nextUrl
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin     = pathname.startsWith('/admin')
  // /access/* proxies modem WebUI sessions — enforce auth at the middleware layer
  // in addition to the handler-level check, so a handler error returns 302 not 500.
  const isAccess    = pathname.startsWith('/access')

  // Auth callback and password pages are public — never block them.
  const isPublicAuthRoute =
    pathname.startsWith('/auth/') ||
    pathname === '/activate-account' ||
    pathname === '/reset-password' ||
    pathname === '/reset-otp' ||
    pathname === '/forgot-password' ||
    pathname === '/login'

  if (isPublicAuthRoute) return response

  // Redirect unauthenticated users to login — hard block, no fallback.
  if ((isDashboard || isAdmin || isAccess) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // For /admin routes: verify admin role using service-role client.
  // Empty cookie handlers: uses service_role key only, bypasses user RLS context.
  if (isAdmin && user) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      // Without the service key we cannot verify role — deny access to /admin.
      console.error('[MIDDLEWARE] SUPABASE_SERVICE_ROLE_KEY not set — denying /admin access')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = '?error=Server+misconfiguration'
      return NextResponse.redirect(url)
    }

    try {
      const adminCheck = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        {
          cookies: {
            getAll() { return [] },
            setAll() {},
          },
        }
      )

      const { data: profile } = await adminCheck
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        url.search = ''
        return NextResponse.redirect(url)
      }
    } catch {
      // Any error during role check: deny /admin access
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
