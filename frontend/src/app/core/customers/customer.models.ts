export interface Customer {
  id: number;
  customer_name: string;
  is_regular: boolean;
  is_active: boolean;
  contact_person: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

/** Optional fields may be sent empty; the API stores them as null. */
export interface NewCustomer {
  customerName: string;
  /** null until the person picks one; the form will not submit without it. */
  isRegular: boolean | null;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  gstin: string;
}

/** A price agreed with one customer for one product, per its quantity unit. */
export interface CustomerRate {
  product_id: number;
  rate: number;
  updated_at: string;
}

/** A number sets the rate; null removes it. */
export interface RateChange {
  productId: number;
  rate: number | null;
}
