import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, tap, throwError, type Observable } from 'rxjs';
import type { NewSupplier, Supplier } from './supplier.models';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);

  private readonly _suppliers = signal<Supplier[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly suppliers = this._suppliers.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<{ suppliers: Supplier[] }>('/api/suppliers')
      .pipe(catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))))
      .subscribe({
        next: ({ suppliers }) => {
          this._suppliers.set(suppliers);
          this._loading.set(false);
        },
        error: (err: Error) => {
          this._error.set(err.message);
          this._loading.set(false);
        },
      });
  }

  create(supplier: NewSupplier): Observable<Supplier> {
    return this.http.post<{ supplier: Supplier }>('/api/suppliers', supplier).pipe(
      map(({ supplier: created }) => created),
      tap((created) => this._suppliers.update((list) => [...list, created])),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  update(id: number, supplier: NewSupplier): Observable<Supplier> {
    return this.http.put<{ supplier: Supplier }>(`/api/suppliers/${id}`, supplier).pipe(
      map(({ supplier: updated }) => updated),
      tap((updated) => this._suppliers.update((list) => list.map((s) => (s.id === id ? updated : s)))),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  setActive(id: number, isActive: boolean): Observable<Supplier> {
    return this.http.patch<{ supplier: Supplier }>(`/api/suppliers/${id}/status`, { isActive }).pipe(
      map(({ supplier: updated }) => updated),
      tap((updated) => this._suppliers.update((list) => list.map((s) => (s.id === id ? updated : s)))),
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
