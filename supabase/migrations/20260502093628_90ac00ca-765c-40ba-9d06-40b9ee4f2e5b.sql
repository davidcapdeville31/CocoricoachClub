-- Seed default maintenance setting if missing
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'maintenance_mode',
  jsonb_build_object(
    'enabled', false,
    'message', 'Application en maintenance. Nous revenons très vite !'
  ),
  'Mode maintenance global. Bloque l''accès à toute l''app sauf pour les super admins.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Public function so anonymous visitors can check status (login page, etc.)
CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'maintenance_mode'),
    jsonb_build_object('enabled', false, 'message', '')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO anon, authenticated;
