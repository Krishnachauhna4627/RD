import { Component, HostListener, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuppliersService } from '../../../../core/suppliers/suppliers.service';
import type { NewSupplier, Supplier } from '../../../../core/suppliers/supplier.models';

@Component({
  imports: [FormsModule],
  selector: 'app-supplier-dialog',
  templateUrl: './supplier-dialog.html',
  styleUrl: './supplier-dialog.scss',
})
export class SupplierDialog {
  private readonly suppliers = inject(SuppliersService);

  /** The supplier being edited, or null (the default) to add a new one. */
  readonly supplier = input<Supplier | null>(null);

  readonly closed = output<void>();

  protected readonly editing = computed(() => this.supplier() !== null);

  /** Starts from the supplier being edited, or blank when adding. */
  protected readonly form = linkedSignal<NewSupplier>(() => {
    const s = this.supplier();
    return {
      supplierName: s?.supplier_name ?? '',
      contactPerson: s?.contact_person ?? '',
      phone: s?.phone ?? '',
      email: s?.email ?? '',
      city: s?.city ?? '',
      address: s?.address ?? '',
      gstin: s?.gstin ?? '',
    };
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Cities already on file, offered as suggestions so spellings stay consistent. */
  protected readonly cities = computed(() =>
    [...new Set(this.suppliers.suppliers().map((s) => s.city).filter((c): c is string => !!c))].sort(),
  );

  protected set(field: keyof NewSupplier, value: string): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  protected submit(): void {
    if (this.saving()) return;

    const form = this.form();
    if (!form.supplierName.trim() || !form.phone.trim()) {
      this.error.set('Fill in the supplier name and phone number.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // The API does the real validation (phone digits, email, GSTIN) and trims.
    const existing = this.supplier();
    const request = existing ? this.suppliers.update(existing.id, form) : this.suppliers.create(form);

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
