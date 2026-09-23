import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../core/customers/customers.service';
import { CustomerDialog } from './customer-dialog/customer-dialog';
import type { Customer } from '../../../core/customers/customer.models';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@Component({
  imports: [CustomerDialog, FormsModule, DatePipe],
  selector: 'app-customers-page',
  templateUrl: './customers-page.html',
  styleUrl: './customers-page.scss',
})
export class CustomersPage {
  private readonly service = inject(CustomersService);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly dialogOpen = signal(false);
  /** Set while the dialog is editing someone; null means it is adding. */
  protected readonly editingCustomer = signal<Customer | null>(null);

  /** '' means "all" / "no search". */
  protected readonly search = signal('');
  protected readonly filterCity = signal('');
  protected readonly filterType = signal<'' | 'regular' | 'not-regular'>('');
  protected readonly filterStatus = signal<'' | 'active' | 'inactive'>('');

  /** Customer ids whose status change is in flight, so their button can wait. */
  protected readonly statusPending = signal<ReadonlySet<number>>(new Set());
  protected readonly statusError = signal<string | null>(null);

  protected readonly cityOptions = computed(() =>
    [...new Set(this.service.customers().map((c) => c.city).filter((c): c is string => !!c))].sort((a, b) =>
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
    const type = this.filterType();
    const status = this.filterStatus();

    return this.service
      .customers()
      .filter((c) => !city || c.city === city)
      .filter((c) => !type || c.is_regular === (type === 'regular'))
      .filter((c) => !status || c.is_active === (status === 'active'))
      .filter((c) => {
        if (words.length === 0) return true;
        if (digits.length >= 4 && c.phone.includes(digits)) return true;
        const haystack = [c.customer_name, c.contact_person, c.phone, c.email, c.city, c.gstin]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: 'base' }));
  });

  protected readonly total = computed(() => this.service.customers().length);
  protected readonly shown = computed(() => this.filtered().length);
  protected readonly filtersActive = computed(() => this.search() !== '' || this.filterCity() !== '' || this.filterType() !== '' || this.filterStatus() !== '');

  protected readonly activeCount = computed(() => this.service.customers().filter((c) => c.is_active).length);

  protected readonly regularCount = computed(() => this.service.customers().filter((c) => c.is_regular).length);

  protected readonly cityCount = computed(() => this.cityOptions().length);

  protected readonly newThisWeek = computed(() => {
    const since = Date.now() - WEEK_MS;
    // created_at comes back as "YYYY-MM-DD HH:MM:SS" (dateStrings), in local time.
    return this.service.customers().filter((c) => new Date(c.created_at.replace(' ', 'T')).getTime() >= since)
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
    this.filterType.set('');
    this.filterStatus.set('');
  }

  protected toggleActive(customer: Customer): void {
    if (this.statusPending().has(customer.id)) return;

    this.statusError.set(null);
    this.setPending(customer.id, true);

    this.service.setActive(customer.id, !customer.is_active).subscribe({
      next: () => this.setPending(customer.id, false),
      error: (err: Error) => {
        this.setPending(customer.id, false);
        this.statusError.set(`Could not update ${customer.customer_name}: ${err.message}`);
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
    this.editingCustomer.set(null);
    this.dialogOpen.set(true);
  }

  protected editCustomer(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingCustomer.set(null);
  }

  protected reload(): void {
    this.service.load();
  }
}
