-- Allow global/support notifications without a specific category
ALTER TABLE public.notifications ALTER COLUMN category_id DROP NOT NULL;

-- Index to quickly find global support notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_global_user
  ON public.notifications (user_id, is_read, created_at DESC)
  WHERE category_id IS NULL;