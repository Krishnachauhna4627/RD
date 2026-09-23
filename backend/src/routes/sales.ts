import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import {
  CustomerUnavailableError,
  UnknownProductError,
  createSale,
  listLastPrices,
  listSales,
} from '../services/sales.js';

export const salesRouter = Router();

// Everything here is dashboard-only.
salesRouter.use(requireAuth);

const saleSchema = z.object({
  saleDate: z.iso.date({ message: 'Sale date must be a valid date (YYYY-MM-DD)' }),
  customerId: z.number({ message: 'Choose a customer' }).int().positive('Choose a customer'),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive('Pick a product for every line'),
        quantity: z.number().positive('Quantity must be more than 0').max(1_000_000_000),
        unitPrice: z.number().nonnegative('Rate cannot be negative').max(1_000_000_000),
      }),
    )
    .min(1, 'Add at least one product')
    .max(200, 'A sale can have at most 200 lines'),
});

/** GET /api/sales — every sale with its lines, newest first. */
salesRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ sales: await listSales() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/sales/last-prices?customerId=N — last price per product sold to that customer. */
salesRouter.get('/last-prices', async (req, res, next) => {
  try {
    const customerId = Number(req.query.customerId);
    if (!Number.isInteger(customerId) || customerId < 1) {
      throw new ApiError(400, 'customerId is required');
    }
    res.json({ prices: await listLastPrices(customerId) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/sales — record one sale bill. */
salesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid sale');
    }

    const { saleDate, customerId, items } = parsed.data;

    try {
      res.status(201).json({ sale: await createSale(saleDate, customerId, items, req.user?.sub ?? null) });
    } catch (error) {
      if (error instanceof CustomerUnavailableError) {
        throw new ApiError(
          400,
          error.reason === 'inactive'
            ? 'This customer is inactive. Activate them before recording a sale.'
            : 'That customer no longer exists. Reload and try again.',
        );
      }
      if (error instanceof UnknownProductError) {
        throw new ApiError(400, 'One of the selected products no longer exists. Reload and try again.');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});
