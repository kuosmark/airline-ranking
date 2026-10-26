import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AircraftSymbolComponent } from './aircraft-symbol';
import { aircraftClasses } from './aircraft-classes';

@Component({
  selector: 'app-aircraft-class-filter',
  standalone: true,
  imports: [AircraftSymbolComponent],
  templateUrl: './aircraft-class-filter.html',
  styleUrl: './aircraft-class-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AircraftClassFilterComponent {
  readonly selected = input('');
  readonly engineCounts = input.required<readonly string[]>();
  readonly selectedEngineCount = input('');
  readonly engineCountChanged = output<string>();
  readonly available = input.required<ReadonlySet<string>>();
  readonly classChanged = output<string>();
  readonly classes = aircraftClasses;
}
