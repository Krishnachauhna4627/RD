import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

interface DashboardLink {
  label: string;
  path: string;
  icon: string;
}

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly sidebarOpen = signal(false);

  /** First letter of the username, for the avatar circle. */
  protected readonly initial = computed(() => this.user()?.username.charAt(0).toUpperCase() ?? '?');

  // Each `icon` is an SVG path drawn in the template.
  protected readonly links: DashboardLink[] = [
    { label: 'Products', path: 'products', icon: 'M3 7l9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4' },
    { label: 'Inventory', path: 'inventory', icon: 'M3 8h18v12H3V8Zm0-4h18v4H3V4Zm7 8h4' },
    { label: 'Customers', path: 'customers', icon: 'M16 20v-2a4 4 0 0 0-8 0v2M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' },
    { label: 'Sell', path: 'sell', icon: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6M9 21h.01M18 21h.01' },
  ];

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout('/');
  }
}
