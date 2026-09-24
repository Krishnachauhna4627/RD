import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginDialog } from '../login-dialog/login-dialog';
import { AuthService } from '../../core/auth/auth.service';

interface NavLink {
  label: string;
  href: string;
}

@Component({
  imports: [LoginDialog, RouterLink],
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);

  protected readonly isLoggedIn = this.auth.isLoggedIn;

  protected readonly links: NavLink[] = [
    { label: 'Home', href: '#home' },
    { label: 'About Us', href: '#about' },
    { label: 'Products', href: '#products' },
    { label: 'Contact Us', href: '#contact' },
  ];

  protected readonly active = signal('#home');
  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly loginOpen = signal(false);

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected select(href: string): void {
    this.active.set(href);
    this.menuOpen.set(false);
  }

  protected openLogin(): void {
    this.menuOpen.set(false);
    this.loginOpen.set(true);
  }

  protected closeLogin(): void {
    this.loginOpen.set(false);
  }

}
