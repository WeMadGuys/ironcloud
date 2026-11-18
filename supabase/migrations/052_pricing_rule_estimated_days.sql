-- Optional turnaround for this rule. Null hides the estimate on the price sheet.
alter table public.pricing_rules
  add column if not exists estimated_days smallint;

alter table public.pricing_rules
  drop constraint if exists pricing_rules_estimated_days_check;

alter table public.pricing_rules
  add constraint pricing_rules_estimated_days_check
    check (estimated_days is null or (estimated_days >= 1 and estimated_days <= 60));

comment on column public.pricing_rules.estimated_days is
  'Days until the garment is ready. Null means the price sheet does not show a turnaround.';
