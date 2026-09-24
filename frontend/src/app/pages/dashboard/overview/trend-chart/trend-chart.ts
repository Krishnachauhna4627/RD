import { Component, computed, input, signal } from '@angular/core';
import { inr, inrShort } from '../inr';

export interface TrendPoint {
  /** Axis label, e.g. "Sep". */
  label: string;
  /** Full label for the tooltip and table, e.g. "September 2026". */
  title: string;
  purchases: number;
  sales: number;
}

// Drawing space; the SVG scales to its container through the viewBox.
const W = 640;
const H = 240;
const PAD = { top: 14, right: 8, bottom: 28, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
/** Bars are capped at 24px and never fill their slot. */
const MAX_BAR = 24;
/** Surface-colored gap between the two touching bars of a group. */
const GAP = 2;
const RADIUS = 4;

/**
 * Purchases and sales per period as grouped columns on one shared ₹ axis.
 * Blue = purchases, orange = sales: slots 1 and 2 of the reference categorical
 * palette, validated against this surface (CVD ΔE 24.7, contrast ≥ 3:1).
 */
@Component({
  selector: 'app-trend-chart',
  templateUrl: './trend-chart.html',
  styleUrl: './trend-chart.scss',
})
export class TrendChart {
  readonly points = input.required<readonly TrendPoint[]>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly inr = inr;

  protected readonly active = signal<number | null>(null);
  protected readonly showTable = signal(false);

  protected readonly isEmpty = computed(() => this.points().every((p) => p.purchases === 0 && p.sales === 0));

  /** A round axis maximum and its tick values, e.g. 0 / 50K / 100K / 150K / 200K. */
  protected readonly scale = computed(() => {
    const max = Math.max(...this.points().map((p) => Math.max(p.purchases, p.sales)), 0);
    const step = niceStep(max / 4);
    const top = Math.max(step * 4, step * Math.ceil(max / step));
    const ticks: number[] = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { top, ticks };
  });

  protected readonly band = computed(() => PLOT_W / Math.max(this.points().length, 1));

  protected readonly barWidth = computed(() => Math.min(MAX_BAR, (this.band() * 0.6 - GAP) / 2));

  protected y(value: number): number {
    return PAD.top + PLOT_H - (value / this.scale().top) * PLOT_H;
  }

  protected tickLabel(value: number): string {
    return inrShort(value);
  }

  protected bandX(index: number): number {
    return PAD.left + index * this.band();
  }

  protected centerX(index: number): number {
    return this.bandX(index) + this.band() / 2;
  }

  /** Left edge of a group's first (purchases) or second (sales) bar. */
  protected barX(index: number, second: boolean): number {
    const group = this.barWidth() * 2 + GAP;
    const start = this.centerX(index) - group / 2;
    return second ? start + this.barWidth() + GAP : start;
  }

  /** A column with a rounded data-end and a square foot on the baseline. */
  protected barPath(index: number, value: number, second: boolean): string {
    if (value <= 0) return '';
    const x = this.barX(index, second);
    const w = this.barWidth();
    const base = PAD.top + PLOT_H;
    const top = this.y(value);
    const r = Math.min(RADIUS, w / 2, base - top);
    return [
      `M${x},${base}`,
      `V${top + r}`,
      `Q${x},${top} ${x + r},${top}`,
      `H${x + w - r}`,
      `Q${x + w},${top} ${x + w},${top + r}`,
      `V${base}`,
      'Z',
    ].join(' ');
  }

  /** Tooltip position as a percentage of the chart width, kept inside the box. */
  protected tooltipLeft(index: number): number {
    return Math.min(82, Math.max(18, (this.centerX(index) / W) * 100));
  }

  protected barLabel(point: TrendPoint): string {
    return `${point.title}: purchases ${inr(point.purchases)}, sales ${inr(point.sales)}`;
  }
}

/** The nearest 1, 2 or 5 × 10ⁿ at or above `raw`. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}
