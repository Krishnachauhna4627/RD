/** All SQL touching the purchases and purchase_items tables. */
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { query, transaction } from '../db/pool.js';

export interface PurchaseLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseItemRow extends RowDataPacket {
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

interface PurchaseHeaderRow extends RowDataPacket {
  id: number;
  purchase_date: string;
  total_amount: number;
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
}

export interface Purchase {
  id: number;
  purchase_date: string;
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
  items: PurchaseItemRow[];
}

interface ProductUnitRow extends RowDataPacket {
  id: number;
  quantity_unit: string;
}

/** Rounds to paise, so the stored line and bill totals always add up. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Thrown when a line refers to a product that does not exist. */
export class UnknownProductError extends Error {
  constructor(readonly productIds: number[]) {
    super(`Unknown product id(s): ${productIds.join(', ')}`);
    this.name = 'UnknownProductError';
  }
}

/**
 * Saves a purchase and its lines in one transaction. Line and bill totals are
 * computed here rather than trusted from the client.
 */
export async function createPurchase(
  purchaseDate: string,
  lines: PurchaseLineInput[],
  createdBy: number | null,
): Promise<Purchase> {
  const purchaseId = await transaction(async (connection) => {
    const ids = [...new Set(lines.map((line) => line.productId))];
    const [products] = await connection.query<ProductUnitRow[]>(
      'SELECT id, quantity_unit FROM products WHERE id IN (?)',
      [ids],
    );
    const unitById = new Map(products.map((p) => [p.id, p.quantity_unit]));
    const missing = ids.filter((id) => !unitById.has(id));
    if (missing.length > 0) {
      throw new UnknownProductError(missing);
    }

    const priced = lines.map((line) => ({
      ...line,
      unit: unitById.get(line.productId)!,
      lineTotal: money(line.quantity * line.unitPrice),
    }));
    const total = money(priced.reduce((sum, line) => sum + line.lineTotal, 0));

    const [header] = await connection.execute<ResultSetHeader>(
      'INSERT INTO purchases (purchase_date, total_amount, created_by) VALUES (?, ?, ?)',
      [purchaseDate, total, createdBy],
    );

    await connection.query(
      `INSERT INTO purchase_items
         (purchase_id, product_id, quantity, quantity_unit, unit_price, line_total)
       VALUES ?`,
      [priced.map((l) => [header.insertId, l.productId, l.quantity, l.unit, l.unitPrice, l.lineTotal])],
    );

    return header.insertId;
  });

  const [created] = await listPurchases(purchaseId);
  if (!created) {
    throw new Error(`Purchase ${purchaseId} vanished immediately after insert`);
  }
  return created;
}

/** Every purchase, newest first, each with its lines. Pass an id for just one. */
export async function listPurchases(onlyId?: number): Promise<Purchase[]> {
  const where = onlyId === undefined ? '' : 'WHERE p.id = ?';
  const params = onlyId === undefined ? [] : [onlyId];

  const headers = await query<PurchaseHeaderRow>(
    `SELECT p.id, p.purchase_date, p.total_amount, p.created_by, u.username AS created_by_username, p.created_at
       FROM purchases p
       LEFT JOIN users u ON u.id = p.created_by
       ${where}
      ORDER BY p.purchase_date DESC, p.id DESC`,
    params,
  );
  if (headers.length === 0) return [];

  const items = await query<PurchaseItemRow>(
    `SELECT i.id, i.purchase_id, i.product_id, pr.name AS product_name, pr.category, pr.material_type,
            i.quantity, i.quantity_unit, i.unit_price, i.line_total
       FROM purchase_items i
       JOIN products pr ON pr.id = i.product_id
       ${onlyId === undefined ? '' : 'WHERE i.purchase_id = ?'}
      ORDER BY i.id ASC`,
    params,
  );

  const itemsByPurchase = new Map<number, PurchaseItemRow[]>();
  for (const item of items) {
    const bucket = itemsByPurchase.get(item.purchase_id);
    if (bucket) bucket.push(item);
    else itemsByPurchase.set(item.purchase_id, [item]);
  }

  return headers.map(({ created_by: _createdBy, ...header }) => ({
    ...header,
    items: itemsByPurchase.get(header.id) ?? [],
  }));
}
