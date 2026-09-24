import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Keeps signed-out visitors off the dashboard. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  // Back to the landing page, where the header login dialog lives.
  return router.createUrlTree(['/']);
};
