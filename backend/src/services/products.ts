/** All SQL touching the products table. */
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, queryOne } from '../db/pool.js';

/**
 * The material options the dashboard offers.
 *
 * Kept as a fixed list rather than a free-text column so the table can be
 * filtered and grouped reliably — free text gives you "Plastic", "plastic"
 * and "PLASTIC" as three different materials. The frontend has a matching
 * list; add to both when a new material is needed.
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

/**
 * The units a product's quantity can be counted in. A fixed list for the same
 * reason as MATERIAL_TYPES; the frontend mirrors it.
 */
export const QUANTITY_UNITS = [
  'Piece',
  'Packet',
  'Box',
  'Dozen',
  'Kg',
  'Gram',
  'Roll',
  'Bundle',
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface ProductRow extends RowDataPacket {
  id: number;
  name: string;
  category: string;
  material_type: string;
  quantity_unit: string;
  created_at: string;
  updated_at: string;
}

export function listProducts(): Promise<ProductRow[]> {
  return query<ProductRow>(
    'SELECT id, name, category, material_type, quantity_unit, created_at, updated_at FROM products ORDER BY name ASC',
  );
}

export function findProductById(id: number): Promise<ProductRow | null> {
  return queryOne<ProductRow>(
    'SELECT id, name, category, material_type, quantity_unit, created_at, updated_at FROM products WHERE id = ?',
    [id],
  );
}

export async function createProduct(
  name: string,
  category: string,
  materialType: string,
  quantityUnit: string,
): Promise<ProductRow> {
  const result = await execute(
    'INSERT INTO products (name, category, material_type, quantity_unit) VALUES (?, ?, ?, ?)',
    [name, category, materialType, quantityUnit],
  );

  const created = await findProductById(result.insertId);
  if (!created) {
    throw new Error(`Product ${result.insertId} vanished immediately after insert`);
  }
  return created;
}

/** Replaces every editable field. Returns null when there is no such product. */
export async function updateProduct(
  id: number,
  name: string,
  category: string,
  materialType: string,
  quantityUnit: string,
): Promise<ProductRow | null> {
  await execute(
    'UPDATE products SET name = ?, category = ?, material_type = ?, quantity_unit = ? WHERE id = ?',
    [name, category, materialType, quantityUnit, id],
  );
  // Read it back rather than trust affectedRows, which is 0 both for a
  // missing id and for a save that changed nothing.
  return findProductById(id);
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM products WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
