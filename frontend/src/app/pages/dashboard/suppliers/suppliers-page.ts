import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuppliersService } from '../../../core/suppliers/suppliers.service';
import { SupplierDialog } from './supplier-dialog/supplier-dialog';
import type { Supplier } from '../../../core/suppliers/supplier.models';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Component({
  imports: [SupplierDialog, FormsModule, DatePipe],
  selector: 'app-suppliers-page',
  templateUrl: './suppliers-page.html',
  styleUrl: './suppliers-page.scss',
})
export class SuppliersPage {
  private readonly service = inject(SuppliersService);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly dialogOpen = signal(false);
  /** Set while the dialog is editing someone; null means it is adding. */
  protected readonly editingSupplier = signal<Supplier | null>(null);

  /** '' means "all" / "no search". */
  protected readonly search = signal('');
  protected readonly filterCity = signal('');
  protected readonly filterStatus = signal<'' | 'active' | 'inactive'>('');

  /** Supplier ids whose status change is in flight, so their button can wait. */
  protected readonly statusPending = signal<ReadonlySet<number>>(new Set());
  protected readonly statusError = signal<string | null>(null);

  protected readonly cityOptions = computed(() =>
    [...new Set(this.service.suppliers().map((s) => s.city).filter((c): c is string => !!c))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );

  /**
   * Search matches every typed word against name, contact, phone, email, city
   * and GSTIN. Spaces and dashes are ignored for the phone, so "98765 43210"
   * still finds +919876543210.
   */
  protected readonly filtered = computed(() => {
    const words = this.search().toLowerCase().split(/\s+/).filter(Boolean);
    const digits = this.search().replace(/\D/g, '');
    const city = this.filterCity();
    const status = this.filterStatus();

    return this.service
      .suppliers()
      .filter((s) => !city || s.city === city)
      .filter((s) => !status || s.is_active === (status === 'active'))
      .filter((s) => {
        if (words.length === 0) return true;
        if (digits.length >= 4 && s.phone.includes(digits)) return true;
        const haystack = [s.supplier_name, s.contact_person, s.phone, s.email, s.city, s.gstin]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, undefined, { sensitivity: 'base' }));
  });

  protected readonly total = computed(() => this.service.suppliers().length);
  protected readonly shown = computed(() => this.filtered().length);
  protected readonly filtersActive = computed(() => this.search() !== '' || this.filterCity() !== '' || this.filterStatus() !== '');

  protected readonly activeCount = computed(() => this.service.suppliers().filter((s) => s.is_active).length);

  protected readonly cityCount = computed(() => this.cityOptions().length);

  protected readonly newThisWeek = computed(() => {
    const since = Date.now() - WEEK_MS;
    // created_at comes back as "YYYY-MM-DD HH:MM:SS" (dateStrings), in local time.
    return this.service.suppliers().filter((s) => new Date(s.created_at.replace(' ', 'T')).getTime() >= since)
      .length;
  });

  constructor() {
    this.service.load();
  }

  /** Shows a stored phone the way people read it: +91 98765 43210. */
  protected formatPhone(phone: string): string {
    const match = /^(\+91)?(\d{5})(\d{5})$/.exec(phone);
    return match ? [match[1], match[2], match[3]].filter(Boolean).join(' ') : phone;
  }

  protected clearFilters(): void {
    this.search.set('');
    this.filterCity.set('');
    this.filterStatus.set('');
  }

  protected toggleActive(supplier: Supplier): void {
    if (this.statusPending().has(supplier.id)) return;

    this.statusError.set(null);
    this.setPending(supplier.id, true);

    this.service.setActive(supplier.id, !supplier.is_active).subscribe({
      next: () => this.setPending(supplier.id, false),
      error: (err: Error) => {
        this.setPending(supplier.id, false);
        this.statusError.set(`Could not update ${supplier.supplier_name}: ${err.message}`);
      },
    });
  }

  private setPending(id: number, pending: boolean): void {
    this.statusPending.update((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected openDialog(): void {
    this.editingSupplier.set(null);
    this.dialogOpen.set(true);
  }

  protected editSupplier(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingSupplier.set(null);
  }

  protected reload(): void {
    this.service.load();
  }
}
