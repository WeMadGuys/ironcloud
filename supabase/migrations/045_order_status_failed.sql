-- Rider door failures need an order status admin can filter and display.
-- New enum values cannot be used in the same transaction that adds them.
alter type public.order_status add value if not exists 'failed';
