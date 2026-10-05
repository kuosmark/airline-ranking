// Common designators present in the saved SkyLink snapshot, checked against:
// https://www.faa.gov/air_traffic/publications/atpubs/foa_html/appendix_3.html
// Preserve variants where a designator covers more than one model.
const names = new Map<string, string>(Object.entries({
  A20N: 'Airbus A320neo',
  A21N: 'Airbus A321neo',
  A310: 'Airbus A310',
  A318: 'Airbus A318',
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A321: 'Airbus A321',
  A332: 'Airbus A330-200',
  A333: 'Airbus A330-300',
  A339: 'Airbus A330-900',
  A343: 'Airbus A340-300',
  A346: 'Airbus A340-600',
  A359: 'Airbus A350-900',
  A35K: 'Airbus A350-1000',
  A388: 'Airbus A380-800',
  AT73: 'ATR 72-211 / 212',
  AT75: 'ATR 72-500',
  AT76: 'ATR 72-600',
  B38M: 'Boeing 737 MAX 8',
  B39M: 'Boeing 737 MAX 9',
  B712: 'Boeing 717-200',
  B733: 'Boeing 737-300',
  B736: 'Boeing 737-600',
  B737: 'Boeing 737-700',
  B738: 'Boeing 737-800',
  B739: 'Boeing 737-900',
  B744: 'Boeing 747-400',
  B748: 'Boeing 747-8',
  B752: 'Boeing 757-200',
  B753: 'Boeing 757-300',
  B763: 'Boeing 767-300',
  B764: 'Boeing 767-400',
  B772: 'Boeing 777-200 / 200ER',
  B77L: 'Boeing 777-200LR / Freighter',
  B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  B78X: 'Boeing 787-10',
  BCS1: 'Airbus A220-100',
  BCS3: 'Airbus A220-300',
  CRJ9: 'Bombardier CRJ705 / CRJ900',
  DH8D: 'De Havilland Dash 8-400',
  E190: 'Embraer E190 / Lineage 1000',
  E195: 'Embraer E195',
  E290: 'Embraer E190-E2',
  E295: 'Embraer E195-E2',
  E75L: 'Embraer E175 (long wing)',
  F100: 'Fokker 100',
  // Specific models observed in the payload, verified against EASA's model list:
  // https://ad.easa.europa.eu/ad/2026-0064
  'A319-131': 'Airbus A319-131',
  'A321-271NX': 'Airbus A321-271NX',
  'A321-271NY': 'Airbus A321-271NY',
}));

const canonicalNames = new Map(Array.from(names.values(), name => [name.toUpperCase(), name]));

// Exact model labels observed in the payload and confirmed by the same FAA table.
const aliases = new Map([
  ['BOEING 737-8', 'B38M'],
  ['BOEING 737-9', 'B39M'],
  ['EMBRAER ERJ 190-400', 'E295'],
]);

export function aircraftTypeName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) { return 'Unknown type'; }
  const label = value.trim().replace(/\s+/g, ' ').toUpperCase();
  const code = aliases.get(label) ?? label.split(' ').at(-1) ?? '';
  return canonicalNames.get(label) ?? names.get(code) ?? label;
}
