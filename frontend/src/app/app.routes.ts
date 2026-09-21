import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'RD Enterprises',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
  },
  {
    // Everything under /dashboard is a separate bundle, fetched on first visit.
    // The guard runs before the import, so a signed-out visitor never downloads it.
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./pages/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
  },
  { path: '**', redirectTo: '' },
];
