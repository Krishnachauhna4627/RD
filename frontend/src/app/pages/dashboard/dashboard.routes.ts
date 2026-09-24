import type { Routes } from '@angular/router';

/**
 * Dashboard routes, loaded only once someone actually opens /dashboard.
 *
 * The shell (sidebar + topbar) is the parent, and each menu entry is a child
 * rendered into its <router-outlet>. Each child is its own `loadComponent`, so
 * opening Products does not also download the overview, Inventory and Customers.
 */
export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard').then((m) => m.Dashboard),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Dashboard · RD Dashboard',
        loadComponent: () => import('./overview/overview-page').then((m) => m.OverviewPage),
      },
      {
        path: 'products',
        title: 'Products · RD Dashboard',
        loadComponent: () => import('./products/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'inventory',
        title: 'Inventory · RD Dashboard',
        loadComponent: () => import('./inventory/inventory-page').then((m) => m.InventoryPage),
      },
      {
        path: 'customers',
        title: 'Customers · RD Dashboard',
        loadComponent: () => import('./customers/customers-page').then((m) => m.CustomersPage),
      },
    ],
  },
];
