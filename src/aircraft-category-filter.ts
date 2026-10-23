import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { aircraftIcons } from './aircraft-icons';

@Component({
  selector: 'app-aircraft-category-filter',
  standalone: true,
  templateUrl: './aircraft-category-filter.html',
  styleUrl: './aircraft-category-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AircraftCategoryFilterComponent {
  readonly selected = input('');
  readonly available = input.required<ReadonlySet<string>>();
  readonly categoryChanged = output<string>();
  readonly categories = computed(() => aircraftIcons.filter(icon => this.available().has(icon.category)));
}
