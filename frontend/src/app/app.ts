import { Component } from '@angular/core';
import { About } from './components/about/about';
import { Cta } from './components/cta/cta';
import { Footer } from './components/footer/footer';
import { Header } from './components/header/header';
import { Hero } from './components/hero/hero';
import { Products } from './components/products/products';
import { Stats } from './components/stats/stats';
import { WhyChoose } from './components/why-choose/why-choose';

@Component({
  imports: [Header, Hero, About, Products, WhyChoose, Stats, Cta, Footer],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
