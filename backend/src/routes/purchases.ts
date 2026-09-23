import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { UnknownProductError, createPurchase, listPurchases } from '../services/purchases.js';
import { listStock } from '../services/stock.js';

export const purchasesRouter = Router();

// Everything here is dashboard-only.
purchasesRouter.use(requireAuth);

const purchaseSchema = z.object({
  purchaseDate: z.iso.date({ message: 'Purchase date must be a valid date (YYYY-MM-DD)' }),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive('Pick a product for every line'),
        quantity: z.number().positive('Quantity must be more than 0').max(1_000_000_000),
        unitPrice: z.number().nonnegative('Per unit amount cannot be negative').max(1_000_000_000),
      }),
    )
    .min(1, 'Add at least one product')
    .max(200, 'A purchase can have at most 200 lines'),
});

/** GET /api/purchases — every purchase with its lines, newest first. */
purchasesRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ purchases: await listPurchases() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/purchases/stock — quantity on hand per product: purchased minus sold. */
purchasesRouter.get('/stock', async (_req, res, next) => {
  try {
    res.json({ stock: await listStock() });
  } catch (error) {
    next(error);
  }
});

/** POST /api/purchases — record one purchase bill. */
purchasesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid purchase');
    }

    const { purchaseDate, items } = parsed.data;

    try {
      res.status(201).json({ purchase: await createPurchase(purchaseDate, items, req.user?.sub ?? null) });
    } catch (error) {
      if (error instanceof UnknownProductError) {
        throw new ApiError(400, 'One of the selected products no longer exists. Reload and try again.');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});
