-- Businesses RD Enterprises buys stock from, managed from the dashboard.
-- Same shape as customers, minus the customer-only is_regular flag.
CREATE TABLE IF NOT EXISTS suppliers (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_name  VARCHAR(160) NOT NULL,
  -- Inactive suppliers stay on file but are marked as no longer used.
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  contact_person VARCHAR(120) NULL,
  -- Stored digits-only (with an optional leading +), like customers.phone.
  phone          VARCHAR(16)  NOT NULL,
  email          VARCHAR(160) NULL,
  city           VARCHAR(80)  NULL,
  address        VARCHAR(255) NULL,
  gstin          CHAR(15)     NULL,
  created_by     INT UNSIGNED NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- One phone number is one supplier; stops the same one being added twice.
  UNIQUE KEY uq_suppliers_phone (phone),
  KEY idx_suppliers_name (supplier_name),
  KEY idx_suppliers_city (city),
  KEY idx_suppliers_active (is_active),
  CONSTRAINT fk_suppliers_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
