import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PurchasesService } from '../../../core/purchases/purchases.service';
import { SalesService } from '../../../core/sales/sales.service';
import { PurchaseDialog } from './purchase-dialog/purchase-dialog';
import { SellDialog } from './sell-dialog/sell-dialog';
import { Ledger, type LedgerRow } from './ledger/ledger';

type OpenDialog = 'none' | 'purchase' | 'sell';
type DetailTab = 'purchase' | 'sell';

@Component({
  imports: [PurchaseDialog, SellDialog, Ledger, DecimalPipe, DatePipe],
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

  /** Which detail list is showing under the stock table. */
  protected readonly tab = signal<DetailTab>('purchase');

  protected readonly purchaseRows = computed<LedgerRow[]>(() =>
    this.purchases().flatMap((p) =>
      p.items.map((i) => ({
        key: i.id,
        date: p.purchase_date,
        billId: p.id,
        customerName: null,
        productName: i.product_name,
        material: i.material_type,
        category: i.category,
        quantity: i.quantity,
        unit: i.quantity_unit,
        rate: i.unit_price,
        total: i.line_total,
        addedBy: p.created_by_username,
      })),
    ),
  );

  protected readonly saleRows = computed<LedgerRow[]>(() =>
    this.sales().flatMap((s) =>
      s.items.map((i) => ({
        key: i.id,
        date: s.sale_date,
        billId: s.id,
        customerName: s.customer_name,
        productName: i.product_name,
        material: i.material_type,
        category: i.category,
        quantity: i.quantity,
        unit: i.quantity_unit,
        rate: i.unit_price,
        total: i.line_total,
        addedBy: s.created_by_username,
      })),
    ),
  );

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
