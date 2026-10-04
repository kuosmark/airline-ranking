import type { ElementRef, OnDestroy, OnInit, QueryList } from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChildren, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { Airline, Snapshot } from '../shared/ranking';
import { rankAirlines } from '../shared/ranking';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChildren('row') private rowElements!: QueryList<ElementRef<HTMLElement>>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly abort = new AbortController();
  private pollTimer?: ReturnType<typeof setInterval>;
  private frame = 0;
  private animations: Animation[] = [];

  readonly snapshot = signal<Snapshot | null>(null);
  readonly error = signal<string | null>(null);
  readonly rows = signal<Airline[]>([]);
  readonly displayedCounts = signal<Record<string, number>>({});
  readonly announcement = signal('');
  readonly expandedAirlineId = signal<string | null>(null);
  private readonly immediateCountIds = new Set<string>();

  toggleAirline(airline: Airline): void {
    const isExpanded = this.expandedAirlineId() === airline.id;
    this.expandedAirlineId.set(isExpanded ? null : airline.id);
    this.immediateCountIds.add(airline.id);
    this.displayedCounts.update(counts => ({ ...counts, [airline.id]: airline.count }));
  }

  ngOnInit(): void {
    void this.loadRanking();
    this.pollTimer = setInterval(() => { void this.loadRanking(); }, 60_000);
  }

  private async loadRanking(): Promise<void> {
    try {
      const response = await fetch('/api/ranking', {
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10_000)]),
      });
      if (!response.ok) { throw new Error('Ranking request failed'); }
      const snapshot = await response.json() as Snapshot;
      if (this.abort.signal.aborted) { return; }
      this.error.set(null);
      if (snapshot.updatedAt !== this.snapshot()?.updatedAt) {
        this.applySnapshot(snapshot);
      } else {
        this.snapshot.set(snapshot);
        this.rows.set(rankAirlines(snapshot.airlines));
      }
    } catch {
      if (!this.abort.signal.aborted) {
        this.error.set('The ranking is temporarily unavailable. Retrying automatically.');
      }
    }
  }

  private counts(snapshot: Snapshot): Record<string, number> {
    return Object.fromEntries(snapshot.airlines.map(airline => [airline.id, airline.count]));
  }

  private applySnapshot(snapshot: Snapshot): void {
    if (!this.snapshot()) {
      this.snapshot.set(snapshot);
      this.rows.set(rankAirlines(snapshot.airlines));
      this.displayedCounts.set(this.counts(snapshot));
      return;
    }
    this.immediateCountIds.clear();
    const expandedId = this.expandedAirlineId();
    if (!snapshot.airlines.some(airline => airline.id === expandedId)) { this.expandedAirlineId.set(null); }
    if (expandedId) { this.immediateCountIds.add(expandedId); }
    const previous = this.displayedCounts();
    const positions = new Map(this.rowElements.map(({ nativeElement: row }) => [row.dataset['id'], row.getBoundingClientRect().top]));
    this.animations.forEach(animation => { animation.cancel(); });
    this.animations = [];
    cancelAnimationFrame(this.frame);
    this.snapshot.set(snapshot);
    this.rows.set(rankAirlines(snapshot.airlines));
    this.announcement.set('Ranking updated.');
    this.changeDetector.detectChanges();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayedCounts.set(this.counts(snapshot));
      return;
    }

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
        return [airline.id, this.immediateCountIds.has(airline.id) ? airline.count : Math.round(from + (airline.count - from) * eased)];
      })));
      if (progress < 1) {this.frame = requestAnimationFrame(tick);}
    };
    this.frame = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    this.abort.abort();
    clearInterval(this.pollTimer);
    cancelAnimationFrame(this.frame);
    this.animations.forEach(animation => { animation.cancel(); });
  }
}
