import { Component, HostListener, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [FormsModule],
  selector: 'app-login-dialog',
  templateUrl: './login-dialog.html',
  styleUrl: './login-dialog.scss',
})
export class LoginDialog {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly closed = output<void>();

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.submitting()) return;
    this.closed.emit();
  }

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  protected submit(): void {
    if (this.submitting()) return;

    const username = this.username().trim();
    const password = this.password();

    if (!username || !password) {
      this.error.set('Enter both your username and password.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.login({ username, password }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closed.emit();
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.error.set(err.message);
      },
    });
  }
}
