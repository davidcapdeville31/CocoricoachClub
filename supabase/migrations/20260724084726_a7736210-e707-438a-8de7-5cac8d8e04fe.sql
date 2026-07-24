
CREATE OR REPLACE FUNCTION public.get_custom_test_labels(_ids uuid[])
RETURNS TABLE(id uuid, name text, unit text, test_category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ct.id, ct.name, ct.unit, ct.test_category
  FROM public.custom_tests ct
  WHERE ct.id = ANY(_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_custom_test_labels(uuid[]) TO authenticated, anon;
