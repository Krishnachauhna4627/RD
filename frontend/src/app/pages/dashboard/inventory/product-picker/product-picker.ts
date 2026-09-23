import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Product } from '../../../../core/products/product.models';

let nextId = 0;

/**
 * A type-to-filter product dropdown. Every word typed must appear somewhere in
 * the product's name, material or category, so "cup pap" finds "Cup 200ml -
 * Paper". Arrow keys move, Enter picks, Escape closes.
 *
 * The list is position: fixed rather than absolute, because the purchase table
 * scrolls sideways and would otherwise clip it.
 */
@Component({
  selector: 'app-product-picker',
  templateUrl: './product-picker.html',
  styleUrl: './product-picker.scss',
})
export class ProductPicker {
  readonly products = input.required<readonly Product[]>();
  readonly value = input<number | null>(null);
  /** Products that cannot be picked, e.g. already on another row. */
  readonly disabledIds = input<ReadonlySet<number>>(new Set());
  readonly disabled = input(false);
  readonly placeholder = input('Type to search products');
  readonly ariaLabel = input('Product');

  readonly picked = output<number>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly listId = `product-picker-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly position = signal({ top: 0, left: 0, width: 0 });

  constructor() {
    // The dialog and the line table scroll on their own, and scroll events do
    // not bubble, so listen in the capture phase to keep the list attached.
    const reposition = () => this.open() && this.place();
    document.addEventListener('scroll', reposition, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', reposition, true));
  }

  protected readonly selected = computed(() => this.products().find((p) => p.id === this.value()) ?? null);

  protected readonly matches = computed(() => {
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return this.products();
    return this.products().filter((p) => {
      const haystack = `${p.name} ${p.material_type} ${p.category}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  });

  /** Shown in the box: the search while typing, otherwise the picked product. */
  protected readonly text = computed(() => (this.open() ? this.query() : this.labelOf(this.selected())));

  protected labelOf(product: Product | null): string {
    return product ? `${product.name} - ${product.material_type} - ${product.category}` : '';
  }

  protected isDisabled(product: Product): boolean {
    return this.disabledIds().has(product.id);
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected show(): void {
    if (this.disabled() || this.open()) return;
    this.query.set('');
    this.place();
    this.open.set(true);
    this.moveTo(Math.max(0, this.matches().findIndex((p) => p.id === this.value())), 1);
  }

  protected hide(): void {
    this.open.set(false);
  }

  protected onInput(value: string): void {
    if (!this.open()) this.show();
    this.query.set(value);
    this.moveTo(0, 1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.matches().length;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.show();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.moveTo((this.active() + step + count) % Math.max(count, 1), step);
        return;
      }
      case 'Enter':
        // Always stop Enter here, so it never submits the form mid-search.
        event.preventDefault();
        if (this.open()) this.choose(this.matches()[this.active()]);
        else this.show();
        return;
      case 'Escape':
        if (this.open()) {
          // Keep the dialog open; only the list should close.
          event.stopPropagation();
          this.hide();
        }
        return;
      case 'Tab':
        this.hide();
        return;
    }
  }

  protected choose(product: Product | undefined): void {
    if (!product || this.isDisabled(product)) return;
    this.hide();
    this.picked.emit(product.id);
  }

  /** Moves the highlight to `index`, skipping disabled rows in the direction of travel. */
  private moveTo(index: number, step: 1 | -1): void {
    const list = this.matches();
    for (let tries = 0; tries < list.length; tries++) {
      const i = (index + step * tries + list.length) % list.length;
      if (!this.isDisabled(list[i])) {
        this.active.set(i);
        queueMicrotask(() => document.getElementById(this.optionId(i))?.scrollIntoView({ block: 'nearest' }));
        return;
      }
    }
    this.active.set(-1);
  }

  @HostListener('window:resize')
  protected place(): void {
    const rect = this.field().nativeElement.getBoundingClientRect();
    this.position.set({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) });
  }
}
