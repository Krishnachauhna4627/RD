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
 * One row per product and unit that has ever been bought or sold. Grouped by
 * unit as well, so a product whose unit changed shows its Kg and Piece stock
 * apart instead of adding the two together.
 */
export function listStock(): Promise<StockRow[]> {
  return query<StockRow>(
    `SELECT pr.id AS product_id, pr.name, pr.category, pr.material_type, m.quantity_unit,
            SUM(m.purchased) AS purchased, SUM(m.sold) AS sold,
            SUM(m.purchased) - SUM(m.sold) AS quantity,
            SUM(m.spent) AS total_spent,
            MAX(m.purchase_date) AS last_purchased, MAX(m.sale_date) AS last_sold
       FROM (SELECT i.product_id, i.quantity_unit, i.quantity AS purchased, 0 AS sold,
                    i.line_total AS spent, p.purchase_date, NULL AS sale_date
               FROM purchase_items i JOIN purchases p ON p.id = i.purchase_id
             UNION ALL
             SELECT i.product_id, i.quantity_unit, 0, i.quantity, 0, NULL, s.sale_date
               FROM sale_items i JOIN sales s ON s.id = i.sale_id) m
       JOIN products pr ON pr.id = m.product_id
      GROUP BY pr.id, pr.name, pr.category, pr.material_type, m.quantity_unit
      ORDER BY pr.name ASC`,
  );
}
