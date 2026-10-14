import type { OnDestroy, OnInit } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { Snapshot } from '../shared/ranking';
import { isSnapshotStale } from '../shared/ranking';
import { formatSnapshotAge } from './snapshot-age';
import { RankingBoardComponent } from './ranking-board';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, RankingBoardComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly abort = new AbortController();
  private pollTimer?: ReturnType<typeof setInterval>;

  readonly snapshot = signal<Snapshot | null>(null);
  private readonly now = signal(Date.now());
  readonly snapshotAge = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? formatSnapshotAge(snapshot.updatedAt, this.now()) : '';
  });
  readonly isRankingStale = computed(() => {
    const snapshot = this.snapshot();
    return snapshot ? isSnapshotStale(snapshot, this.now()) : false;
  });
  readonly error = signal<string | null>(null);

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
      this.snapshot.set(snapshot);
    } catch {
      if (!this.abort.signal.aborted) {
        this.error.set('The ranking is temporarily unavailable. Retrying automatically.');
      }
    }
  }

  ngOnDestroy(): void {
    this.abort.abort();
    clearInterval(this.pollTimer);
  }
}
