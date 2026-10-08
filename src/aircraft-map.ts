import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { AircraftPosition } from '../shared/ranking';
import { worldOutline } from './world-outline';
import { projectAircraft } from './aircraft-map-projection';

@Component({
  selector: 'app-aircraft-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="aircraft-map" aria-label="Aircraft locations">
      <h2>Aircraft locations</h2>
      @if (points().length < count()) {
        <p class="map-coverage">Locations available for {{ points().length }} of {{ count() }} aircraft</p>
      }
      @if (points().length > 0) {
        <div class="map-surface">
          <svg viewBox="0 0 800 412" role="group" aria-label="Aircraft positions on a world map">
            <path [attr.d]="worldOutline" fill="#e6ebe8" stroke="#d5ddd7" stroke-width="0.6" aria-hidden="true" />
            @for (point of points(); track point.aircraft.id) {
              <circle class="aircraft-dot" [class.is-selected]="selectedAircraft()?.id === point.aircraft.id"
                [attr.cx]="point.x" [attr.cy]="point.y" r="4" tabindex="0" role="button"
                [attr.aria-label]="point.aircraft.callsign + ', ' + point.aircraft.aircraftType"
                [attr.aria-pressed]="selectedAircraft()?.id === point.aircraft.id"
                (click)="selectedId.set(point.aircraft.id)" (keydown.enter)="selectedId.set(point.aircraft.id)"
                (keydown.space)="$event.preventDefault(); selectedId.set(point.aircraft.id)">
                <title>{{ point.aircraft.callsign }} · {{ point.aircraft.aircraftType }}</title>
              </circle>
            }
          </svg>
          @if (selectedAircraft(); as aircraft) {
            <p class="map-selection" role="status">{{ aircraft.callsign }} · {{ aircraft.aircraftType }}</p>
          }
        </div>
      }
      <p class="map-caption">Locations at last update</p>
    </section>
  `,
})
export class AircraftMapComponent {
  readonly worldOutline = worldOutline;
  readonly positions = input.required<AircraftPosition[]>();
  readonly count = input.required<number>();
  readonly selectedId = signal<string | null>(null);
  readonly points = computed(() => this.positions().flatMap(aircraft => {
    const position = projectAircraft(aircraft.latitude, aircraft.longitude);
    return position ? [{ aircraft, x: position[0], y: position[1] }] : [];
  }));
  readonly selectedAircraft = computed(() =>
    this.points().find(point => point.aircraft.id === this.selectedId())?.aircraft);
}
