import { Component, HostListener, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../../core/customers/customers.service';
import type { Customer, NewCustomer } from '../../../../core/customers/customer.models';

type TextField = Exclude<keyof NewCustomer, 'isRegular'>;

@Component({
  imports: [FormsModule],
  selector: 'app-customer-dialog',
  templateUrl: './customer-dialog.html',
  styleUrl: './customer-dialog.scss',
})
export class CustomerDialog {
  private readonly customers = inject(CustomersService);

  /** The customer being edited, or null (the default) to add a new one. */
  readonly customer = input<Customer | null>(null);

  readonly closed = output<void>();

  protected readonly editing = computed(() => this.customer() !== null);

  /** Starts from the customer being edited, or blank when adding. */
  protected readonly form = linkedSignal<NewCustomer>(() => {
    const c = this.customer();
    return {
      customerName: c?.customer_name ?? '',
      isRegular: c ? c.is_regular : null,
      contactPerson: c?.contact_person ?? '',
      phone: c?.phone ?? '',
      email: c?.email ?? '',
      city: c?.city ?? '',
      address: c?.address ?? '',
      gstin: c?.gstin ?? '',
    };
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Cities already on file, offered as suggestions so spellings stay consistent. */
  protected readonly cities = computed(() =>
    [...new Set(this.customers.customers().map((c) => c.city).filter((c): c is string => !!c))].sort(),
  );

  protected set(field: TextField, value: string): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  protected setRegular(isRegular: boolean): void {
    this.form.update((current) => ({ ...current, isRegular }));
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.saving()) return;

    const form = this.form();
    if (!form.customerName.trim() || !form.phone.trim()) {
      this.error.set('Fill in the customer name and phone number.');
      return;
    }
    if (form.isRegular === null) {
      this.error.set('Choose whether this is a regular customer.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // The API does the real validation (phone digits, email, GSTIN) and trims.
    const existing = this.customer();
    const request = existing ? this.customers.update(existing.id, form) : this.customers.create(form);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closed.emit();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.error.set(err.message);
      },
    });
  }
}
