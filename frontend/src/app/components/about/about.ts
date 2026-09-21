import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  protected readonly highlights = [
    { icon: 'quality', label: 'Quality Products' },
    { icon: 'price', label: 'Competitive Pricing' },
    { icon: 'delivery', label: 'Timely Delivery' },
    { icon: 'support', label: 'Dedicated Support' },
  ] as const;
}
