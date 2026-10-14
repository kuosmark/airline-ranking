import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ranking-toolbar',
  standalone: true,
  templateUrl: './ranking-toolbar.html',
  styleUrl: './ranking-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingToolbarComponent {
  readonly searchQuery = input.required<string>();
  readonly matchingCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly snapshotAge = input.required<string>();
  readonly searchChanged = output<string>();
}
