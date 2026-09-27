import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { createSupplier, listSuppliers, setSupplierActive, updateSupplier } from '../services/suppliers.js';

export const suppliersRouter = Router();

// Everything here is dashboard-only.
suppliersRouter.use(requireAuth);

/** Trims, and turns an empty string into null, for the optional fields. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const supplierSchema = z.object({
  supplierName: z.string().trim().min(1, 'Supplier name is required').max(160),
  contactPerson: optional(120),
  // Spaces, dashes, dots and brackets are dropped before checking, so people
  // can type a number however they write it.
  phone: z
    .string()
    .transform((value) => value.replace(/[\s\-().]/g, ''))
    .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter a valid phone number (7 to 15 digits)')),
  email: optional(160).pipe(z.email('Enter a valid email address').nullable()),
  city: optional(80),
  address: optional(255),
  gstin: optional(15)
    .transform((value) => value?.toUpperCase() ?? null)
    .pipe(
      z
        .string()
        .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5')
        .nullable(),
    ),
});

/** GET /api/suppliers — every supplier, sorted by supplier name. */
suppliersRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ suppliers: await listSuppliers() });
  } catch (error) {
    next(error);
  }
});

/** POST /api/suppliers — add one. */
suppliersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid supplier');
    }

    try {
      res.status(201).json({ supplier: await createSupplier(parsed.data, req.user?.sub ?? null) });
    } catch (error) {
      // The unique key on phone rejected it.
      if (isDuplicate(error)) {
        throw new ApiError(409, `A supplier with phone ${parsed.data.phone} already exists.`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/** PUT /api/suppliers/:id — replace a supplier's details. */
suppliersRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid supplier id');
    }

    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid supplier');
    }

    try {
      const updated = await updateSupplier(id, parsed.data);
      if (!updated) {
        throw new ApiError(404, 'Supplier not found');
      }
      res.json({ supplier: updated });
    } catch (error) {
      if (isDuplicate(error)) {
        throw new ApiError(409, `Another supplier already has phone ${parsed.data.phone}.`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

const statusSchema = z.object({
  isActive: z.boolean({ message: 'isActive must be true or false' }),
});

/** PATCH /api/suppliers/:id/status — mark a supplier active or inactive. */
suppliersRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid supplier id');
    }

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid status');
    }

    const updated = await setSupplierActive(id, parsed.data.isActive);
    if (!updated) {
      throw new ApiError(404, 'Supplier not found');
    }
    res.json({ supplier: updated });
  } catch (error) {
    next(error);
  }
});

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
