export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  category: string;
  material_type: string;
  quantity: number;
  quantity_unit: string;
  unit_price: number;
  line_total: number;
}

export interface Purchase {
  id: number;
  purchase_date: string;
  /** Null only on bills entered before purchases recorded a supplier. */
  supplier_id: number | null;
  supplier_name: string | null;
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
  items: PurchaseItem[];
}

/** A product at or below this many units in stock counts as low. */
export const LOW_STOCK_AT = 10;

/** One product's stock on hand: everything purchased minus everything sold. */
export interface StockRow {
  product_id: number;
  name: string;
  category: string;
  material_type: string;
  quantity_unit: string;
  purchased: number;
  sold: number;
  /** purchased - sold; negative if sales were entered before their purchases. */
  quantity: number;
  total_spent: number;
  last_purchased: string | null;
  last_sold: string | null;
}

/** The last price a product was bought at from one supplier. */
export interface LastPurchasePrice {
  product_id: number;
  unit_price: number;
  purchase_date: string;
}

export interface NewPurchase {
  /** YYYY-MM-DD */
  purchaseDate: string;
  supplierId: number;
  items: { productId: number; quantity: number; unitPrice: number }[];
}
