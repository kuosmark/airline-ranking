import { isValidCoordinates, type AircraftGroup, type Snapshot } from './ranking.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAircraftPosition(value: unknown): boolean {
  if (!isRecord(value)) { return false; }
  const altitude = value['altitudeFt'];
  return typeof value['id'] === 'string' && /^[a-f\d]{6}$/.test(value['id']) &&
    typeof value['callsign'] === 'string' && typeof value['aircraftType'] === 'string' &&
    isValidCoordinates(value['latitude'], value['longitude']) &&
    (altitude === undefined || (typeof altitude === 'number' && Number.isFinite(altitude)));
}

function isAircraftType(value: unknown): boolean {
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

  const movement = value['rankChange'];
  if (movement !== undefined && movement !== 'new' &&
      (typeof movement !== 'number' || !Number.isInteger(movement))) { return false; }
  return true;
}

function hasConsistentTypeCounts(group: AircraftGroup): boolean {
  return group.aircraftTypes.reduce((total, type) => total + type.count, 0) === group.count;
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value) || typeof value['updatedAt'] !== 'string' || !Number.isFinite(Date.parse(value['updatedAt'])) ||
      typeof value['isStale'] !== 'boolean' || !Array.isArray(value['airlines']) || !value['airlines'].every(isAirline)) {
    return false;
  }
  const airborneCount = value['airborneCount'];
  const unassigned = value['unassignedAircraft'];
  if (airborneCount === undefined && unassigned === undefined) { return true; }
  if (typeof airborneCount !== 'number' || !Number.isInteger(airborneCount) || airborneCount < 0 ||
      !isAircraftGroup(unassigned) || !hasConsistentTypeCounts(unassigned)) { return false; }
  const airlines = value['airlines'] as AircraftGroup[];
  return airlines.every(hasConsistentTypeCounts) &&
    airlines.reduce((total, airline) => total + airline.count, unassigned.count) === airborneCount;
}
