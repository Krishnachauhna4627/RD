-- Goods sold to a customer, recorded from the Inventory page. One sale is one
-- bill (a date, a customer and a total); its lines live in sale_items.
CREATE TABLE IF NOT EXISTS sales (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_date    DATE          NOT NULL,
  customer_id  INT UNSIGNED  NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  created_by   INT UNSIGNED  NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sales_date (sale_date),
  KEY idx_sales_customer (customer_id),
  -- RESTRICT: a customer with sales cannot be deleted out from under them.
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Same shape as purchase_items: the unit is copied from the product at sale
-- time so later unit changes do not rewrite history.
CREATE TABLE IF NOT EXISTS sale_items (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_id       INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  quantity      DECIMAL(12,3) NOT NULL,
  quantity_unit VARCHAR(24)   NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  line_total    DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
