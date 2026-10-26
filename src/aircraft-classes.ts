import { aircraftSymbols } from './aircraft-icons.ts';

export const aircraftClasses = [
  { id: 'jet', label: 'Jets', symbol: aircraftSymbols.twinJet },
  { id: 'turboprop', label: 'Turboprops', symbol: aircraftSymbols.twinPropeller },
  { id: 'piston', label: 'Piston aircraft', symbol: aircraftSymbols.singlePropeller },
  { id: 'helicopter', label: 'Helicopters', symbol: aircraftSymbols.helicopter },
  { id: 'gyrocopter', label: 'Gyrocopters', symbol: aircraftSymbols.gyrocopter },
  { id: 'tiltrotor', label: 'Tiltrotors', symbol: aircraftSymbols.tilt },
  { id: 'seaplane', label: 'Seaplanes', symbol: aircraftSymbols.water },
  { id: 'amphibian', label: 'Amphibians', symbol: aircraftSymbols.water },
  { id: 'electric', label: 'Electric aircraft', symbol: aircraftSymbols.electric },
] as const;

const landplaneClasses: Readonly<Record<string, string>> = {
  J: 'jet', T: 'turboprop', P: 'piston', E: 'electric',
};
const categoryClasses: Readonly<Record<string, string>> = {
  H: 'helicopter', S: 'seaplane', A: 'amphibian', G: 'gyrocopter', R: 'tiltrotor',
};
const unknownClass = { id: '', label: 'Classification unavailable', symbol: aircraftSymbols.unknown };

export function resolveAircraftClass(classification?: string) {
  const id = classification?.[0] === 'L'
    ? landplaneClasses[classification[2]] ?? 'landplane'
    : categoryClasses[classification?.[0] ?? ''];
  if (id === 'landplane') { return { id: '', label: 'Landplane', symbol: aircraftSymbols.landplane }; }
  return aircraftClasses.find(aircraftClass => aircraftClass.id === id) ?? unknownClass;
}

export function availableAircraftClasses(
  types: readonly { classification?: string; count: number }[],
  selected = '',
): Set<string> {
  const available = new Set(types.filter(type => type.count > 0).map(type => resolveAircraftClass(type.classification).id));
  available.delete('');
  if (selected) { available.add(selected); }
  return available;
}
