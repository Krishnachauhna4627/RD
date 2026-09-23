import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, tap, throwError, type Observable } from 'rxjs';
import type { Customer, NewCustomer } from './customer.models';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);

  private readonly _customers = signal<Customer[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly customers = this._customers.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<{ customers: Customer[] }>('/api/customers')
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))))
      .subscribe({
        next: ({ customers }) => {
          this._customers.set(customers);
          this._loading.set(false);
        },
        error: (err: Error) => {
          this._error.set(err.message);
          this._loading.set(false);
        },
      });
  }

  create(customer: NewCustomer): Observable<Customer> {
    return this.http.post<{ customer: Customer }>('/api/customers', customer).pipe(
      map(({ customer: created }) => created),
      tap((created) => this._customers.update((list) => [...list, created])),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  update(id: number, customer: NewCustomer): Observable<Customer> {
    return this.http.put<{ customer: Customer }>(`/api/customers/${id}`, customer).pipe(
      map(({ customer: updated }) => updated),
      tap((updated) => this._customers.update((list) => list.map((c) => (c.id === id ? updated : c)))),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  setActive(id: number, isActive: boolean): Observable<Customer> {
    return this.http.patch<{ customer: Customer }>(`/api/customers/${id}/status`, { isActive }).pipe(
      map(({ customer: updated }) => updated),
      tap((updated) => this._customers.update((list) => list.map((c) => (c.id === id ? updated : c)))),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }
}

function messageFor(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Cannot reach the server. Is the backend running on port 3000?';
  }
  return error.error?.error ?? 'Something went wrong. Please try again.';
}
