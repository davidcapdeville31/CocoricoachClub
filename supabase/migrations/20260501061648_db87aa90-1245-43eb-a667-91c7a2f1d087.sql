-- Add composed-test (multi-input formula) support
ALTER TABLE public.custom_tests
ADD COLUMN IF NOT EXISTS formula_config jsonb;

COMMENT ON COLUMN public.custom_tests.formula_config IS
'Optional composed-test config. Shape: { enabled: boolean, inputs: [{ key: "A"|"B"..., label: text, unit: text }], formula: text, result_unit: text, result_decimals: int }. The formula references inputs by their key (A, B, C...).';

-- Store the intermediate input values for composed tests on each measurement
ALTER TABLE public.generic_tests
ADD COLUMN IF NOT EXISTS inputs_values jsonb;

COMMENT ON COLUMN public.generic_tests.inputs_values IS
'When the test is a composed test, stores the raw inputs that produced result_value. Shape: { A: number, B: number, ... }';