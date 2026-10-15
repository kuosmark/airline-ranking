import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Airline } from '../shared/ranking';
import { AircraftGroupDetailsComponent } from './aircraft-group-details';
import { countryFlag } from './country-flag';

@Component({
  selector: 'app-operator-details',
  standalone: true,
  imports: [AircraftGroupDetailsComponent],
  templateUrl: './operator-details.html',
  styleUrl: './operator-details.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorDetailsComponent {
  readonly operator = input.required<Airline>();
  readonly isShowingAllTypes = input.required<boolean>();
  readonly typesToggled = output();
  readonly countryFlag = countryFlag;
}
