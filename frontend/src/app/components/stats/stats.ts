import { Component } from '@angular/core';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class Stats {
  protected readonly stats = [
    { icon: 'building', value: '500+', label: 'Products' },
    { icon: 'people', value: '1,000+', label: 'Happy Customers' },
    { icon: 'trophy', value: '5+', label: 'Years of Experience' },
    { icon: 'pin', value: 'Multiple', label: 'Locations Served' },
  ] as const;
}
