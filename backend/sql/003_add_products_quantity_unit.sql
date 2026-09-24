-- How a product is counted and sold: by the piece, by weight, by the packet...
-- Existing rows default to Piece, the most common unit in the catalogue.
ALTER TABLE products
  ADD COLUMN quantity_unit VARCHAR(24) NOT NULL DEFAULT 'Piece' AFTER material_type;
