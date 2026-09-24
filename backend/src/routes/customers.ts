import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { createCustomer, findCustomerById, listCustomers, setCustomerActive, updateCustomer } from '../services/customers.js';
import { UnknownProductError, listCustomerRates, saveCustomerRates } from '../services/customer-rates.js';

export const customersRouter = Router();

// Everything here is dashboard-only.
customersRouter.use(requireAuth);

/** Trims, and turns an empty string into null, for the optional fields. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const customerSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(160),
  isRegular: z.boolean({ message: 'Choose whether this is a regular customer' }),
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

/** GET /api/customers — every customer, sorted by customer name. */
customersRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ customers: await listCustomers() });
  } catch (error) {
    next(error);
  }
});

/** POST /api/customers — add one. */
customersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid customer');
    }

    try {
      res.status(201).json({ customer: await createCustomer(parsed.data, req.user?.sub ?? null) });
    } catch (error) {
      // The unique key on phone rejected it.
      if (isDuplicate(error)) {
        throw new ApiError(409, `A customer with phone ${parsed.data.phone} already exists.`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/** PUT /api/customers/:id — replace a customer's details. */
customersRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid customer id');
    }

    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid customer');
    }

    try {
      const updated = await updateCustomer(id, parsed.data);
      if (!updated) {
        throw new ApiError(404, 'Customer not found');
      }
      res.json({ customer: updated });
    } catch (error) {
      if (isDuplicate(error)) {
        throw new ApiError(409, `Another customer already has phone ${parsed.data.phone}.`);
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

/** PATCH /api/customers/:id/status — mark a customer active or inactive. */
customersRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ApiError(400, 'Invalid customer id');
    }

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid status');
    }

    const updated = await setCustomerActive(id, parsed.data.isActive);
    if (!updated) {
      throw new ApiError(404, 'Customer not found');
    }
    res.json({ customer: updated });
  } catch (error) {
    next(error);
  }
});

const ratesSchema = z.object({
  rates: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        // null clears the rate. Money, so at most two decimals.
        rate: z
          .number()
          .nonnegative('A rate cannot be negative')
          .max(1_000_000_000, 'That rate is too large')
          // Compared with a tolerance: 1.15 * 100 is 114.99999999999999 in floating point.
          .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
            message: 'A rate can have at most 2 decimals',
          })
          .nullable(),
      }),
    )
    .max(5000, 'Too many rates in one save')
    .refine((list) => new Set(list.map((r) => r.productId)).size === list.length, {
      message: 'Each product can appear only once',
    }),
});

/** Parses :id and makes sure that customer exists, for the rate routes. */
async function customerIdFrom(raw: string | undefined): Promise<number> {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid customer id');
  }
  if (!(await findCustomerById(id))) {
    throw new ApiError(404, 'Customer not found');
  }
  return id;
}

/** GET /api/customers/:id/rates — the rates set for this customer. */
customersRouter.get('/:id/rates', async (req, res, next) => {
  try {
    const id = await customerIdFrom(req.params.id);
    res.json({ rates: await listCustomerRates(id) });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/customers/:id/rates — set or clear rates. Only the products sent
 * change; a rate of null removes that product's rate.
 */
customersRouter.put('/:id/rates', async (req, res, next) => {
  try {
    const id = await customerIdFrom(req.params.id);

    const parsed = ratesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid rates');
    }

    if (parsed.data.rates.length === 0) {
      res.json({ rates: await listCustomerRates(id) });
      return;
    }

    try {
      res.json({ rates: await saveCustomerRates(id, parsed.data.rates, req.user?.sub ?? null) });
    } catch (error) {
      if (error instanceof UnknownProductError) {
        throw new ApiError(400, 'One of the products no longer exists. Reload and try again.');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
