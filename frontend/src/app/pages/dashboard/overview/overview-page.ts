import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductsService } from '../../../core/products/products.service';
import { PurchasesService } from '../../../core/purchases/purchases.service';
import { SalesService } from '../../../core/sales/sales.service';
import { LOW_STOCK_AT, type StockRow } from '../../../core/purchases/purchase.models';
import { TrendChart, type TrendPoint } from './trend-chart/trend-chart';
import { inr, qty } from './inr';

/** How many months the Purchase / Sales chart covers, including this one. */
const CHART_MONTHS = 6;

interface UnitTotal {
  unit: string;
  quantity: number;
}

interface Transaction {
  key: string;
  date: string;
  createdAt: string;
  type: 'Sale' | 'Purchase';
  products: string;
  party: string | null;
  amount: number;
}

/**
 * The page a person lands on after login. Everything is derived in the browser
 * from the products, stock, purchases and sales lists the other pages already
 * load; nothing here needs an endpoint of its own while the data is this small.
 */
@Component({
  imports: [TrendChart, DatePipe, RouterLink],
  selector: 'app-overview-page',
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
})
export class OverviewPage {
  private readonly productsService = inject(ProductsService);
  private readonly purchasesService = inject(PurchasesService);
  private readonly salesService = inject(SalesService);

  protected readonly user = inject(AuthService).user;
  protected readonly inr = inr;
  protected readonly qty = qty;
  protected readonly lowStockAt = LOW_STOCK_AT;

  protected readonly loading = computed(
    () => this.productsService.loading() || this.purchasesService.loading() || this.salesService.loading(),
  );
  protected readonly error = computed(
    () => this.productsService.error() ?? this.purchasesService.error() ?? this.salesService.error(),
  );

  private readonly stock = this.purchasesService.stock;

  // ── Cards ──────────────────────────────────────────────────────
  protected readonly productCount = computed(() => this.productsService.products().length);

  /** Stock on hand, per unit, counting only what is actually positive. */
  protected readonly inStock = computed(() => byUnit(this.stock(), (s) => Math.max(s.quantity, 0)));

  protected readonly purchasedAmount = computed(() =>
    this.purchasesService.purchases().reduce((sum, p) => sum + p.total_amount, 0),
  );
  protected readonly purchasedUnits = computed(() => byUnit(this.stock(), (s) => s.purchased));

  protected readonly soldAmount = computed(() =>
    this.salesService.sales().reduce((sum, s) => sum + s.total_amount, 0),
  );
  protected readonly soldUnits = computed(() => byUnit(this.stock(), (s) => s.sold));

  /**
   * What the stock left on the shelf cost to buy: each product's remaining
   * quantity at its average purchase price. Unlike "purchased − sold", this
   * does not mix cost prices with selling prices.
   */
  protected readonly remainingValue = computed(() =>
    this.stock().reduce((sum, s) => {
      if (s.purchased <= 0 || s.quantity <= 0) return sum;
      return sum + s.quantity * (s.total_spent / s.purchased);
    }, 0),
  );

  /** Products in their current unit, with their stock (0 if never stocked). */
  private readonly productStock = computed(() => {
    const byKey = new Map(this.stock().map((s) => [`${s.product_id}|${s.quantity_unit}`, s]));
    return this.productsService.products().map((p) => ({
      product: p,
      row: byKey.get(`${p.id}|${p.quantity_unit}`) ?? null,
    }));
  });

  /** Stocked at some point and now down to LOW_STOCK_AT or fewer. */
  protected readonly lowStock = computed(() =>
    this.productStock().filter(({ row }) => row !== null && row.quantity <= LOW_STOCK_AT),
  );

  protected readonly neverStocked = computed(() => this.productStock().filter(({ row }) => row === null).length);

  // ── Chart ──────────────────────────────────────────────────────
  protected readonly trend = computed<TrendPoint[]>(() => {
    const now = new Date();
    const months = Array.from({ length: CHART_MONTHS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-IN', { month: 'short' }),
        title: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        purchases: 0,
        sales: 0,
      };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));

    // Dates are YYYY-MM-DD, so the first seven characters are the month.
    for (const p of this.purchasesService.purchases()) {
      const month = byKey.get(p.purchase_date.slice(0, 7));
      if (month) month.purchases += p.total_amount;
    }
    for (const s of this.salesService.sales()) {
      const month = byKey.get(s.sale_date.slice(0, 7));
      if (month) month.sales += s.total_amount;
    }
    return months;
  });

  // ── Stock summary ──────────────────────────────────────────────
  /** The products with the most on hand, largest first. */
  protected readonly topStock = computed(() =>
    [...this.stock()]
      .filter((s) => s.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6),
  );

  // ── Recent transactions ────────────────────────────────────────
  protected readonly recent = computed<Transaction[]>(() => {
    const summary = (items: { product_name: string }[]) =>
      items.length === 1 ? items[0].product_name : `${items[0]?.product_name ?? '—'} +${items.length - 1} more`;

    const purchases = this.purchasesService.purchases().map<Transaction>((p) => ({
      key: `p${p.id}`,
      date: p.purchase_date,
      createdAt: p.created_at,
      type: 'Purchase',
      products: summary(p.items),
      party: null,
      amount: p.total_amount,
    }));
    const sales = this.salesService.sales().map<Transaction>((s) => ({
      key: `s${s.id}`,
      date: s.sale_date,
      createdAt: s.created_at,
      type: 'Sale',
      products: summary(s.items),
      party: s.customer_name,
      amount: s.total_amount,
    }));

    return [...purchases, ...sales]
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
  });

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  });

  constructor() {
    this.productsService.load();
    this.purchasesService.load();
    this.salesService.load();
  }

  /** "12,540 Piece" for the main unit, then "+ 300 Packet · 20 Kg" for the rest. */
  protected unitLines(totals: readonly UnitTotal[]): { main: string; rest: string } {
    const nonZero = totals.filter((t) => t.quantity !== 0);
    if (nonZero.length === 0) return { main: '0', rest: '' };
    const [first, ...others] = nonZero;
    return {
      main: `${qty(first.quantity)} ${first.unit}`,
      rest: others.map((t) => `${qty(t.quantity)} ${t.unit}`).join(' · '),
    };
  }
}

/** Sums a stock figure per unit, largest total first — units cannot be added together. */
function byUnit(rows: readonly StockRow[], pick: (row: StockRow) => number): UnitTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.quantity_unit, (totals.get(row.quantity_unit) ?? 0) + pick(row));
  return [...totals].map(([unit, quantity]) => ({ unit, quantity })).sort((a, b) => b.quantity - a.quantity);
}
