/** All SQL touching the customer_rates table. */
import type { RowDataPacket } from 'mysql2/promise';
import { query, transaction } from '../db/pool.js';

export interface CustomerRateRow extends RowDataPacket {
  product_id: number;
  rate: number;
  updated_at: string;
}

/** One change: a number sets the rate, null removes it. */
export interface RateChange {
  productId: number;
  rate: number | null;
}

interface IdRow extends RowDataPacket {
  id: number;
}

/** Thrown when a change refers to a product that does not exist. */
export class UnknownProductError extends Error {
  constructor(readonly productIds: number[]) {
    super(`Unknown product id(s): ${productIds.join(', ')}`);
    this.name = 'UnknownProductError';
  }
}

export function listCustomerRates(customerId: number): Promise<CustomerRateRow[]> {
  return query<CustomerRateRow>(
    'SELECT product_id, rate, updated_at FROM customer_rates WHERE customer_id = ?',
    [customerId],
  );
}

/**
 * Applies a batch of changes in one transaction, so a save either lands whole
 * or not at all. Only the rows sent are touched; every other rate is kept.
 */
export async function saveCustomerRates(
  customerId: number,
  changes: RateChange[],
  updatedBy: number | null,
): Promise<CustomerRateRow[]> {
  await transaction(async (connection) => {
    const ids = [...new Set(changes.map((change) => change.productId))];
    const [found] = await connection.query<IdRow[]>('SELECT id FROM products WHERE id IN (?)', [ids]);
    const known = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new UnknownProductError(missing);
    }

    const removals = changes.filter((c) => c.rate === null).map((c) => c.productId);
    const upserts = changes.filter((c): c is RateChange & { rate: number } => c.rate !== null);

    if (removals.length > 0) {
      await connection.query('DELETE FROM customer_rates WHERE customer_id = ? AND product_id IN (?)', [
        customerId,
        removals,
      ]);
    }

    if (upserts.length > 0) {
      await connection.query(
        `INSERT INTO customer_rates (customer_id, product_id, rate, updated_by)
         VALUES ?
         ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_by = VALUES(updated_by)`,
        [upserts.map((c) => [customerId, c.productId, c.rate, updatedBy])],
      );
    }
  });

  return listCustomerRates(customerId);
}
