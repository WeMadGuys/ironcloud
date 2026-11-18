-- Optional selling price. Null means the customer pays base_price.
alter table public.pricing_rules
  add column if not exists discount_price numeric(10,2);

alter table public.pricing_rules
  drop constraint if exists pricing_rules_discount_price_check;

alter table public.pricing_rules
  add constraint pricing_rules_discount_price_check
  check (
    discount_price is null
    or (discount_price > 0 and discount_price < base_price)
  );

comment on column public.pricing_rules.discount_price is
  'Amount the customer pays when set and lower than base_price. Null means no discount.';
