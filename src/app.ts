import type { ElementRef, OnDestroy, OnInit, QueryList } from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChildren, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { Airline, Snapshot } from '../shared/ranking';
import { rankAirlines } from '../shared/ranking';
import { formatSnapshotAge } from './snapshot-age';

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
  private animations: Animation[] = [];

  readonly snapshot = signal<Snapshot | null>(null);
  private readonly now = signal(Date.now());
  readonly snapshotAge = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? formatSnapshotAge(snapshot.updatedAt, this.now()) : '';
  });
  readonly error = signal<string | null>(null);
  readonly rows = signal<Airline[]>([]);
  readonly announcement = signal('');
  readonly expandedAirlineId = signal<string | null>(null);
  readonly isShowingAllTypes = signal(false);
  readonly collapsedTypeLimit = 5;

  toggleAirline(airline: Airline): void {
    const isExpanded = this.expandedAirlineId() === airline.id;
    if (!isExpanded) { this.isShowingAllTypes.set(false); }
    this.expandedAirlineId.set(isExpanded ? null : airline.id);
  }

  ngOnInit(): void {
    void this.loadRanking();
    this.pollTimer = setInterval(() => { void this.loadRanking(); }, 60_000);
  }

  private async loadRanking(): Promise<void> {
    this.now.set(Date.now());
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

  private applySnapshot(snapshot: Snapshot): void {
    if (!this.snapshot()) {
      this.snapshot.set(snapshot);
      this.rows.set(rankAirlines(snapshot.airlines));
      return;
    }
    const expandedId = this.expandedAirlineId();
    if (!snapshot.airlines.some(airline => airline.id === expandedId)) { this.expandedAirlineId.set(null); }
    const previousCounts = new Map(this.rows().map(airline => [airline.id, airline.count]));
    const positions = new Map(this.rowElements.map(({ nativeElement: row }) => [row.dataset['id'], row.getBoundingClientRect().top]));
    this.animations.forEach(animation => { animation.cancel(); });
    this.animations = [];
    this.snapshot.set(snapshot);
    this.rows.set(rankAirlines(snapshot.airlines));
    this.announcement.set('Ranking updated.');
    this.changeDetector.detectChanges();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
      if (airline && count && previousCounts.get(airline.id) !== airline.count) {
        this.animations.push(count.animate([
          { color: '#171c24', backgroundColor: '#e9edf1' },
          { color: '#171c24', backgroundColor: 'transparent' },
        ], { duration: 800, easing: 'ease-out' }));
      }
    });
  }

  ngOnDestroy(): void {
    this.abort.abort();
    clearInterval(this.pollTimer);
    this.animations.forEach(animation => { animation.cancel(); });
  }
}
