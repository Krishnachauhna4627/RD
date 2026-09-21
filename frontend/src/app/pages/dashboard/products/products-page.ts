import { Component, computed, inject, signal } from '@angular/core';
import { ProductsService } from '../../../core/products/products.service';
import { ProductDialog } from './product-dialog/product-dialog';
import type { Product } from '../../../core/products/product.models';

/** The columns a person can sort by. */
type SortKey = 'name' | 'category' | 'material_type';
type SortDirection = 'asc' | 'desc';

@Component({
  imports: [ProductDialog],
  selector: 'app-products-page',
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly service = inject(ProductsService);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly dialogOpen = signal(false);
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');

  /**
   * Sorting happens here rather than on the server: the catalogue is small
   * enough to hold in memory, and re-sorting locally is instant. If it grows
   * into the thousands, move it to an ORDER BY in the products API.
   */
  protected readonly sorted = computed(() => {
    const key = this.sortKey();
    const factor = this.sortDirection() === 'asc' ? 1 : -1;

    return [...this.service.products()].sort(
      (a, b) =>
        // localeCompare so "Bagasse" and "bagasse" sort together, and numbers
        // inside names order as a person expects (200ml before 1000ml).
        factor * a[key].localeCompare(b[key], undefined, { numeric: true, sensitivity: 'base' }),
    );
  });

  protected readonly total = computed(() => this.service.products().length);

  protected readonly categoryCount = computed(
    () => new Set(this.service.products().map((p) => p.category)).size,
  );

  protected readonly materialCount = computed(
    () => new Set(this.service.products().map((p) => p.material_type)).size,
  );

  constructor() {
    this.service.load();
  }

  /** Click a heading to sort by it; click the same one again to reverse it. */
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected trackById(_index: number, product: Product): number {
    return product.id;
  }

  protected openDialog(): void {
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }

  protected reload(): void {
    this.service.load();
  }
}
