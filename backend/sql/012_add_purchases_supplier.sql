-- Which supplier a purchase bill came from. The API requires it for new
-- purchases; it is nullable only because bills entered before this column
-- existed have no supplier on record.
ALTER TABLE purchases
  ADD COLUMN supplier_id INT UNSIGNED NULL AFTER purchase_date,
  ADD KEY idx_purchases_supplier (supplier_id),
  -- RESTRICT: a supplier with purchases cannot be deleted out from under them.
  ADD CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT;
