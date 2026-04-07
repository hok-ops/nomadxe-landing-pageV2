import { createClient } from '@/utils/supabase/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  console.log("🔥 INCOMING URL TO VERCEL:", request.url);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  
  // Default to your setup page if no specific 'next' param is provided in the invite
  const next = searchParams.get('next') ?? '/activate-account'; 
  const supabase = createClient();

  // 1. PKCE flow — invite / OAuth / magic-link with code exchange
  if (code) {
    console.log("Auth Confirm: Attempting to exchange PKCE code...");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      console.log("Auth Confirm: Session exchange SUCCESS! Redirecting to:", next);
      return NextResponse.redirect(new URL(next, request.url));
    } else {
      console.error("Auth Confirm: PKCE Exchange ERROR:", error.message);
      // Let's pass the specific error to the login page so you can see it in the UI
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
  }

  // 2. OTP token-hash flow — email confirmation, password reset
  if (token_hash && type) {
    console.log(`Auth Confirm: Attempting to verify OTP hash of type ${type}...`);
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    
    if (!error) {
      console.log("Auth Confirm: OTP verify SUCCESS! Redirecting to:", next);
      return NextResponse.redirect(new URL(next, request.url));
    } else {
      console.error("Auth Confirm: OTP Verify ERROR:", error.message);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }
  }

  // 3. Fallback if the URL has neither a code nor a token_hash
  console.error("Auth Confirm: No code or token_hash found in URL.");
  return NextResponse.redirect(new URL('/login?error=Invalid_link_structure', request.url));
}
