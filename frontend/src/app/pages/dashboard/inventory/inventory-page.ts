import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchasesService } from '../../../core/purchases/purchases.service';
import { LOW_STOCK_AT } from '../../../core/purchases/purchase.models';
import { SalesService } from '../../../core/sales/sales.service';
import { PurchaseDialog } from './purchase-dialog/purchase-dialog';
import { SellDialog } from './sell-dialog/sell-dialog';
import { Ledger, type LedgerRow } from './ledger/ledger';

type OpenDialog = 'none' | 'purchase' | 'sell';
type DetailTab = 'purchase' | 'sell';
/** '' is everything; the rest match the stock figure against LOW_STOCK_AT. */
type StockStatus = '' | 'in' | 'low' | 'out';

@Component({
  imports: [PurchaseDialog, SellDialog, Ledger, FormsModule, DecimalPipe, DatePipe],
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

  protected readonly lowStockAt = LOW_STOCK_AT;

  // Stock on hand filters. '' means "all".
  protected readonly stockSearch = signal('');
  protected readonly stockMaterial = signal('');
  protected readonly stockCategory = signal('');
  protected readonly stockStatus = signal<StockStatus>('');

  protected readonly stockMaterials = computed(() => [...new Set(this.stock().map((s) => s.material_type))].sort());
  protected readonly stockCategories = computed(() =>
    [...new Set(this.stock().map((s) => s.category))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  protected readonly filteredStock = computed(() => {
    const words = this.stockSearch().toLowerCase().split(/\s+/).filter(Boolean);
    const material = this.stockMaterial();
    const category = this.stockCategory();
    const status = this.stockStatus();

    return this.stock().filter((s) => {
      if (material && s.material_type !== material) return false;
      if (category && s.category !== category) return false;
      if (status === 'in' && s.quantity <= 0) return false;
      if (status === 'low' && !(s.quantity > 0 && s.quantity <= LOW_STOCK_AT)) return false;
      if (status === 'out' && s.quantity > 0) return false;
      const haystack = `${s.name} ${s.material_type} ${s.category} ${s.quantity_unit}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  });

  protected readonly stockFiltersActive = computed(
    () => !!(this.stockSearch() || this.stockMaterial() || this.stockCategory() || this.stockStatus()),
  );

  protected clearStockFilters(): void {
    this.stockSearch.set('');
    this.stockMaterial.set('');
    this.stockCategory.set('');
    this.stockStatus.set('');
  }

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
