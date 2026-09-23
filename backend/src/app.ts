/** Builds the Express app. Kept separate from index.ts so tests can import it. */
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { purchasesRouter } from './routes/purchases.js';
import { errorHandler, notFound } from './middleware/error.js';
import { pool } from './db/pool.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  /** Liveness plus a real round trip to MySQL, handy when something looks wrong. */
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      res.status(503).json({
        status: 'degraded',
        database: 'unreachable',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/customers', customersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
