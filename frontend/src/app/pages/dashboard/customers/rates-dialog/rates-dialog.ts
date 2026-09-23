import {
  Component,
  ElementRef,
  HostListener,
  type OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../../core/customers/customers.service';
import { ProductsService } from '../../../../core/products/products.service';
import type { Customer, RateChange } from '../../../../core/customers/customer.models';

/**
 * Set a customer's rate for any product. Edits are kept per product id,
 * separately from the filters, so narrowing the list never loses a typed rate.
 */
@Component({
  imports: [FormsModule],
  selector: 'app-rates-dialog',
  templateUrl: './rates-dialog.html',
  styleUrl: './rates-dialog.scss',
})
export class RatesDialog implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly productsService = inject(ProductsService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly customer = input.required<Customer>();
  readonly closed = output<void>();

  /** Rates as stored on the server, by product id. */
  private readonly saved = signal<ReadonlyMap<number, number>>(new Map());
  /** What is in each box right now, by product id. '' means no rate. */
  protected readonly drafts = signal<ReadonlyMap<number, string>>(new Map());

  protected readonly loadingRates = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  /** Set after one close attempt with unsaved edits; a second close discards. */
  protected readonly confirmDiscard = signal(false);

  protected readonly search = signal('');
  protected readonly filterMaterial = signal('');
  protected readonly filterCategory = signal('');
  protected readonly filterSet = signal<'' | 'set' | 'unset'>('');

  protected readonly productsLoading = this.productsService.loading;

  private readonly products = computed(() =>
    [...this.productsService.products()].sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.material_type.localeCompare(b.material_type),
    ),
  );

  protected readonly totalProducts = computed(() => this.products().length);

  protected readonly materialOptions = computed(() =>
    [...new Set(this.products().map((p) => p.material_type))].sort(),
  );

  protected readonly categoryOptions = computed(() =>
    [...new Set(this.products().map((p) => p.category))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  protected readonly rows = computed(() => {
    const words = this.search().toLowerCase().split(/\s+/).filter(Boolean);
    const material = this.filterMaterial();
    const category = this.filterCategory();
    const set = this.filterSet();

    return this.products().filter((p) => {
      if (material && p.material_type !== material) return false;
      if (category && p.category !== category) return false;
      if (set) {
        const hasRate = this.valueOf(p.id) !== '';
        if (hasRate !== (set === 'set')) return false;
      }
      const haystack = `${p.name} ${p.material_type} ${p.category}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  });

  protected readonly filtersActive = computed(
    () => !!(this.search() || this.filterMaterial() || this.filterCategory() || this.filterSet()),
  );

  /** Products whose box differs from what the server has. */
  protected readonly changes = computed<RateChange[]>(() => {
    const saved = this.saved();
    const result: RateChange[] = [];
    for (const [productId, text] of this.drafts()) {
      const rate = text.trim() === '' ? null : Number(text);
      if (rate !== (saved.get(productId) ?? null)) result.push({ productId, rate });
    }
    return result;
  });

  protected readonly dirty = computed(() => this.changes().length > 0);

  /** Rows whose box holds something that is not a valid rate. */
  protected readonly invalidIds = computed(
    () => new Set([...this.drafts()].filter(([, text]) => !isValidRate(text)).map(([id]) => id)),
  );

  protected readonly rateCount = computed(
    () => this.products().filter((p) => this.valueOf(p.id) !== '' && !this.invalidIds().has(p.id)).length,
  );

  constructor() {
    if (this.productsService.products().length === 0) {
      this.productsService.load();
    }
  }

  /** Inputs are not readable in the constructor, so the rates load here. */
  ngOnInit(): void {
    this.loadingRates.set(true);
    this.customersService.getRates(this.customer().id).subscribe({
      next: (rates) => {
        this.applySaved(rates.map((r) => [r.product_id, r.rate]));
        this.loadingRates.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loadingRates.set(false);
      },
    });
  }

  private applySaved(entries: [number, number][]): void {
    this.saved.set(new Map(entries));
    this.drafts.set(new Map(entries.map(([id, rate]) => [id, String(rate)])));
  }

  protected valueOf(productId: number): string {
    return this.drafts().get(productId) ?? '';
  }

  protected isChanged(productId: number): boolean {
    return this.changes().some((c) => c.productId === productId);
  }

  protected setDraft(productId: number, value: string | number | null): void {
    this.notice.set(null);
    this.confirmDiscard.set(false);
    this.drafts.update((current) => new Map(current).set(productId, value === null ? '' : String(value)));
  }

  /** Enter moves down the list, like a spreadsheet. */
  protected nextRow(event: Event, index: number): void {
    event.preventDefault();
    const inputs = this.host.nativeElement.querySelectorAll<HTMLInputElement>('.rate-input');
    inputs[index + 1]?.focus();
    inputs[index + 1]?.select();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.filterMaterial.set('');
    this.filterCategory.set('');
    this.filterSet.set('');
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.saving()) return;
    if (this.dirty() && !this.confirmDiscard()) {
      this.confirmDiscard.set(true);
      return;
    }
    this.closed.emit();
  }

  protected save(): void {
    if (this.saving()) return;

    if (this.invalidIds().size > 0) {
      this.error.set('Some rates are not valid. Use a number of 0 or more, with at most 2 decimals.');
      return;
    }

    const changes = this.changes();
    if (changes.length === 0) {
      this.notice.set('Nothing to save — no rate has changed.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.confirmDiscard.set(false);

    this.customersService.saveRates(this.customer().id, changes).subscribe({
      next: (rates) => {
        this.applySaved(rates.map((r) => [r.product_id, r.rate]));
        this.saving.set(false);
        this.notice.set(`Saved ${changes.length} rate${changes.length === 1 ? '' : 's'}.`);
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.error.set(err.message);
      },
    });
  }
}

/** Empty (no rate) or a non-negative number with at most 2 decimals. */
function isValidRate(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === '' || /^\d{1,9}(\.\d{1,2})?$/.test(trimmed);
}
