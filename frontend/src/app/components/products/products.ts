import { Component } from '@angular/core';

interface Product {
  name: string;
  blurb: string;
  /** Path without extension; the template serves .webp with a .jpg fallback. */
  image: string;
  alt: string;
}

@Component({
  selector: 'app-products',
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  protected readonly products: Product[] = [
    {
      name: 'Disposable Cups',
      blurb: 'Various sizes and designs',
      image: 'images/products/cups',
      alt: 'Stacks of white and kraft disposable cups',
    },
    {
      name: 'Disposable Plates',
      blurb: 'Eco-friendly & durable',
      image: 'images/products/plates',
      alt: 'A ribbed kraft paper plate behind white paper cups',
    },
    {
      name: 'Food Containers',
      blurb: 'Multiple sizes available',
      image: 'images/products/containers',
      alt: 'Clear hinged food containers and round deli tubs with lids',
    },
    {
      name: 'Disposable Cutlery',
      blurb: 'Spoons, forks, knives',
      image: 'images/products/cutlery',
      alt: 'Wooden disposable spoon, fork and knife standing in a kraft cup',
    },
    {
      name: 'Packaging Material',
      blurb: 'Strong & reliable',
      image: 'images/products/packaging',
      alt: 'A kraft cardboard food box on a wooden table',
    },
  ];
}
