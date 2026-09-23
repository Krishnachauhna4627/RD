import { Component, HostListener, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../../core/products/products.service';
import {
  MATERIAL_TYPES,
  PRODUCT_CATEGORIES,
  QUANTITY_UNITS,
  type Product,
} from '../../../../core/products/product.models';

@Component({
  imports: [FormsModule],
  selector: 'app-product-dialog',
  templateUrl: './product-dialog.html',
  styleUrl: './product-dialog.scss',
})
export class ProductDialog {
  private readonly products = inject(ProductsService);

  /** The product being edited, or null (the default) to add a new one. */
  readonly product = input<Product | null>(null);

  readonly closed = output<void>();
  /** Emitted after a successful add or edit. */
  readonly saved = output<void>();

  protected readonly materials = MATERIAL_TYPES;
  protected readonly categories = PRODUCT_CATEGORIES;
  protected readonly units = QUANTITY_UNITS;

  protected readonly editing = computed(() => this.product() !== null);

  // Each field starts from the product being edited, or blank when adding.
  protected readonly name = linkedSignal(() => this.product()?.name ?? '');
  protected readonly category = linkedSignal(() => this.product()?.category ?? '');
  protected readonly material = linkedSignal(() => this.product()?.material_type ?? '');
  protected readonly unit = linkedSignal(() => this.product()?.quantity_unit ?? 'Piece');

  /** Changing the unit of a saved product does not convert its history. */
  protected readonly unitChanged = computed(() => {
    const original = this.product();
    return original !== null && this.unit() !== original.quantity_unit;
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.saving()) return;

    const name = this.name().trim();
    const category = this.category().trim();
    const materialType = this.material();
    const quantityUnit = this.unit();

    if (!name || !category || !materialType || !quantityUnit) {
      this.error.set('Fill in the product name, category, material type and quantity unit.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const details = { name, category, materialType, quantityUnit };
    const existing = this.product();
    const request = existing ? this.products.update(existing.id, details) : this.products.create(details);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
        this.closed.emit();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.error.set(err.message);
      },
    });
  }
}
