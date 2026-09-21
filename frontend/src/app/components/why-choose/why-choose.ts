import { Component } from '@angular/core';

@Component({
  selector: 'app-why-choose',
  templateUrl: './why-choose.html',
  styleUrl: './why-choose.scss',
})
export class WhyChoose {
  protected readonly reasons = [
    {
      icon: 'diamond',
      title: 'Quality Assurance',
      text: 'We source and supply only the best quality products.',
    },
    {
      icon: 'rupee',
      title: 'Competitive Pricing',
      text: 'Get the best value for your business.',
    },
    {
      icon: 'truck',
      title: 'Reliable Supply',
      text: 'On-time delivery, always.',
    },
    {
      icon: 'support',
      title: 'Customer Support',
      text: 'We are always here to help you.',
    },
  ] as const;
}
