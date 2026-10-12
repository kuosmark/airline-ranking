import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { AircraftPosition } from '../shared/ranking';
import { worldOutline } from './world-outline';
import { projectAircraft } from './aircraft-map-projection';

@Component({
  selector: 'app-aircraft-map',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="aircraft-map" aria-label="Aircraft locations">
      <h2>Aircraft locations</h2>
      @if (points().length < count()) {
        <p class="map-coverage">Locations available for {{ points().length }} of {{ count() }} aircraft</p>
      }
      @if (points().length > 0) {
        <div class="map-surface">
          <!-- Keyboard activation is handled by each labeled aircraft button below. -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
          <svg viewBox="0 0 800 412" role="group" aria-label="Aircraft positions on a world map"
            [class.is-pointer-near-aircraft]="hoveredId() !== null"
            (pointermove)="hoveredId.set(nearestAircraft($event))" (pointerleave)="hoveredId.set(null)"
            (click)="selectedId.set(nearestAircraft($event) ?? selectedId())">
            @if (hoveredAircraft(); as aircraft) {
              <title>{{ aircraft.callsign }} · {{ aircraft.aircraftType }}</title>
            }
            <path [attr.d]="worldOutline" fill="#e6ebe8" stroke="#d5ddd7" stroke-width="0.6" aria-hidden="true" />
            @for (point of points(); track point.aircraft.id) {
              <g class="aircraft-dot" [class.is-selected]="selectedAircraft()?.id === point.aircraft.id"
                [class.is-hovered]="hoveredId() === point.aircraft.id"
                tabindex="0" role="button"
                [attr.aria-label]="point.aircraft.callsign + ', ' + point.aircraft.aircraftType"
                [attr.aria-pressed]="selectedAircraft()?.id === point.aircraft.id"
                (click)="$event.stopPropagation(); selectedId.set(point.aircraft.id)" (keydown.enter)="selectedId.set(point.aircraft.id)"
                (keydown.space)="$event.preventDefault(); selectedId.set(point.aircraft.id)">
                <circle class="aircraft-marker" [attr.cx]="point.x" [attr.cy]="point.y" r="4" />
              </g>
            }
          </svg>
          <p class="map-selection" role="status" [class.is-empty]="!selectedAircraft()">
            @if (selectedAircraft(); as aircraft) {
              {{ aircraft.callsign }} · {{ aircraft.aircraftType }}
              @if (aircraft.altitudeFt !== undefined) {
                <span class="map-altitude"> · {{ aircraft.altitudeFt | number: '1.0-0' }} ft</span>
              }
            } @else {
              Select an aircraft for details
            }
          </p>
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
  readonly hoveredId = signal<string | null>(null);
  readonly points = computed(() => this.positions().flatMap(aircraft => {
    const position = projectAircraft(aircraft.latitude, aircraft.longitude);
    return position ? [{ aircraft, x: position[0], y: position[1] }] : [];
  }));
  readonly selectedAircraft = computed(() =>
    this.points().find(point => point.aircraft.id === this.selectedId())?.aircraft);
  readonly hoveredAircraft = computed(() =>
    this.points().find(point => point.aircraft.id === this.hoveredId())?.aircraft);

  nearestAircraft(event: MouseEvent): string | null {
    const matrix = (event.currentTarget as SVGSVGElement).getScreenCTM();
    if (!matrix) { return null; }
    let nearestId: string | null = null;
    let shortestDistance = 12;
    for (const point of this.points()) {
      const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
      const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
      const distance = Math.hypot(x - event.clientX, y - event.clientY);
      if (distance < shortestDistance) {
        nearestId = point.aircraft.id;
        shortestDistance = distance;
      }
    }
    return nearestId;
  }
}
