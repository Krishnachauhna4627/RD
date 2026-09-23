import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchasesService } from '../../../core/purchases/purchases.service';
import { PurchaseDialog } from './purchase-dialog/purchase-dialog';

@Component({
  imports: [PurchaseDialog, DecimalPipe, DatePipe],
  selector: 'app-inventory-page',
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  private readonly service = inject(PurchasesService);

  protected readonly stock = this.service.stock;
  protected readonly purchases = this.service.purchases;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly dialogOpen = signal(false);

  /** Purchase ids whose line items are expanded in the history table. */
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());

  protected readonly productsInStock = computed(() => new Set(this.stock().map((s) => s.product_id)).size);

  protected readonly totalSpent = computed(() =>
    this.purchases().reduce((sum, purchase) => sum + purchase.total_amount, 0),
  );

  constructor() {
    this.service.load();
  }

  protected isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  protected toggle(id: number): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
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
