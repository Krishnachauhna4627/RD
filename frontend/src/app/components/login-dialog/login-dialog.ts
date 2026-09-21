import { Component, HostListener, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface Credentials {
  username: string;
  password: string;
}

@Component({
  imports: [FormsModule],
  selector: 'app-login-dialog',
  templateUrl: './login-dialog.html',
  styleUrl: './login-dialog.scss',
})
export class LoginDialog {
  readonly closed = output<void>();
  readonly submitted = output<Credentials>();

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.closed.emit();
  }

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  protected submit(): void {
    this.submitted.emit({ username: this.username(), password: this.password() });
  }
}
