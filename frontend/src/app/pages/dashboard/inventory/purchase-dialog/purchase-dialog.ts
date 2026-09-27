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
import { ProductsService } from '../../../../core/products/products.service';
import { PurchasesService } from '../../../../core/purchases/purchases.service';
import { SuppliersService } from '../../../../core/suppliers/suppliers.service';
import { ProductPicker } from '../product-picker/product-picker';

/** One editable row of the purchase table. Numbers stay null until typed. */
interface Line {
  key: number;
  productId: number | null;
  quantity: number | null;
  unitPrice: number | null;
  /**
   * True while the per unit amount is the one filled in from the last purchase.
   * It is refilled if the supplier changes, but never once the person types over it.
   */
  priceAuto: boolean;
}

/** The price on this supplier's most recent purchase of a product. */
interface LastPrice {
  price: number;
  date: string;
}

@Component({
  imports: [FormsModule, DecimalPipe, DatePipe, ProductPicker],
  selector: 'app-purchase-dialog',
  templateUrl: './purchase-dialog.html',
  styleUrls: ['./purchase-dialog.scss', '../party-fields.scss'],
})
export class PurchaseDialog {
  private readonly productsService = inject(ProductsService);
  private readonly purchases = inject(PurchasesService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly closed = output<void>();

  private nextKey = 1;

  protected readonly date = signal(today());
  protected readonly supplierId = signal<number | null>(null);
  protected readonly lines = signal<Line[]>([this.blankLine()]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loadingLast = signal(false);
  private readonly last = signal<ReadonlyMap<number, LastPrice>>(new Map());

  protected readonly productsLoading = this.productsService.loading;
  protected readonly suppliersLoading = this.suppliersService.loading;

  /** Only active suppliers can be bought from. */
  protected readonly suppliers = computed(() =>
    this.suppliersService
      .suppliers()
      .filter((s) => s.is_active)
      .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, undefined, { sensitivity: 'base' })),
  );

  /** Sorted the way the dropdown reads: name, then material. */
  protected readonly products = computed(() =>
    [...this.productsService.products()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.material_type.localeCompare(b.material_type),
    ),
  );

  private readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));

  protected readonly grandTotal = computed(() =>
    this.lines().reduce((sum, line) => sum + this.lineTotal(line), 0),
  );

  constructor() {
    // The dialog can be opened before these pages have ever been visited.
    if (this.productsService.products().length === 0) this.productsService.load();
    if (this.suppliersService.suppliers().length === 0) this.suppliersService.load();
  }

  protected unitOf(line: Line): string {
    return (line.productId !== null && this.productById().get(line.productId)?.quantity_unit) || '—';
  }

  protected lineTotal(line: Line): number {
    return (line.quantity ?? 0) * (line.unitPrice ?? 0);
  }

  protected lastOf(line: Line): LastPrice | null {
    return line.productId === null ? null : (this.last().get(line.productId) ?? null);
  }

  /** Products picked on other rows, so each is bought once per bill. */
  protected takenElsewhere(line: Line): ReadonlySet<number> {
    return new Set(
      this.lines()
        .filter((other) => other.key !== line.key && other.productId !== null)
        .map((other) => other.productId!),
    );
  }

  protected chooseSupplier(id: number | null): void {
    this.supplierId.set(id);
    this.error.set(null);
    this.last.set(new Map());
    if (id === null) return;

    this.loadingLast.set(true);
    this.purchases.lastPrices(id).subscribe({
      next: (prices) => {
        // The person may have switched supplier while this was loading.
        if (this.supplierId() !== id) return;

        this.last.set(new Map(prices.map((p) => [p.product_id, { price: p.unit_price, date: p.purchase_date }])));
        this.loadingLast.set(false);

        // Refill amounts that came from the previous supplier's history.
        this.lines.update((list) =>
          list.map((l) =>
            l.productId !== null && (l.priceAuto || l.unitPrice === null) ? this.withLastPrice(l) : l,
          ),
        );
      },
      error: (err: Error) => {
        if (this.supplierId() !== id) return;
        this.loadingLast.set(false);
        this.error.set(`Could not load this supplier's last rates: ${err.message}`);
      },
    });

    // Once a supplier is chosen, start on the first product.
    if (this.lines().every((l) => l.productId === null)) {
      this.focus(`[data-picker="${this.lines()[0].key}"] input`);
    }
  }

  /** Picking a product fills in its last purchase price and jumps to the quantity. */
  protected pickProduct(line: Line, productId: number): void {
    this.lines.update((list) =>
      list.map((l) =>
        l.key === line.key
          ? this.withLastPrice({ ...l, productId, unitPrice: l.priceAuto ? null : l.unitPrice })
          : l,
      ),
    );
    this.focus(`[data-qty="${line.key}"]`);
  }

  protected typePrice(line: Line, unitPrice: number | null): void {
    this.update(line, { unitPrice, priceAuto: false });
  }

  /** Enter in a per unit box: go to the next row, adding one if this was the last. */
  protected nextRow(line: Line): void {
    const list = this.lines();
    const next = list[list.findIndex((l) => l.key === line.key) + 1];
    if (next) this.focus(`[data-picker="${next.key}"] input`);
    else this.addLine(true);
  }

  protected update(line: Line, patch: Partial<Omit<Line, 'key'>>): void {
    this.lines.update((list) => list.map((l) => (l.key === line.key ? { ...l, ...patch } : l)));
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
      this.error.set('Pick the purchase date.');
      return;
    }
    const supplierId = this.supplierId();
    if (supplierId === null) {
      this.error.set('Choose the supplier.');
      return;
    }

    // Rows left completely empty are ignored rather than rejected.
    const filled = this.lines().filter((l) => l.productId !== null || l.quantity !== null || l.unitPrice !== null);
    if (filled.length === 0) {
      this.error.set('Add at least one product.');
      return;
    }

    const row = filled.findIndex(
      (l) => l.productId === null || !(l.quantity! > 0) || l.unitPrice === null || l.unitPrice < 0,
    );
    if (row !== -1) {
      this.error.set(`Row ${this.lines().indexOf(filled[row]) + 1}: pick a product, a quantity above 0 and a per unit amount.`);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.purchases
      .create({
        purchaseDate: this.date(),
        supplierId,
        items: filled.map((l) => ({ productId: l.productId!, quantity: l.quantity!, unitPrice: l.unitPrice! })),
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

  /** Fills an empty per unit amount from this supplier's last purchase price. */
  private withLastPrice(line: Line): Line {
    if (line.productId === null || (line.unitPrice !== null && !line.priceAuto)) return line;
    const suggested = this.last().get(line.productId)?.price ?? null;
    return { ...line, unitPrice: suggested, priceAuto: suggested !== null };
  }

  /** Focuses an element inside the dialog once the current change has rendered. */
  private focus(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private blankLine(): Line {
    return { key: this.nextKey++, productId: null, quantity: null, unitPrice: null, priceAuto: false };
  }
}

/** Today as YYYY-MM-DD in the browser's own timezone, not UTC. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
