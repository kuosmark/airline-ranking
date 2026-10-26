import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-aircraft-symbol',
  standalone: true,
  templateUrl: './aircraft-symbol.html',
  styleUrl: './aircraft-symbol.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AircraftSymbolComponent {
  readonly symbol = input.required<{ body: string; detail: string }>();
}
