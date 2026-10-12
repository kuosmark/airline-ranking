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
            (pointermove)="hoveredId.set(nearestAircraftId($event))" (pointerleave)="hoveredId.set(null)"
            (click)="selectAircraft(nearestAircraftId($event))">
            @if (hoveredAircraft(); as aircraft) {
              <title>{{ aircraft.callsign }} · {{ aircraft.aircraftType }}</title>
            }
            <path [attr.d]="worldOutline" fill="#e6ebe8" stroke="#d5ddd7" stroke-width="0.6" aria-hidden="true" />
            @for (point of points(); track point.aircraft.id; let index = $index) {
              <circle class="aircraft-dot" [attr.cx]="point.x" [attr.cy]="point.y" r="4"
                [class.is-selected]="selectedAircraft()?.id === point.aircraft.id"
                [class.is-hovered]="hoveredId() === point.aircraft.id"
                [attr.tabindex]="focusedAircraftId() === point.aircraft.id ? 0 : -1" role="button"
                [attr.aria-label]="point.aircraft.callsign + ', ' + point.aircraft.aircraftType"
                aria-description="Use arrow keys to browse aircraft in callsign order, Enter or Space to select, and Tab to leave the map."
                [attr.aria-pressed]="selectedAircraft()?.id === point.aircraft.id"
                (focus)="focusedId.set(point.aircraft.id)" (keydown)="navigateAircraft($event, index)"
                (click)="$event.stopPropagation(); selectAircraft(point.aircraft.id)"
                (keydown.enter)="selectAircraft(point.aircraft.id)"
                (keydown.space)="$event.preventDefault(); selectAircraft(point.aircraft.id)" />
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
  readonly focusedId = signal<string | null>(null);
  readonly points = computed(() => {
    const points = this.positions().flatMap(aircraft => {
      const position = projectAircraft(aircraft.latitude, aircraft.longitude);
      return position ? [{ aircraft, x: position[0], y: position[1] }] : [];
    });
    return points.sort((a, b) => {
      const callsignOrder = a.aircraft.callsign.localeCompare(b.aircraft.callsign, 'en');
      return callsignOrder || a.aircraft.id.localeCompare(b.aircraft.id, 'en');
    });
  });
  readonly focusedAircraftId = computed(() => {
    const points = this.points();
    const focusedId = this.focusedId();
    return points.find(point => point.aircraft.id === focusedId)?.aircraft.id ?? points[0]?.aircraft.id;
  });
  readonly selectedAircraft = computed(() =>
    this.points().find(point => point.aircraft.id === this.selectedId())?.aircraft);
  readonly hoveredAircraft = computed(() =>
    this.points().find(point => point.aircraft.id === this.hoveredId())?.aircraft);

  selectAircraft(id: string | null): void {
    if (id === null) { return; }
    this.selectedId.set(id);
    this.focusedId.set(id);
  }

  navigateAircraft(event: KeyboardEvent, index: number): void {
    const isPrevious = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const isNext = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    if (!isPrevious && !isNext) { return; }
    event.preventDefault();
    const direction = isPrevious ? -1 : 1;
    const aircraftCount = this.points().length;
    const nextIndex = (index + direction + aircraftCount) % aircraftCount;
    const marker = event.currentTarget as SVGElement;
    marker.ownerSVGElement?.querySelectorAll<SVGElement>('.aircraft-dot')[nextIndex]?.focus();
  }

  nearestAircraftId(event: MouseEvent): string | null {
    const matrix = (event.currentTarget as SVGSVGElement).getScreenCTM();
    if (!matrix) { return null; }
    let nearestId: string | null = null;
    const hitRadiusPx = 12;
    let shortestDistance = hitRadiusPx;
    for (const point of this.points()) {
      const screenX = matrix.a * point.x + matrix.c * point.y + matrix.e;
      const screenY = matrix.b * point.x + matrix.d * point.y + matrix.f;
      const distance = Math.hypot(screenX - event.clientX, screenY - event.clientY);
      if (distance < shortestDistance) {
        nearestId = point.aircraft.id;
        shortestDistance = distance;
      }
    }
    return nearestId;
  }
}
