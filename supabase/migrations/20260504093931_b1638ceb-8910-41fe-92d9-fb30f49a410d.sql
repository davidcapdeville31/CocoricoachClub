-- Normalize header_background_url to stable preset ids.
-- Extract the filename without extension and strip a trailing Vite hash like "-AbC123_x".
UPDATE public.categories
SET header_background_url = regexp_replace(
  regexp_replace(
    -- last path segment
    regexp_replace(header_background_url, '.*/', ''),
    -- strip extension
    '\.[A-Za-z0-9]+$', ''
  ),
  -- strip trailing Vite hash
  '-[A-Za-z0-9_-]{6,}$', ''
)
WHERE header_background_url IS NOT NULL
  AND header_background_url NOT LIKE 'http%'
  AND header_background_url LIKE '%/%';