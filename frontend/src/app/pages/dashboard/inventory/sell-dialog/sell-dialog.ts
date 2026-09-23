import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CustomersService } from '../../../../core/customers/customers.service';
import { ProductsService } from '../../../../core/products/products.service';
import { PurchasesService } from '../../../../core/purchases/purchases.service';
import { SalesService } from '../../../../core/sales/sales.service';
import { ProductPicker } from '../product-picker/product-picker';

/** One editable row of the sale table. Numbers stay null until typed. */
interface Line {
  key: number;
  productId: number | null;
  quantity: number | null;
  rate: number | null;
  /**
   * True while the rate is the one filled in from the previous rate. It is
   * refilled if the customer changes, but never once the person types over it.
   */
  rateAuto: boolean;
}

/** What this customer has been charged for a product before. */
interface PreviousRate {
  /** Set in the customer's Rates dialog. */
  saved: number | null;
  /** The price on their most recent sale of this product. */
  last: number | null;
  lastDate: string | null;
}

@Component({
  imports: [FormsModule, DecimalPipe, DatePipe, ProductPicker],
  selector: 'app-sell-dialog',
  templateUrl: './sell-dialog.html',
  styleUrls: ['../purchase-dialog/purchase-dialog.scss', './sell-dialog.scss'],
})
export class SellDialog {
  private readonly productsService = inject(ProductsService);
  private readonly customersService = inject(CustomersService);
  private readonly purchases = inject(PurchasesService);
  private readonly sales = inject(SalesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly closed = output<void>();

  private nextKey = 1;

  protected readonly date = signal(today());
  protected readonly customerId = signal<number | null>(null);
  protected readonly lines = signal<Line[]>([this.blankLine()]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loadingPrevious = signal(false);
  private readonly previous = signal<ReadonlyMap<number, PreviousRate>>(new Map());

  protected readonly productsLoading = this.productsService.loading;
  protected readonly customersLoading = this.customersService.loading;

  /** Only active customers can be sold to. */
  protected readonly customers = computed(() =>
    this.customersService
      .customers()
      .filter((c) => c.is_active)
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' })),
  );

  protected readonly products = computed(() =>
    [...this.productsService.products()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.material_type.localeCompare(b.material_type),
    ),
  );

  private readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));

  /** Stock by "productId|unit", matching how the stock API groups it. */
  private readonly stockByKey = computed(
    () => new Map(this.purchases.stock().map((s) => [`${s.product_id}|${s.quantity_unit}`, s.quantity])),
  );

  protected readonly grandTotal = computed(() =>
    this.lines().reduce((sum, line) => sum + this.lineTotal(line), 0),
  );

  constructor() {
    // The dialog can be opened before these pages have ever been visited.
    if (this.productsService.products().length === 0) this.productsService.load();
    if (this.customersService.customers().length === 0) this.customersService.load();
    if (this.purchases.stock().length === 0) this.purchases.load();
  }

  protected unitOf(line: Line): string {
    return (line.productId !== null && this.productById().get(line.productId)?.quantity_unit) || '—';
  }

  protected lineTotal(line: Line): number {
    return (line.quantity ?? 0) * (line.rate ?? 0);
  }

  /** Stock on hand in the product's current unit, or null when it has never been stocked. */
  protected stockOf(line: Line): number | null {
    if (line.productId === null) return null;
    const unit = this.productById().get(line.productId)?.quantity_unit;
    return this.stockByKey().get(`${line.productId}|${unit}`) ?? null;
  }

  protected overStock(line: Line): boolean {
    if (line.quantity === null || line.quantity <= 0) return false;
    return line.quantity > (this.stockOf(line) ?? 0);
  }

  protected previousOf(line: Line): PreviousRate | null {
    return line.productId === null ? null : (this.previous().get(line.productId) ?? null);
  }

  /** Products picked on other rows, so each is sold once per bill. */
  protected takenElsewhere(line: Line): ReadonlySet<number> {
    return new Set(
      this.lines()
        .filter((other) => other.key !== line.key && other.productId !== null)
        .map((other) => other.productId!),
    );
  }

  protected chooseCustomer(id: number | null): void {
    this.customerId.set(id);
    this.error.set(null);
    this.previous.set(new Map());
    if (id === null) return;

    this.loadingPrevious.set(true);
    forkJoin({
      saved: this.customersService.getRates(id),
      last: this.sales.lastPrices(id),
    }).subscribe({
      next: ({ saved, last }) => {
        // The person may have switched customer while this was loading.
        if (this.customerId() !== id) return;

        const map = new Map<number, PreviousRate>();
        for (const r of saved) map.set(r.product_id, { saved: r.rate, last: null, lastDate: null });
        for (const p of last) {
          const entry = map.get(p.product_id) ?? { saved: null, last: null, lastDate: null };
          map.set(p.product_id, { ...entry, last: p.unit_price, lastDate: p.sale_date });
        }
        this.previous.set(map);
        this.loadingPrevious.set(false);

        // Refill rates that came from the previous customer's history.
        this.lines.update((list) =>
          list.map((l) => (l.productId !== null && (l.rateAuto || l.rate === null) ? this.withSuggestedRate(l) : l)),
        );
      },
      error: (err: Error) => {
        if (this.customerId() !== id) return;
        this.loadingPrevious.set(false);
        this.error.set(`Could not load this customer's previous rates: ${err.message}`);
      },
    });

    // Once a customer is chosen, start on the first product.
    if (this.lines().every((l) => l.productId === null)) {
      this.focus(`[data-picker="${this.lines()[0].key}"] input`);
    }
  }

  protected update(line: Line, patch: Partial<Omit<Line, 'key'>>): void {
    this.lines.update((list) => list.map((l) => (l.key === line.key ? { ...l, ...patch } : l)));
  }

  /** Picking a product fills in its previous rate and jumps to the quantity. */
  protected pickProduct(line: Line, productId: number): void {
    this.lines.update((list) =>
      list.map((l) =>
        l.key === line.key ? this.withSuggestedRate({ ...l, productId, rate: l.rateAuto ? null : l.rate }) : l,
      ),
    );
    this.focus(`[data-qty="${line.key}"]`);
  }

  protected typeRate(line: Line, rate: number | null): void {
    this.update(line, { rate, rateAuto: false });
  }

  /** Enter in a rate box: go to the next row, adding one if this was the last. */
  protected nextRow(line: Line): void {
    const list = this.lines();
    const next = list[list.findIndex((l) => l.key === line.key) + 1];
    if (next) this.focus(`[data-picker="${next.key}"] input`);
    else this.addLine(true);
  }

  protected addLine(focusIt = false): void {
    const line = this.blankLine();
    this.lines.update((list) => [...list, line]);
    if (focusIt) this.focus(`[data-picker="${line.key}"] input`);
  }

  protected removeLine(line: Line): void {
    this.lines.update((list) => (list.length === 1 ? [this.blankLine()] : list.filter((l) => l.key !== line.key)));
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.saving()) return;

    if (!this.date()) {
      this.error.set('Pick the sale date.');
      return;
    }
    const customerId = this.customerId();
    if (customerId === null) {
      this.error.set('Choose the customer.');
      return;
    }

    // Rows left completely empty are ignored rather than rejected.
    const filled = this.lines().filter((l) => l.productId !== null || l.quantity !== null || l.rate !== null);
    if (filled.length === 0) {
      this.error.set('Add at least one product.');
      return;
    }

    const bad = filled.find((l) => l.productId === null || !(l.quantity! > 0) || l.rate === null || l.rate < 0);
    if (bad) {
      this.error.set(`Row ${this.lines().indexOf(bad) + 1}: pick a product, a quantity above 0 and a rate.`);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.sales
      .create({
        saleDate: this.date(),
        customerId,
        items: filled.map((l) => ({ productId: l.productId!, quantity: l.quantity!, unitPrice: l.rate! })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closed.emit();
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.error.set(err.message);
        },
      });
  }

  /** Fills an empty rate from the saved rate, falling back to the last sale price. */
  private withSuggestedRate(line: Line): Line {
    if (line.productId === null || (line.rate !== null && !line.rateAuto)) return line;
    const prev = this.previous().get(line.productId);
    const suggested = prev?.saved ?? prev?.last ?? null;
    return { ...line, rate: suggested, rateAuto: suggested !== null };
  }

  /** Focuses an element inside the dialog once the current change has rendered. */
  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private blankLine(): Line {
    return { key: this.nextKey++, productId: null, quantity: null, rate: null, rateAuto: false };
  }
}

/** Today as YYYY-MM-DD in the browser's own timezone, not UTC. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
