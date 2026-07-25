-- Rider activation gate: new riders stay inactive until an admin activates them.
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.riders.is_active IS
  'When false, rider may authenticate but cannot use the rider app until an admin activates them.';
