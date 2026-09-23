/** All SQL touching the sales and sale_items tables. */
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { query, transaction } from '../db/pool.js';

export interface SaleLineInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SaleItemRow extends RowDataPacket {
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

interface SaleHeaderRow extends RowDataPacket {
  id: number;
  sale_date: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  sale_date: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  created_by_username: string | null;
  created_at: string;
  items: SaleItemRow[];
}

export interface LastPriceRow extends RowDataPacket {
  product_id: number;
  unit_price: number;
  sale_date: string;
}

interface ProductUnitRow extends RowDataPacket {
  id: number;
  quantity_unit: string;
}

interface CustomerStateRow extends RowDataPacket {
  is_active: number;
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

/** Thrown when the customer is missing or has been deactivated. */
export class CustomerUnavailableError extends Error {
  constructor(readonly reason: 'missing' | 'inactive') {
    super(`Customer is ${reason}`);
    this.name = 'CustomerUnavailableError';
  }
}

/**
 * Saves a sale and its lines in one transaction. Line and bill totals are
 * computed here rather than trusted from the client.
 *
 * Selling more than is in stock is allowed on purpose: purchases may not all
 * have been entered yet, and blocking a real sale would be worse than a
 * negative stock figure. The dashboard warns instead.
 */
export async function createSale(
  saleDate: string,
  customerId: number,
  lines: SaleLineInput[],
  createdBy: number | null,
): Promise<Sale> {
  const saleId = await transaction(async (connection) => {
    const [customers] = await connection.query<CustomerStateRow[]>(
      'SELECT is_active FROM customers WHERE id = ?',
      [customerId],
    );
    const [customer] = customers;
    if (!customer) throw new CustomerUnavailableError('missing');
    if (!customer.is_active) throw new CustomerUnavailableError('inactive');

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
      'INSERT INTO sales (sale_date, customer_id, total_amount, created_by) VALUES (?, ?, ?, ?)',
      [saleDate, customerId, total, createdBy],
    );

    await connection.query(
      `INSERT INTO sale_items
         (sale_id, product_id, quantity, quantity_unit, unit_price, line_total)
       VALUES ?`,
      [priced.map((l) => [header.insertId, l.productId, l.quantity, l.unit, l.unitPrice, l.lineTotal])],
    );

    return header.insertId;
  });

  const [created] = await listSales(saleId);
  if (!created) {
    throw new Error(`Sale ${saleId} vanished immediately after insert`);
  }
  return created;
}

/** Every sale, newest first, each with its lines. Pass an id for just one. */
export async function listSales(onlyId?: number): Promise<Sale[]> {
  const where = onlyId === undefined ? '' : 'WHERE s.id = ?';
  const params = onlyId === undefined ? [] : [onlyId];

  const headers = await query<SaleHeaderRow>(
    `SELECT s.id, s.sale_date, s.customer_id, c.customer_name, s.total_amount,
            u.username AS created_by_username, s.created_at
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.created_by
       ${where}
      ORDER BY s.sale_date DESC, s.id DESC`,
    params,
  );
  if (headers.length === 0) return [];

  const items = await query<SaleItemRow>(
    `SELECT i.id, i.sale_id, i.product_id, pr.name AS product_name, pr.category, pr.material_type,
            i.quantity, i.quantity_unit, i.unit_price, i.line_total
       FROM sale_items i
       JOIN products pr ON pr.id = i.product_id
       ${onlyId === undefined ? '' : 'WHERE i.sale_id = ?'}
      ORDER BY i.id ASC`,
    params,
  );

  const itemsBySale = new Map<number, SaleItemRow[]>();
  for (const item of items) {
    const bucket = itemsBySale.get(item.sale_id);
    if (bucket) bucket.push(item);
    else itemsBySale.set(item.sale_id, [item]);
  }

  return headers.map((header) => ({ ...header, items: itemsBySale.get(header.id) ?? [] }));
}

/** The most recent price each product was sold at to this customer. */
export function listLastPrices(customerId: number): Promise<LastPriceRow[]> {
  return query<LastPriceRow>(
    `SELECT product_id, unit_price, sale_date
       FROM (SELECT i.product_id, i.unit_price, s.sale_date,
                    ROW_NUMBER() OVER (PARTITION BY i.product_id
                                       ORDER BY s.sale_date DESC, s.id DESC, i.id DESC) AS rn
               FROM sale_items i
               JOIN sales s ON s.id = i.sale_id
              WHERE s.customer_id = ?) latest
      WHERE rn = 1`,
    [customerId],
  );
}
