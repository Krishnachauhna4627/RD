-- Stock bought in, recorded from the Inventory page. One purchase is one bill
-- (a date and a total); its lines live in purchase_items.
CREATE TABLE IF NOT EXISTS purchases (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  purchase_date DATE          NOT NULL,
  total_amount  DECIMAL(12,2) NOT NULL,
  created_by    INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Quantity is DECIMAL rather than INT because some units are weights (2.5 Kg).
-- The unit is copied from the product at purchase time, so changing a
-- product's unit later does not rewrite what was actually bought.
CREATE TABLE IF NOT EXISTS purchase_items (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  purchase_id   INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  quantity      DECIMAL(12,3) NOT NULL,
  quantity_unit VARCHAR(24)   NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  line_total    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_purchase_items_product (product_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE,
  -- RESTRICT: a product that has been purchased cannot be deleted out from
  -- under its stock history.
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
