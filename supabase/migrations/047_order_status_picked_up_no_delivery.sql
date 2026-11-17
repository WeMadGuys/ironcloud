-- Pickup can be confirmed before a delivery day is known.
-- New enum values cannot be used in the same transaction that adds them.
alter type public.order_status add value if not exists 'picked_up_no_delivery';
