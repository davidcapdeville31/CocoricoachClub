-- Add phone column to players table for notifications
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.players.phone IS 'Phone number for SMS notifications via OneSignal';