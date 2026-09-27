/** Stock on hand, derived from purchases minus sales. */
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool.js';

export interface StockRow extends RowDataPacket {
  product_id: number;
  name: string;
  category: string;
  material_type: string;
  quantity_unit: string;
  purchased: number;
  sold: number;
  /** purchased - sold; can go negative if sales were entered before purchases. */
  quantity: number;
  total_spent: number;
  last_purchased: string | null;
  last_sold: string | null;
}

/**
 * One row per product that has ever been bought or sold, in the product's
 * current unit. Lines keep the unit they were entered in, but if a product's
 * unit is changed later they are still counted towards the same product, so
 * the stock stays on a single row.
 */
export function listStock(): Promise<StockRow[]> {
  return query<StockRow>(
    `SELECT pr.id AS product_id, pr.name, pr.category, pr.material_type, pr.quantity_unit,
            SUM(m.purchased) AS purchased, SUM(m.sold) AS sold,
            SUM(m.purchased) - SUM(m.sold) AS quantity,
            SUM(m.spent) AS total_spent,
            MAX(m.purchase_date) AS last_purchased, MAX(m.sale_date) AS last_sold
       FROM (SELECT i.product_id, i.quantity AS purchased, 0 AS sold,
                    i.line_total AS spent, p.purchase_date, NULL AS sale_date
               FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
             UNION ALL
             SELECT i.product_id, 0, i.quantity, 0, NULL, s.sale_date
               FROM sale_items i JOIN sales s ON s.id = i.sale_id) m
       JOIN products pr ON pr.id = m.product_id
      GROUP BY pr.id, pr.name, pr.category, pr.material_type, pr.quantity_unit
      ORDER BY pr.name ASC`,
  );
}
