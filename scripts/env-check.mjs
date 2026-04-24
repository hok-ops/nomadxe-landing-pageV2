import fs from 'fs';
import path from 'path';

const REQUIRED_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VICTRON_ADMIN_TOKEN',
  'MAKE_WEBHOOK_URL',              // Make.com shared webhook (order form + fallback for all forms)
];

// Optional dedicated webhook URLs — if absent, routes fall back to MAKE_WEBHOOK_URL.
// Set these in .env.local / Vercel env vars to route each form to a separate Make.com scenario.
const OPTIONAL_WEBHOOKS = [
  'MAKE_DEACTIVATE_WEBHOOK_URL',   // Dedicated webhook for deactivation form
  'MAKE_RELOCATE_WEBHOOK_URL',     // Dedicated webhook for relocation form
];

const FORBIDDEN_PUBLIC_PREFIX = 'NEXT_PUBLIC_';

const IS_CI = process.env.VERCEL || process.env.CI;

console.log('\x1b[36m%s\x1b[0m', '🛡️  NomadXE Security Pre-flight Check...');

let hasMissingSecrets = false;

// 1. Check for required environment presence
REQUIRED_SECRETS.forEach(secret => {
  if (!process.env[secret]) {
    if (IS_CI) {
      console.warn('\x1b[33m%s\x1b[0m', `⚠️  WARNING: Missing Secret "${secret}". Admin features will be restricted.`);
    } else {
      console.error('\x1b[31m%s\x1b[0m', `❌ MISSING CRITICAL SECRET: ${secret}`);
      hasMissingSecrets = true;
    }
  }
});

// 2. Warn (don't fail) if optional dedicated webhook URLs are absent
OPTIONAL_WEBHOOKS.forEach(key => {
  if (!process.env[key]) {
    console.warn('\x1b[33m%s\x1b[0m', `ℹ️  Optional: "${key}" not set — falling back to MAKE_WEBHOOK_URL (form_type distinguishes submissions).`);
  }
});

// 3. Scan process.env for leaked service role keys in public namespace
Object.keys(process.env).forEach(key => {
  if (key.startsWith(FORBIDDEN_PUBLIC_PREFIX) && (key.includes('SERVICE_ROLE') || key.includes('SECRET'))) {
    console.error('\x1b[31m%s\x1b[0m', `⚠️  SECURITY RISK: Sensitive key "${key}" is exposed to the client!`);
    hasMissingSecrets = true;
  }
});

if (hasMissingSecrets) {
  console.log('\x1b[33m%s\x1b[0m', '\nℹ️  Consult /docs/superpowers/plans/implementation_plan.md for setup instructions.');
  process.exit(1); 
}

if (IS_CI) {
  console.log('\x1b[32m%s\x1b[0m', '✅ Build-phase validation complete (with warnings). Proceeding to Next.js build...\n');
} else {
  console.log('\x1b[32m%s\x1b[0m', '✅ Local security validation passed. Booting system...\n');
}

process.exit(0);

