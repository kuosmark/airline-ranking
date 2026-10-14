import type { AfterRenderRef, ElementRef, OnChanges, OnDestroy, QueryList, SimpleChanges } from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, ViewChildren, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Airline, Snapshot } from '../shared/ranking';
import { rankAirlines } from '../shared/ranking';
import { filterOperators } from './operator-search';
import { OperatorDetailsComponent } from './operator-details';
import { RankingToolbarComponent } from './ranking-toolbar';

@Component({
  selector: 'app-ranking-board',
  standalone: true,
  imports: [DecimalPipe, OperatorDetailsComponent, RankingToolbarComponent],
  templateUrl: './ranking-board.html',
  styleUrl: './ranking-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingBoardComponent implements OnChanges, OnDestroy {
  @ViewChildren('row') private rowElements!: QueryList<ElementRef<HTMLElement>>;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);
  private pendingRender?: AfterRenderRef;
  private animations: Animation[] = [];
  private cancelDrawerScroll?: () => void;

  readonly snapshot = input<Snapshot | null>(null);
  readonly snapshotAge = input('');
  readonly isRankingStale = input(false);
  readonly error = input<string | null>(null);
  readonly rows = signal<Airline[]>([]);
  readonly searchQuery = signal('');
  readonly rowBatchSize = 100;
  readonly visibleLimit = signal(this.rowBatchSize);
  readonly matchingRows = computed(() => filterOperators(this.rows(), this.searchQuery()));
  readonly visibleRows = computed(() => this.matchingRows().slice(0, this.visibleLimit()));
  readonly nextBatchSize = computed(() => Math.min(this.rowBatchSize, this.matchingRows().length - this.visibleRows().length));
  readonly announcement = signal('');
  readonly expandedAirlineId = signal<string | null>(null);
  readonly isShowingAllTypes = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (!Object.hasOwn(changes, 'snapshot')) { return; }
    const snapshotChange = changes['snapshot'];
    const snapshot = this.snapshot();
    if (!snapshot) { return; }
    const previousSnapshot = snapshotChange.previousValue as Snapshot | null;
    if (!previousSnapshot || snapshot.updatedAt === previousSnapshot.updatedAt) {
      this.rows.set(rankAirlines(snapshot.airlines));
      return;
    }
    this.applySnapshot(snapshot);
  }

  updateSearch(query: string): void {
    this.searchQuery.set(query);
    this.visibleLimit.set(this.rowBatchSize);
  }

  toggleAirline(airline: Airline, event: MouseEvent): void {
    this.cancelDrawerScroll?.();
    const button = event.currentTarget as HTMLElement;
    const previousTop = button.getBoundingClientRect().top;
    const isExpanded = this.expandedAirlineId() === airline.id;
    if (!isExpanded) { this.isShowingAllTypes.set(false); }
    this.expandedAirlineId.set(isExpanded ? null : airline.id);
    this.changeDetector.detectChanges();
    this.preserveDrawerRowPosition(button, previousTop);
  }

  private preserveDrawerRowPosition(button: HTMLElement, previousTop: number): void {
    const scrollEvents = new AbortController();
    let frame: number;
    const stop = (): void => {
      cancelAnimationFrame(frame);
      scrollEvents.abort();
      this.cancelDrawerScroll = undefined;
    };
    this.cancelDrawerScroll = stop;
    for (const eventName of ['wheel', 'touchmove', 'keydown', 'pointerdown']) {
      window.addEventListener(eventName, stop, { passive: true, signal: scrollEvents.signal });
    }

    frame = requestAnimationFrame(() => {
      // Angular applies the drawer animation classes after rendering.
      const drawerAnimations = this.getDrawerAnimations();
      let isAnimating = drawerAnimations.length > 0;
      void Promise.allSettled(drawerAnimations.map(animation => animation.finished)).then(() => {
        isAnimating = false;
      });

      const preservePosition = (): void => {
        const distance = button.getBoundingClientRect().top - previousTop;
        if (distance !== 0) { window.scrollBy({ top: distance, behavior: 'instant' }); }
        if (isAnimating) {
          frame = requestAnimationFrame(preservePosition);
        } else {
          stop();
        }
      };
      preservePosition();
    });
  }

  private getDrawerAnimations(): Animation[] {
    return this.rowElements.toArray().flatMap(({ nativeElement: row }) =>
      Array.from(row.querySelectorAll('.aircraft-details')).flatMap(drawer => drawer.getAnimations()));
  }

  private applySnapshot(snapshot: Snapshot): void {
    const expandedId = this.expandedAirlineId();
    if (!snapshot.airlines.some(airline => airline.id === expandedId)) {
      this.expandedAirlineId.set(null);
    }
    const previousCounts = new Map(this.rows().map(airline => [airline.id, airline.count]));
    const previousPositions = new Map(this.rowElements.map(({ nativeElement: row }) =>
      [row.dataset['id'], row.getBoundingClientRect().top]));
    this.pendingRender?.destroy();
    this.cancelAnimations();
    this.rows.set(rankAirlines(snapshot.airlines));
    const updatedAt = new Date(snapshot.updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' });
    this.announcement.set(`Ranking updated at ${updatedAt} UTC.`);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    this.pendingRender = afterNextRender(() => {
      this.pendingRender = undefined;
      this.animateRows(snapshot, previousCounts, previousPositions);
    }, { injector: this.injector });
  }

  private animateRows(snapshot: Snapshot, previousCounts: Map<string, number>, previousPositions: Map<string | undefined, number>): void {
    const currentCounts = new Map(snapshot.airlines.map(airline => [airline.id, airline.count]));
    this.rowElements.forEach(({ nativeElement: row }) => {
      const id = row.dataset['id'];
      const currentTop = row.getBoundingClientRect().top;
      const previousTop = previousPositions.get(id) ?? currentTop;
      const distance = previousTop - currentTop;
      if (distance !== 0) {
        this.animations.push(row.animate([
          { transform: `translateY(${distance}px)` },
          { transform: 'translateY(0)' },
        ], { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }));
      }
      const currentCount = id === undefined ? undefined : currentCounts.get(id);
      const count = row.querySelector('.count');
      if (id !== undefined && currentCount !== undefined && count && previousCounts.get(id) !== currentCount) {
        this.animations.push(count.animate([
          { color: '#171c24', backgroundColor: '#e9edf1' },
          { color: '#171c24', backgroundColor: 'transparent' },
        ], { duration: 800, easing: 'ease-out' }));
      }
    });
  }

  private cancelAnimations(): void {
    this.animations.forEach(animation => { animation.cancel(); });
    this.animations = [];
  }

  ngOnDestroy(): void {
    this.cancelDrawerScroll?.();
    this.pendingRender?.destroy();
    this.cancelAnimations();
  }
}
