import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { AircraftGroup } from '../shared/ranking';
import { AircraftMapComponent } from './aircraft-map';

@Component({
  selector: 'app-aircraft-group-details',
  standalone: true,
  imports: [DecimalPipe, AircraftMapComponent],
  templateUrl: './aircraft-group-details.html',
  styleUrl: './aircraft-group-details.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AircraftGroupDetailsComponent {
  readonly aircraft = input.required<Pick<AircraftGroup, 'count' | 'positions'>>();
  readonly breakdown = input.required<{ name: string; count: number }[]>();
  readonly breakdownLabel = input('types');
  readonly heading = computed(() => this.breakdownLabel() === 'operators' ? 'Airborne aircraft by operator' : 'Airborne aircraft by type');
  readonly groupId = input.required<string>();
  readonly groupName = input.required<string>();
  readonly isShowingAllTypes = input.required<boolean>();
  readonly typesToggled = output();
  readonly collapsedTypeLimit = 5;
}
