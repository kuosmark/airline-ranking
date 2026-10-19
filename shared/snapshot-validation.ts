import { isValidCoordinates, type AircraftGroup, type AircraftTypeGroup, type Snapshot } from './ranking.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAircraftPosition(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const altitude = value['altitudeFt'];
  return typeof value['id'] === 'string' && /^[a-f\d]{6}$/.test(value['id']) &&
    typeof value['callsign'] === 'string' && typeof value['aircraftType'] === 'string' &&
    isValidCoordinates(value['latitude'], value['longitude']) &&
    (altitude === undefined || (typeof altitude === 'number' && Number.isFinite(altitude)));
}

function isAircraftType(value: unknown): value is { name: string; count: number } {
  if (!isRecord(value)) { return false; }
  const count = value['count'];
  return typeof value['name'] === 'string' && typeof count === 'number' &&
    Number.isInteger(count) && count >= 0;
}

function isAircraftGroup(value: unknown): value is AircraftGroup {
  if (!isRecord(value)) { return false; }
  const count = value['count'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) { return false; }
  const positions = value['positions'];
  if (positions !== undefined && (!Array.isArray(positions) || positions.length > count ||
      !positions.every(isAircraftPosition))) { return false; }
  const aircraftTypes = value['aircraftTypes'];
  return Array.isArray(aircraftTypes) && aircraftTypes.every(isAircraftType);
}

function isAirline(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const id = value['id'];
  if (typeof id !== 'string' || !/^[A-Z]{3}$/.test(id) || typeof value['name'] !== 'string' || !isAircraftGroup(value)) { return false; }

  const country = value['country'];
  const countryIso = value['countryIso'];
  const iata = value['iata'];
  const icao = value['icao'];
  if (country !== undefined && country !== null && typeof country !== 'string') { return false; }
  if (countryIso !== undefined && countryIso !== null &&
      (typeof countryIso !== 'string' || !/^[A-Z]{2}$/.test(countryIso))) { return false; }
  if (iata !== undefined && iata !== null && (typeof iata !== 'string' || !/^[A-Z\d]{2}$/.test(iata))) { return false; }
  if (icao !== undefined && icao !== null && icao !== id) { return false; }

  return isRankChange(value['rankChange']);
}

function isRankChange(value: unknown): boolean {
  return value === undefined || value === 'new' || (typeof value === 'number' && Number.isInteger(value));
}

function isAircraftTypeGroup(value: unknown): value is AircraftTypeGroup {
  if (!isRecord(value)) { return false; }
  const count = value['count'];
  const positions = value['positions'];
  const operators = value['operators'];
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || !Array.isArray(operators)) { return false; }
  if (positions !== undefined && (!Array.isArray(positions) || positions.length > count || !positions.every(isAircraftPosition))) { return false; }
  if (!operators.every((operator: unknown) => isRecord(operator) &&
    (operator['id'] === null || (typeof operator['id'] === 'string' && /^[A-Z]{3}$/.test(operator['id']))) &&
    typeof operator['count'] === 'number' && Number.isInteger(operator['count']) && operator['count'] > 0)) { return false; }
  const entries = operators as AircraftTypeGroup['operators'];
  return new Set(entries.map(operator => operator.id)).size === entries.length &&
    entries.reduce((total, operator) => total + operator.count, 0) === count;
}

function hasValidTypeRanking(value: Record<string, unknown>): boolean {
  const types = value['aircraftTypeRankings'];
  const unknown = value['unknownAircraftType'];
  if (types === undefined && unknown === undefined) { return true; }
  if (!Array.isArray(types) || !isAircraftTypeGroup(unknown)) { return false; }
  const descriptions = (unknown as AircraftTypeGroup & { descriptions?: unknown }).descriptions;
  if (descriptions !== undefined && (!Array.isArray(descriptions) || !descriptions.every(isAircraftType) ||
      descriptions.reduce((total, entry) => total + entry.count, 0) !== unknown.count)) { return false; }
  if (!types.every((type: unknown) => isRecord(type) && typeof type['id'] === 'string' &&
    /^[A-Z0-9]{2,4}$/.test(type['id']) && typeof type['name'] === 'string' &&
    isRankChange(type['rankChange']) && isAircraftTypeGroup(type))) { return false; }
  const rows = types as (AircraftTypeGroup & { id: string })[];
  return new Set(rows.map(type => type.id)).size === rows.length &&
    rows.reduce((total, type) => total + type.count, unknown.count) === value['airborneCount'];
}

function hasConsistentTypeCounts(group: AircraftGroup): boolean {
  return group.aircraftTypes.reduce((total, type) => total + type.count, 0) === group.count;
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || typeof value['updatedAt'] !== 'string' || !Number.isFinite(Date.parse(value['updatedAt'])) ||
      typeof value['isStale'] !== 'boolean' || !Array.isArray(value['airlines']) || !value['airlines'].every(isAirline)) {
    return false;
  }
  if (!hasValidTypeRanking(value)) { return false; }
  const airborneCount = value['airborneCount'];
  const unassigned = value['unassignedAircraft'];
  if (airborneCount === undefined && unassigned === undefined) { return true; }
  if (typeof airborneCount !== 'number' || !Number.isInteger(airborneCount) || airborneCount < 0 ||
      !isAircraftGroup(unassigned) || !hasConsistentTypeCounts(unassigned)) { return false; }
  const airlines = value['airlines'] as AircraftGroup[];
  return airlines.every(hasConsistentTypeCounts) &&
    airlines.reduce((total, airline) => total + airline.count, unassigned.count) === airborneCount;
}
