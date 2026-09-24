import { Component, computed, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** One purchase or sale line, flattened so every row carries its own date. */
export interface LedgerRow {
  /** Unique across the table, e.g. the item id. */
  key: number;
  /** YYYY-MM-DD */
  date: string;
  /** Bill number, so lines from the same bill can be told apart. */
  billId: number;
  /** Only set for sales. */
  customerName: string | null;
  productName: string;
  material: string;
  category: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  addedBy: string | null;
}

type Preset = 'all' | 'today' | 'week' | 'month';

/**
 * A filterable, line-level list of purchases or sales. Filters live here, so
 * each tab keeps its own while you switch between them.
 */
@Component({
  imports: [FormsModule, DatePipe, DecimalPipe],
  selector: 'app-ledger',
  templateUrl: './ledger.html',
  styleUrl: './ledger.scss',
})
export class Ledger {
  readonly rows = input.required<readonly LedgerRow[]>();
  /** Shows the customer column and filter; on for sales. */
  readonly withCustomer = input(false);
  /** Used in headings and empty states: "purchase" or "sale". */
  readonly noun = input.required<string>();

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly search = signal('');
  protected readonly material = signal('');
  protected readonly customer = signal('');

  protected readonly presets: { value: Preset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 days' },
    { value: 'month', label: 'This month' },
    { value: 'all', label: 'All dates' },
  ];

  protected readonly materialOptions = computed(() => [...new Set(this.rows().map((r) => r.material))].sort());

  protected readonly customerOptions = computed(() =>
    [...new Set(this.rows().map((r) => r.customerName).filter((c): c is string => !!c))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  protected readonly filtered = computed(() => {
    const from = this.from();
    const to = this.to();
    const words = this.search().toLowerCase().split(/\s+/).filter(Boolean);
    const material = this.material();
    const customer = this.customer();

    return this.rows()
      .filter((r) => {
        // Dates are YYYY-MM-DD, so plain string comparison orders them correctly.
        if (from && r.date < from) return false;
        if (to && r.date > to) return false;
        if (material && r.material !== material) return false;
        if (customer && r.customerName !== customer) return false;
        const haystack = `${r.productName} ${r.material} ${r.category} ${r.customerName ?? ''}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.billId - a.billId || a.key - b.key);
  });

  protected readonly filteredTotal = computed(() => this.filtered().reduce((sum, r) => sum + r.total, 0));
  protected readonly billCount = computed(() => new Set(this.filtered().map((r) => r.billId)).size);

  protected readonly filtersActive = computed(
    () => !!(this.from() || this.to() || this.search() || this.material() || this.customer()),
  );

  /** Which preset the current dates match, if any, so its chip can light up. */
  protected readonly activePreset = computed<Preset | null>(() => {
    const [from, to] = [this.from(), this.to()];
    for (const preset of this.presets) {
      const range = rangeFor(preset.value);
      if (range.from === from && range.to === to) return preset.value;
    }
    return null;
  });

  protected applyPreset(preset: Preset): void {
    const range = rangeFor(preset);
    this.from.set(range.from);
    this.to.set(range.to);
  }

  protected clearFilters(): void {
    this.from.set('');
    this.to.set('');
    this.search.set('');
    this.material.set('');
    this.customer.set('');
  }

  /** Rows after the first of a bill get a lighter date, so bills read as groups. */
  protected continuesBill(index: number): boolean {
    const rows = this.filtered();
    return index > 0 && rows[index - 1].billId === rows[index].billId;
  }
}

function rangeFor(preset: Preset): { from: string; to: string } {
  const today = new Date();
  switch (preset) {
    case 'all':
      return { from: '', to: '' };
    case 'today':
      return { from: ymd(today), to: ymd(today) };
    case 'week': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { from: ymd(start), to: ymd(today) };
    }
    case 'month':
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  }
}

/** A date as YYYY-MM-DD in the browser's own timezone, not UTC. */
function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
