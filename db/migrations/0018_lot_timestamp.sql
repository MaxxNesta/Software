-- 0018_lot_timestamp.sql
-- FIFO consumption already breaks same-day ties by created_at (the row's
-- actual insertion moment) — but that's data-entry order, not necessarily
-- the order stock physically arrived in. If an afternoon delivery gets
-- entered before a morning one, FIFO would draw them backwards with no way
-- to see or correct it, since nothing shown a time at all.
--
-- Widens stock_lot.received_date from date to timestamptz so a real
-- time-of-day can be captured (and edited) at the point of receipt, not just
-- inferred from insertion order. Existing rows cast to midnight on their
-- existing date — their relative ordering against each other is unchanged;
-- only newly-created lots gain real time precision.

alter table stock_lot
  alter column received_date type timestamptz using received_date::timestamptz;
