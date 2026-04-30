const REQUIRED_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VICTRON_ADMIN_TOKEN',
  'TELTONIKA_RMS_API_TOKEN',
  'TELTONIKA_GATEWAY_BEARER_TOKEN',
];

const OPTIONAL_WEBHOOKS = [
  'FORMS_FORWARD_WEBHOOK_URL',
  'ORDER_FORM_FORWARD_WEBHOOK_URL',
  'RELOCATE_FORM_FORWARD_WEBHOOK_URL',
  'DEACTIVATE_FORM_FORWARD_WEBHOOK_URL',
  'MAKE_WEBHOOK_URL',
  'MAKE_DEACTIVATE_WEBHOOK_URL',
  'MAKE_RELOCATE_WEBHOOK_URL',
  'MAKE_NETWORK_ALERT_WEBHOOK_URL',
  'MAKE_CELLULAR_REPORT_WEBHOOK_URL',
];

const OPTIONAL_FEATURE_ENVS = [
  'CERBO_INGEST_TOKEN',
  'TELTONIKA_ROUTER_USERNAME',
  'TELTONIKA_ROUTER_PASSWORD',
  'TELTONIKA_LAN_CLIENTS_PATHS',
];

const FORBIDDEN_PUBLIC_PREFIX = 'NEXT_PUBLIC_';
const IS_CI = process.env.VERCEL || process.env.CI;

console.log('\x1b[36m%s\x1b[0m', 'NomadXE security pre-flight check...');

let hasMissingSecrets = false;

for (const secret of REQUIRED_SECRETS) {
  if (!process.env[secret]) {
    if (IS_CI) {
      console.warn('\x1b[33m%s\x1b[0m', `WARNING: Missing secret "${secret}". Related admin features may be restricted.`);
    } else {
      console.error('\x1b[31m%s\x1b[0m', `MISSING CRITICAL SECRET: ${secret}`);
      hasMissingSecrets = true;
    }
  }
}

for (const key of OPTIONAL_WEBHOOKS) {
  if (!process.env[key]) {
    console.warn('\x1b[33m%s\x1b[0m', `Optional: "${key}" not set. First-party storage remains active; downstream forwarding may be skipped.`);
  }
}

for (const key of OPTIONAL_FEATURE_ENVS) {
  if (!process.env[key]) {
    console.warn('\x1b[33m%s\x1b[0m', `Optional: "${key}" not set. Related optional collection path may be unavailable.`);
  }
}

for (const key of Object.keys(process.env)) {
  if (key.startsWith(FORBIDDEN_PUBLIC_PREFIX) && (key.includes('SERVICE_ROLE') || key.includes('SECRET'))) {
    console.error('\x1b[31m%s\x1b[0m', `SECURITY RISK: Sensitive key "${key}" is exposed to the client.`);
    hasMissingSecrets = true;
  }
}

if (hasMissingSecrets) {
  console.log('\x1b[33m%s\x1b[0m', '\nConsult the deployment docs for required secret setup.');
  process.exit(1);
}

if (IS_CI) {
  console.log('\x1b[32m%s\x1b[0m', 'Build-phase validation complete. Proceeding to Next.js build...\n');
} else {
  console.log('\x1b[32m%s\x1b[0m', 'Local security validation passed. Booting system...\n');
}

process.exit(0);
