import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
  readonly aircraft = input.required<AircraftGroup>();
  readonly groupId = input.required<string>();
  readonly groupName = input.required<string>();
  readonly isShowingAllTypes = input.required<boolean>();
  readonly typesToggled = output();
  readonly collapsedTypeLimit = 5;
}
