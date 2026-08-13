select cron.schedule(
  'session-rpe-digest-30min',
  '15,45 * * * *',
  $$SELECT net.http_post(url:='https://mbloebaovvvgfwxsdzgo.supabase.co/functions/v1/session-rpe-digest', headers:='{"Content-Type": "application/json", "x-cron-secret": "dfa60b68d6420f9ec910ec7b2498cc3952e3153e2ee52b8a"}'::jsonb, body:=concat('{"time": "', now(), '"}')::jsonb) as request_id;$$
);