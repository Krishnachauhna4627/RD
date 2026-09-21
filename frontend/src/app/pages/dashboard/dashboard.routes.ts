import type { Routes } from '@angular/router';

/**
 * Dashboard routes, loaded only once someone actually opens /dashboard.
 *
 * The shell (sidebar + topbar) is the parent, and each menu entry is a child
 * rendered into its <router-outlet>. Each child is its own `loadComponent`, so
 * opening Products does not also download Inventory, Customers and Sell.
 */
export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard').then((m) => m.Dashboard),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'products' },
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
      {
        path: 'sell',
        title: 'Sell · RD Dashboard',
        loadComponent: () => import('./sell/sell-page').then((m) => m.SellPage),
      },
    ],
  },
];
