export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  category: string;
  material_type: string;
  quantity: number;
  quantity_unit: string;
  unit_price: number;
  line_total: number;
}

export interface Sale {
  id: number;
  sale_date: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
  items: SaleItem[];
}

/** The last price a product was sold at to one customer. */
export interface LastPrice {
  product_id: number;
  unit_price: number;
  sale_date: string;
}

export interface NewSale {
  /** YYYY-MM-DD */
  saleDate: string;
  customerId: number;
  items: { productId: number; quantity: number; unitPrice: number }[];
}
