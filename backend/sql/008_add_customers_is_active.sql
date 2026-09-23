-- Inactive customers stay on file (and in history) but are marked as no
-- longer ordering. New customers start active.
ALTER TABLE customers
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_regular,
  ADD KEY idx_customers_active (is_active);
