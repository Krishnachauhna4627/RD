import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';
import type { AuthUser, LoginRequest, LoginResponse } from './auth.models';

const TOKEN_KEY = 'rd.auth.token';
const USER_KEY = 'rd.auth.user';

/**
 * Holds the signed-in user for the whole app.
 *
 * The token and user are mirrored into localStorage so a page refresh does not
 * sign you out. Every read and write is wrapped, because localStorage throws
 * rather than returning null in a private window or with site data blocked.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<AuthUser | null>(readStored<AuthUser>(USER_KEY));
  private readonly _token = signal<string | null>(readStoredString(TOKEN_KEY));

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._token() !== null);

  token(): string | null {
    return this._token();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
      tap((response) => {
        this._token.set(response.token);
        this._user.set(response.user);
        writeStored(TOKEN_KEY, response.token);
        writeStored(USER_KEY, JSON.stringify(response.user));
      }),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(messageFor(error)))),
    );
  }

  logout(redirectTo = '/'): void {
    this._token.set(null);
    this._user.set(null);
    removeStored(TOKEN_KEY);
    removeStored(USER_KEY);
    void this.router.navigateByUrl(redirectTo);
  }
}

/** Turns an HTTP failure into something worth showing a person. */
function messageFor(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Cannot reach the server. Is the backend running on port 3000?';
  }
  return error.error?.error ?? 'Something went wrong. Please try again.';
}

function readStoredString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStored<T>(key: string): T | null {
  const raw = readStoredString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the session still works, it just will not survive a refresh.
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
