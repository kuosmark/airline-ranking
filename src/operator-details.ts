import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Airline } from '../shared/ranking';
import { AircraftMapComponent } from './aircraft-map';
import { countryFlag } from './country-flag';

@Component({
  selector: 'app-operator-details',
  standalone: true,
  imports: [DecimalPipe, AircraftMapComponent],
  templateUrl: './operator-details.html',
  styleUrl: './operator-details.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorDetailsComponent {
  readonly operator = input.required<Airline>();
  readonly isShowingAllTypes = input.required<boolean>();
  readonly typesToggled = output();
  readonly collapsedTypeLimit = 5;
  readonly countryFlag = countryFlag;
}
