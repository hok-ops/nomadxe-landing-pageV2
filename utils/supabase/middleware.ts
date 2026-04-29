import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_LAST_SEEN_COOKIE,
  SESSION_STARTED_COOKIE,
  getSessionPolicy,
  parseSessionTimestamp,
} from '@/lib/sessionPolicy'

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name === SESSION_STARTED_COOKIE ||
      cookie.name === SESSION_LAST_SEEN_COOKIE
    ) {
      response.cookies.set(cookie.name, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
    }
  }
}

function applyProtectedHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
}

function sessionExpiredResponse(request: NextRequest, reason: string) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/')
  if (isApiRequest) {
    const response = NextResponse.json({ error: reason }, { status: 401 })
    clearAuthCookies(request, response)
    applyProtectedHeaders(response)
    return response
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = `?error=${encodeURIComponent(reason)}`
  const redirect = NextResponse.redirect(url)
  clearAuthCookies(request, redirect)
  applyProtectedHeaders(redirect)
  return redirect
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isDashboardConceptLab = pathname === '/dashboard/concepts'

  if (isDashboardConceptLab && process.env.VERCEL !== '1') {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

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

  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin     = pathname.startsWith('/admin')
  const isAdminApi  = pathname.startsWith('/api/admin')
  const requiresAdmin = isAdmin || isAdminApi || isDashboardConceptLab
  // /access/* proxies modem WebUI sessions — enforce auth at the middleware layer
  // in addition to the handler-level check, so a handler error returns 302 not 500.
  const isAccess    = pathname.startsWith('/access')
  const isProtectedApi =
    pathname.startsWith('/api/vrm/') ||
    pathname.startsWith('/api/devices/') ||
    pathname.startsWith('/api/intelligence/') ||
    pathname.startsWith('/api/service-tickets') ||
    isAdminApi
  const isProtectedSurface = isDashboard || isAdmin || isAccess || isProtectedApi

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
  if (isProtectedSurface && !user) {
    if (isProtectedApi) {
      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      applyProtectedHeaders(unauthorized)
      return unauthorized
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isProtectedSurface && user) {
    const now = Date.now()
    const policy = getSessionPolicy(pathname)
    const startedAt = parseSessionTimestamp(request.cookies.get(SESSION_STARTED_COOKIE)?.value) ?? now
    const lastSeenAt = parseSessionTimestamp(request.cookies.get(SESSION_LAST_SEEN_COOKIE)?.value) ?? now
    const idleExpired = now - lastSeenAt > policy.idleMs
    const absoluteExpired = now - startedAt > policy.absoluteMs

    if (idleExpired || absoluteExpired) {
      return sessionExpiredResponse(
        request,
        idleExpired ? 'Session expired after inactivity. Please sign in again.' : 'Session expired. Please sign in again.'
      )
    }

    response.cookies.set(SESSION_STARTED_COOKIE, String(startedAt), {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: Math.ceil(policy.absoluteMs / 1000),
    })
    response.cookies.set(SESSION_LAST_SEEN_COOKIE, String(now), {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: Math.ceil(policy.absoluteMs / 1000),
    })
    applyProtectedHeaders(response)
  }

  // For /admin routes: verify admin role using service-role client.
  // Empty cookie handlers: uses service_role key only, bypasses user RLS context.
  if (requiresAdmin && user) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      // Without the service key we cannot verify role — deny access to /admin.
      console.error('[MIDDLEWARE] SUPABASE_SERVICE_ROLE_KEY not set — denying /admin access')
      if (isAdminApi) {
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
      }
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
        if (isAdminApi) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        url.search = ''
        return NextResponse.redirect(url)
      }
    } catch {
      // Any error during role check: deny /admin access
      if (isAdminApi) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return response
}
