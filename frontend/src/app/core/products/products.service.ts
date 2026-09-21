import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, tap, throwError, type Observable } from 'rxjs';
import type { NewProduct, Product } from './product.models';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);

  private readonly _products = signal<Product[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly products = this._products.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<{ products: Product[] }>('/api/products')
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))))
      .subscribe({
        next: ({ products }) => {
          this._products.set(products);
          this._loading.set(false);
        },
        error: (err: Error) => {
          this._error.set(err.message);
          this._loading.set(false);
        },
      });
  }

  create(product: NewProduct): Observable<Product> {
    return this.http.post<{ product: Product }>('/api/products', product).pipe(
      // Unwrap to the product itself, so callers do not deal with the envelope.
      map(({ product: created }) => created),
      tap((created) => this._products.update((list) => [...list, created])),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/products/${id}`).pipe(
      tap(() => this._products.update((list) => list.filter((p) => p.id !== id))),
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
