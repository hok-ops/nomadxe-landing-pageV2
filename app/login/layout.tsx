import type { Metadata } from 'next';

// Isolated layout for the login route — no site Navbar, no footer.
// The root layout provides fonts + globals; this layer adds nothing else.
export const metadata: Metadata = {
  title: 'Sign In | NomadXE',
  description: 'Sign in to your NomadXE account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
