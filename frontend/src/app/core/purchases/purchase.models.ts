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
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
  items: PurchaseItem[];
}

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

export interface NewPurchase {
  /** YYYY-MM-DD */
  purchaseDate: string;
  items: { productId: number; quantity: number; unitPrice: number }[];
}
