import type { ElementRef, OnDestroy, QueryList} from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChildren, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { Snapshot } from './sample-data';
import { rankAirlines, samples } from './sample-data';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnDestroy {
  @ViewChildren('row') private rowElements!: QueryList<ElementRef<HTMLElement>>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private sampleIndex = 0;
  private frame = 0;
  private animations: Animation[] = [];

  readonly snapshot = signal<Snapshot | null>(samples[0]);
  readonly error = signal<string | null>(null);
  readonly rows = signal(rankAirlines(samples[0].airlines));
  readonly displayedCounts = signal<Record<string, number>>(this.counts(samples[0]));
  readonly updating = signal(false);
  readonly announcement = signal('');

  showSampleUpdate(): void {
    if (this.updating()) {return;}
    this.sampleIndex = (this.sampleIndex + 1) % samples.length;
    this.applySnapshot(samples[this.sampleIndex]);
  }

  private counts(snapshot: Snapshot): Record<string, number> {
    return Object.fromEntries(snapshot.airlines.map(airline => [airline.id, airline.count]));
  }

  private applySnapshot(snapshot: Snapshot): void {
    const previous = this.displayedCounts();
    const positions = new Map(this.rowElements.map(({ nativeElement: row }) => [row.dataset['id'], row.getBoundingClientRect().top]));
    this.animations.forEach(animation => { animation.cancel(); });
    this.animations = [];
    cancelAnimationFrame(this.frame);
    this.snapshot.set(snapshot);
    this.rows.set(rankAirlines(snapshot.airlines));
    this.announcement.set('Sample ranking updated.');
    this.changeDetector.detectChanges();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayedCounts.set(this.counts(snapshot));
      return;
    }

    this.updating.set(true);
    this.rowElements.forEach(({ nativeElement: row }) => {
      const distance = (positions.get(row.dataset['id']) ?? row.getBoundingClientRect().top) - row.getBoundingClientRect().top;
      if (distance) {
        this.animations.push(row.animate([
          { transform: `translateY(${distance}px)` },
          { transform: 'translateY(0)' },
        ], { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }));
      }
      const airline = snapshot.airlines.find(item => item.id === row.dataset['id']);
      const count = row.querySelector('.count');
      if (airline && count && previous[airline.id] !== airline.count) {
        this.animations.push(count.animate([
          { color: '#176957', backgroundColor: '#e8f3ed' },
          { color: '#171c24', backgroundColor: 'transparent' },
        ], { duration: 1500, easing: 'ease-out' }));
      }
    });

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 1500, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.displayedCounts.set(Object.fromEntries(snapshot.airlines.map(airline => {
        const from = previous[airline.id] ?? airline.count;
        return [airline.id, Math.round(from + (airline.count - from) * eased)];
      })));
      if (progress < 1) {this.frame = requestAnimationFrame(tick);}
      else {this.updating.set(false);}
    };
    this.frame = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.animations.forEach(animation => { animation.cancel(); });
  }
}
