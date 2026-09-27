export interface Supplier {
  id: number;
  supplier_name: string;
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
export interface NewSupplier {
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  gstin: string;
}
