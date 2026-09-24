-- The dashboard asks for a customer name, not a business name.
ALTER TABLE customers RENAME COLUMN business_name TO customer_name;
