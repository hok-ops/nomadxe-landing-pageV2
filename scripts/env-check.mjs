import fs from 'fs';
import path from 'path';

const REQUIRED_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VICTRON_ADMIN_TOKEN'
];

const FORBIDDEN_PUBLIC_PREFIX = 'NEXT_PUBLIC_';

console.log('\x1b[36m%s\x1b[0m', '🛡️  NomadXE Security Pre-flight Check...');

let hasError = false;

// 1. Check for .env.local existence or environment presence
REQUIRED_SECRETS.forEach(secret => {
  if (!process.env[secret]) {
    console.error('\x1b[31m%s\x1b[0m', `❌ MISSING CRITICAL SECRET: ${secret}`);
    hasError = true;
  }
});

// 2. Scan process.env for leaked service role keys in public namespace
Object.keys(process.env).forEach(key => {
  if (key.startsWith(FORBIDDEN_PUBLIC_PREFIX) && (key.includes('SERVICE_ROLE') || key.includes('SECRET'))) {
    console.error('\x1b[31m%s\x1b[0m', `⚠️  SECURITY RISK: Sensitive key "${key}" is exposed to the client!`);
    hasError = true;
  }
});

if (hasError) {
  console.log('\x1b[33m%s\x1b[0m', '\nℹ️  Consult /docs/superpowers/plans/implementation_plan.md for setup instructions.');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '✅ Security validation passed. Booting system...\n');
process.exit(0);
