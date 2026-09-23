-- Whether the customer orders regularly. The API always requires it; the
-- default only fills in rows that existed before this column did.
ALTER TABLE customers
  ADD COLUMN is_regular TINYINT(1) NOT NULL DEFAULT 0 AFTER customer_name;
