import { geoNaturalEarth1 } from 'd3-geo';
import { isValidCoordinates } from '../shared/ranking.ts';

// Matches the bundled Natural Earth outline's 800 × 412 viewBox.
const projection = geoNaturalEarth1().scale(138.5155850555576).translate([400, 202.97674678274046]);

export function projectAircraft(latitude: number, longitude: number): [number, number] | null {
  if (!isValidCoordinates(latitude, longitude)) { return null; }
  return projection([longitude, latitude]);
}
