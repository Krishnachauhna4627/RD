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
    { label: 'Dashboard', path: 'overview', icon: 'M3 3h7v9H3V3Zm11 0h7v5h-7V3Zm0 9h7v9h-7v-9ZM3 16h7v5H3v-5Z' },
    { label: 'Products', path: 'products', icon: 'M3 7l9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4' },
    { label: 'Inventory', path: 'inventory', icon: 'M3 8h18v12H3V8Zm0-4h18v4H3V4Zm7 8h4' },
    { label: 'Customers', path: 'customers', icon: 'M16 20v-2a4 4 0 0 0-8 0v2M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' },
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
