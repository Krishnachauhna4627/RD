import { Component, HostListener, signal } from '@angular/core';
import { Credentials, LoginDialog } from '../login-dialog/login-dialog';

interface NavLink {
  label: string;
  href: string;
}

@Component({
  imports: [LoginDialog],
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
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

  protected onLogin(credentials: Credentials): void {
    // Hook this up to the auth backend once it exists.
    console.log('login', credentials.username);
    this.closeLogin();
  }
}
