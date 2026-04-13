-- Ensure the pg_cron extension exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job to run every day at midnight (UTC)
-- Deletes auth_tokens older than 30 days based on either used_at or expires_at.
SELECT cron.schedule(
  'cleanup_old_auth_tokens', 
  '0 0 * * *',               
  $$
    DELETE FROM public.auth_tokens
    WHERE (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '30 days')
       OR (used_at IS NULL AND expires_at < NOW() - INTERVAL '30 days');
  $$
);
