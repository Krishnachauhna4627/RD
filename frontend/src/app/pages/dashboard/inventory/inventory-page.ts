import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchasesService } from '../../../core/purchases/purchases.service';
import { SalesService } from '../../../core/sales/sales.service';
import { PurchaseDialog } from './purchase-dialog/purchase-dialog';
import { SellDialog } from './sell-dialog/sell-dialog';

type OpenDialog = 'none' | 'purchase' | 'sell';

@Component({
  imports: [PurchaseDialog, SellDialog, DecimalPipe, DatePipe],
  selector: 'app-inventory-page',
  templateUrl: './inventory-page.html',
  styleUrl: './inventory-page.scss',
})
export class InventoryPage {
  private readonly purchasesService = inject(PurchasesService);
  private readonly salesService = inject(SalesService);

  protected readonly stock = this.purchasesService.stock;
  protected readonly purchases = this.purchasesService.purchases;
  protected readonly sales = this.salesService.sales;
  protected readonly loading = computed(() => this.purchasesService.loading() || this.salesService.loading());
  protected readonly error = computed(() => this.purchasesService.error() ?? this.salesService.error());

  protected readonly dialog = signal<OpenDialog>('none');

  /** Expanded history rows, keyed "p<id>" for purchases and "s<id>" for sales. */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly hasActivity = computed(() => this.purchases().length > 0 || this.sales().length > 0);

  protected readonly productsInStock = computed(
    () => new Set(this.stock().filter((s) => s.quantity > 0).map((s) => s.product_id)).size,
  );

  protected readonly totalSpent = computed(() =>
    this.purchases().reduce((sum, purchase) => sum + purchase.total_amount, 0),
  );

  protected readonly totalSold = computed(() => this.sales().reduce((sum, sale) => sum + sale.total_amount, 0));

  constructor() {
    this.reload();
  }

  protected isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  protected toggle(key: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected open(dialog: Exclude<OpenDialog, 'none'>): void {
    this.dialog.set(dialog);
  }

  protected closeDialog(): void {
    this.dialog.set('none');
  }

  protected reload(): void {
    this.purchasesService.load();
    this.salesService.load();
  }
}
