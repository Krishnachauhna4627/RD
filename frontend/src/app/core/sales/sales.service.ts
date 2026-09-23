import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, tap, throwError, type Observable } from 'rxjs';
import { PurchasesService } from '../purchases/purchases.service';
import type { LastPrice, NewSale, Sale } from './sale.models';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly purchases = inject(PurchasesService);

  private readonly _sales = signal<Sale[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly sales = this._sales.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<{ sales: Sale[] }>('/api/sales')
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))))
      .subscribe({
        next: ({ sales }) => {
          this._sales.set(sales);
          this._loading.set(false);
        },
        error: (err: Error) => {
          this._error.set(err.message);
          this._loading.set(false);
        },
      });
  }

  lastPrices(customerId: number): Observable<LastPrice[]> {
    return this.http.get<{ prices: LastPrice[] }>('/api/sales/last-prices', { params: { customerId } }).pipe(
      map(({ prices }) => prices),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  create(sale: NewSale): Observable<Sale> {
    return this.http.post<{ sale: Sale }>('/api/sales', sale).pipe(
      map(({ sale: created }) => created),
      tap((created) => {
        this._sales.update((list) => [created, ...list]);
        // A sale changes stock, which the purchases service holds.
        this.purchases.load();
      }),
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
