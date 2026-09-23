import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import {
  MATERIAL_TYPES,
  QUANTITY_UNITS,
  createProduct,
  deleteProduct,
  listProducts,
} from '../services/products.js';

export const productsRouter = Router();

// Everything here is dashboard-only.
productsRouter.use(requireAuth);

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(160),
  category: z.string().trim().min(1, 'Category is required').max(80),
  materialType: z.enum(MATERIAL_TYPES, {
    message: `Material must be one of: ${MATERIAL_TYPES.join(', ')}`,
  }),
  quantityUnit: z.enum(QUANTITY_UNITS, {
    message: `Quantity unit must be one of: ${QUANTITY_UNITS.join(', ')}`,
  }),
});

/** GET /api/products — the whole catalogue, sorted by name. */
productsRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ products: await listProducts() });
  } catch (error) {
    next(error);
  }
});

/** GET /api/products/materials — the allowed material options. */
productsRouter.get('/materials', (_req, res) => {
  res.json({ materials: MATERIAL_TYPES });
});

/** GET /api/products/units — the allowed quantity units. */
productsRouter.get('/units', (_req, res) => {
  res.json({ units: QUANTITY_UNITS });
});

/** POST /api/products — add one. */
productsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid product');
    }

    const { name, category, materialType, quantityUnit } = parsed.data;

    try {
      res.status(201).json({ product: await createProduct(name, category, materialType, quantityUnit) });
    } catch (error) {
      // The (name, material_type) unique key rejected it.
      if (isDuplicate(error)) {
        throw new ApiError(409, `"${name}" already exists in ${materialType}.`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/products/:id */
productsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid product id');
    }
    try {
      if (!(await deleteProduct(id))) {
        throw new ApiError(404, 'Product not found');
      }
    } catch (error) {
      // purchase_items still points at it.
      if (isReferenced(error)) {
        throw new ApiError(409, 'This product has purchases recorded against it and cannot be deleted.');
      }
      throw error;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

function isReferenced(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_ROW_IS_REFERENCED_2'
  );
}
