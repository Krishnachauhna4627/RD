import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../core/products/products.service';
import { ProductDialog } from './product-dialog/product-dialog';
import type { Product } from '../../../core/products/product.models';

/** The columns a person can sort by. */
type SortKey = 'name' | 'category' | 'material_type' | 'quantity_unit';
type SortDirection = 'asc' | 'desc';

/** Columns the table can be grouped under, or 'none' for a flat list. */
type GroupKey = 'none' | 'category' | 'material_type';

interface ProductGroup {
  /** null when not grouping, so the template renders one plain block. */
  key: string | null;
  rows: Product[];
}

@Component({
  imports: [ProductDialog, FormsModule],
  selector: 'app-products-page',
  templateUrl: './products-page.html',
  styleUrl: './products-page.scss',
})
export class ProductsPage {
  private readonly service = inject(ProductsService);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly dialogOpen = signal(false);
  /** Set while the dialog is editing a product; null means it is adding. */
  protected readonly editingProduct = signal<Product | null>(null);
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly groupBy = signal<GroupKey>('none');

  /** '' means "all" for both filters. */
  protected readonly filterCategory = signal('');
  protected readonly filterMaterial = signal('');

  protected readonly groupOptions = [
    { value: 'none', label: 'None' },
    { value: 'category', label: 'Category' },
    { value: 'material_type', label: 'Material' },
  ] as const;

  /**
   * Dropdown options are built from what is actually in the catalogue rather
   * than the full material list, so a filter can never produce zero rows on
   * its own.
   */
  protected readonly categoryOptions = computed(() =>
    [...new Set(this.service.products().map((p) => p.category))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  protected readonly materialOptions = computed(() =>
    [...new Set(this.service.products().map((p) => p.material_type))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  /** Filters run before sorting and grouping. */
  protected readonly filtered = computed(() => {
    const category = this.filterCategory();
    const material = this.filterMaterial();

    return this.service
      .products()
      .filter((p) => (!category || p.category === category) && (!material || p.material_type === material));
  });

  protected readonly filtersActive = computed(
    () => this.filterCategory() !== '' || this.filterMaterial() !== '',
  );

  /** True when anything at all has been changed from the default view. */
  protected readonly viewChanged = computed(
    () =>
      this.filtersActive() ||
      this.groupBy() !== 'none' ||
      this.sortKey() !== 'name' ||
      this.sortDirection() !== 'asc',
  );

  /**
   * Sorting happens here rather than on the server: the catalogue is small
   * enough to hold in memory, and re-sorting locally is instant. If it grows
   * into the thousands, move it to an ORDER BY in the products API.
   */
  protected readonly sorted = computed(() => {
    const key = this.sortKey();
    const factor = this.sortDirection() === 'asc' ? 1 : -1;

    return [...this.filtered()].sort(
      (a, b) =>
        // localeCompare so "Bagasse" and "bagasse" sort together, and numbers
        // inside names order as a person expects (200ml before 1000ml).
        factor * a[key].localeCompare(b[key], undefined, { numeric: true, sensitivity: 'base' }),
    );
  });

  /**
   * The sorted rows bucketed under whichever column is being grouped by.
   * Grouping runs after sorting, so rows keep their order inside each group
   * and the groups themselves are listed alphabetically.
   */
  protected readonly groups = computed<ProductGroup[]>(() => {
    const key = this.groupBy();
    const rows = this.sorted();

    if (key === 'none') return [{ key: null, rows }];

    const buckets = new Map<string, Product[]>();
    for (const row of rows) {
      const bucket = buckets.get(row[key]);
      if (bucket) {
        bucket.push(row);
      } else {
        buckets.set(row[key], [row]);
      }
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(([groupName, groupRows]) => ({ key: groupName, rows: groupRows }));
  });

  protected readonly isGrouped = computed(() => this.groupBy() !== 'none');

  protected readonly total = computed(() => this.service.products().length);

  /** How many rows survive the current filters. */
  protected readonly shown = computed(() => this.filtered().length);

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

  protected setGroupBy(key: GroupKey): void {
    this.groupBy.set(key);
  }

  /** Clears the filters, grouping and sorting back to the default view. */
  protected resetView(): void {
    this.filterCategory.set('');
    this.filterMaterial.set('');
    this.groupBy.set('none');
    this.sortKey.set('name');
    this.sortDirection.set('asc');
  }

  protected clearFilters(): void {
    this.filterCategory.set('');
    this.filterMaterial.set('');
  }

  protected openDialog(): void {
    this.editingProduct.set(null);
    this.dialogOpen.set(true);
  }

  protected editProduct(product: Product): void {
    this.editingProduct.set(product);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingProduct.set(null);
  }

  protected reload(): void {
    this.service.load();
  }
}
