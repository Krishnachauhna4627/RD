/**
 * Must stay in step with MATERIAL_TYPES in backend/src/services/products.ts —
 * the API rejects anything not on its list.
 */
export const MATERIAL_TYPES = [
  'Thermocol',
  'Plastic',
  'Paper',
  'Bagasse',
  'Aluminium',
  'Wood',
  'Cornstarch',
  'Other',
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** Suggested categories, matching the ranges shown on the public site. */
export const PRODUCT_CATEGORIES = [
  'Disposable Cups',
  'Disposable Plates',
  'Food Containers',
  'Disposable Cutlery',
  'Packaging Material',
] as const;

export interface Product {
  id: number;
  name: string;
  category: string;
  material_type: string;
  created_at: string;
  updated_at: string;
}

export interface NewProduct {
  name: string;
  category: string;
  materialType: string;
}
