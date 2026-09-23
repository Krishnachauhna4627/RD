-- Businesses that order from RD Enterprises, managed from the dashboard.
CREATE TABLE IF NOT EXISTS customers (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_name  VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120) NULL,
  -- Stored digits-only (with an optional leading +), so "98765 43210" and
  -- "98765-43210" are recognised as the same number.
  phone          VARCHAR(16)  NOT NULL,
  email          VARCHAR(160) NULL,
  city           VARCHAR(80)  NULL,
  address        VARCHAR(255) NULL,
  gstin          CHAR(15)     NULL,
  created_by     INT UNSIGNED NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- One phone number is one customer; stops the same shop being added twice.
  UNIQUE KEY uq_customers_phone (phone),
  KEY idx_customers_name (business_name),
  KEY idx_customers_city (city),
  CONSTRAINT fk_customers_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
