import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { authenticate, findById, toPublicUser } from '../services/users.js';
import { signToken } from '../services/tokens.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(200),
});

/** POST /api/auth/login — what the header login dialog calls. */
authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
    }

    const user = await authenticate(parsed.data.username, parsed.data.password);
    if (!user) {
      // Deliberately identical whether the username is unknown or the
      // password is wrong.
      throw new ApiError(401, 'Invalid username or password');
    }

    res.json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

/** GET /api/auth/me — confirms a token is still good and returns its user. */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = req.user && (await findById(req.user.sub));
    if (!user || !user.is_active) {
      throw new ApiError(401, 'Account is no longer active');
    }
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
});
