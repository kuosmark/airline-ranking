import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ranking-toolbar',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './ranking-toolbar.html',
  styleUrl: './ranking-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingToolbarComponent {
  readonly isTypeView = input(false);
  readonly isCategoryFiltered = input(false);
  readonly searchQuery = input.required<string>();
  readonly matchingCount = input.required<number>();
  readonly airborneCount = input<number>();
  readonly totalCount = input.required<number>();
  readonly snapshotAge = input.required<string>();
  readonly searchChanged = output<string>();
}
