import { Component, HostListener, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../../core/products/products.service';
import { MATERIAL_TYPES, PRODUCT_CATEGORIES } from '../../../../core/products/product.models';

@Component({
  imports: [FormsModule],
  selector: 'app-product-dialog',
  templateUrl: './product-dialog.html',
  styleUrl: './product-dialog.scss',
})
export class ProductDialog {
  private readonly products = inject(ProductsService);

  readonly closed = output<void>();
  readonly created = output<void>();

  protected readonly materials = MATERIAL_TYPES;
  protected readonly categories = PRODUCT_CATEGORIES;

  protected readonly name = signal('');
  protected readonly category = signal('');
  protected readonly material = signal('');
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

    if (!name || !category || !materialType) {
      this.error.set('Fill in the product name, category and material type.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.products.create({ name, category, materialType }).subscribe({
      next: () => {
        this.saving.set(false);
        this.created.emit();
        this.closed.emit();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.error.set(err.message);
      },
    });
  }
}
