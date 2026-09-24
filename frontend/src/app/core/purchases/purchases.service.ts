import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, tap, throwError, type Observable } from 'rxjs';
import type { NewPurchase, Purchase, StockRow } from './purchase.models';

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly http = inject(HttpClient);

  private readonly _purchases = signal<Purchase[]>([]);
  private readonly _stock = signal<StockRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly purchases = this._purchases.asReadonly();
  readonly stock = this._stock.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Loads purchase history and stock together, since the page shows both. */
  load(): void {
    this._loading.set(true);
    this._error.set(null);

    forkJoin({
      purchases: this.http.get<{ purchases: Purchase[] }>('/api/purchases'),
      stock: this.http.get<{ stock: StockRow[] }>('/api/purchases/stock'),
    })
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))))
      .subscribe({
        next: ({ purchases, stock }) => {
          this._purchases.set(purchases.purchases);
          this._stock.set(stock.stock);
          this._loading.set(false);
        },
        error: (err: Error) => {
          this._error.set(err.message);
          this._loading.set(false);
        },
      });
  }

  create(purchase: NewPurchase): Observable<Purchase> {
    return this.http.post<{ purchase: Purchase }>('/api/purchases', purchase).pipe(
      map(({ purchase: created }) => created),
      // Stock is an aggregate, so rather than recompute it here, reload both.
      tap(() => this.load()),
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
