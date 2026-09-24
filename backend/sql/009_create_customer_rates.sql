-- The price agreed with a customer for a product, per its quantity unit.
-- One row per (customer, product); a product with no row has no special rate.
CREATE TABLE IF NOT EXISTS customer_rates (
  customer_id INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  rate        DECIMAL(12,2) NOT NULL,
  updated_by  INT UNSIGNED  NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, product_id),
  KEY idx_customer_rates_product (product_id),
  -- A rate means nothing without its customer or product, so both cascade.
  CONSTRAINT fk_customer_rates_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_rates_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_rates_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
