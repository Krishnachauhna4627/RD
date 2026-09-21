-- Catalogue managed from the dashboard.
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(160) NOT NULL,
  category      VARCHAR(80)  NOT NULL,
  material_type VARCHAR(48)  NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The same product name may exist in different materials (a paper cup and a
  -- plastic cup), so uniqueness is on the combination rather than the name.
  UNIQUE KEY uq_products_name_material (name, material_type),
  KEY idx_products_category (category),
  KEY idx_products_material (material_type)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
