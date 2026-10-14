import { isValidCoordinates, rankAirlines, type AircraftPosition, type Airline, type Snapshot } from '../shared/ranking.ts';
import { aircraftTypeName } from './aircraft-types.ts';

const OBSERVATION_MAX_AGE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) {
    throw new Error('Invalid SkyLink timestamp');
  }
  // SkyLink also returns UTC timestamps without a timezone suffix.
  const time = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(time)) { throw new Error('Invalid SkyLink timestamp'); }
  return time;
}

interface AircraftObservation {
  id: string;
  seen: number;
  callsign: string;
  isAirborne: boolean;
  aircraftType: unknown;
  registration: string;
  latitude: unknown;
  longitude: unknown;
  altitude: unknown;
}

function parseObservation(record: unknown): AircraftObservation {
  if (!isRecord(record) || typeof record['icao24'] !== 'string' || !/^[\da-f]{6}$/i.test(record['icao24'])) {
    throw new Error('Invalid SkyLink aircraft identifier');
  }
  return {
    id: record['icao24'].toLowerCase(),
    seen: timestamp(record['last_seen']),
    callsign: typeof record['callsign'] === 'string' ? record['callsign'].trim().toUpperCase() : '',
    isAirborne: record['is_on_ground'] === false,
    registration: typeof record['registration'] === 'string'
      ? record['registration'].replace(/[-\s]/g, '').toUpperCase()
      : '',
    aircraftType: record['aircraft_type'],
    latitude: record['latitude'],
    longitude: record['longitude'],
    altitude: record['altitude'],
  };
}

function deduplicateObservations(records: unknown[]): AircraftObservation[] {
  const observations = new Map<string, AircraftObservation>();
  for (const record of records) {
    const observation = parseObservation(record);
    const previous = observations.get(observation.id);
    if (!previous || observation.seen > previous.seen ||
        (observation.seen === previous.seen && !observation.isAirborne)) {
      observations.set(observation.id, observation);
    }
  }
  return [...observations.values()];
}

function isQualifyingObservation(observation: AircraftObservation, snapshotTime: number): boolean {
  if (!observation.isAirborne || observation.seen > snapshotTime ||
      snapshotTime - observation.seen > OBSERVATION_MAX_AGE_MS) { return false; }
  return /^[A-Z]{3}[A-Z\d]{1,4}$/.test(observation.callsign) && observation.callsign !== observation.registration;
}

function aircraftPosition(observation: AircraftObservation, name: string): AircraftPosition | null {
  const { id, callsign, latitude, longitude, altitude } = observation;
  if (!isValidCoordinates(latitude, longitude)) { return null; }
  const position: AircraftPosition = {
    id, callsign, aircraftType: name, latitude: latitude as number, longitude: longitude as number,
  };
  if (typeof altitude === 'number' && Number.isFinite(altitude)) { position.altitudeFt = altitude; }
  return position;
}

function groupOperators(observations: AircraftObservation[], snapshotTime: number): Airline[] {
  const counts = new Map<string, Map<string, number>>();
  const positions = new Map<string, AircraftPosition[]>();
  for (const observation of observations) {
    if (!isQualifyingObservation(observation, snapshotTime)) { continue; }
    const prefix = observation.callsign.slice(0, 3);
    const types = counts.get(prefix) ?? new Map<string, number>();
    const name = aircraftTypeName(observation.aircraftType);
    const currentCount = types.get(name) ?? 0;
    types.set(name, currentCount + 1);
    counts.set(prefix, types);
    const position = aircraftPosition(observation, name);
    if (position) {
      const operatorPositions = positions.get(prefix) ?? [];
      operatorPositions.push(position);
      positions.set(prefix, operatorPositions);
    }
  }
  return rankAirlines(Array.from(counts, ([prefix, types]) => {
    const aircraftTypes = Array.from(types, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
    return {
      id: prefix,
      name: prefix,
      count: aircraftTypes.reduce((total, type) => total + type.count, 0),
      aircraftTypes,
      positions: (positions.get(prefix) ?? []).sort((a, b) => a.id.localeCompare(b.id, 'en')),
    };
  }));
}

export function countAircraft(payload: unknown, now = Date.now()): Snapshot {
  if (!isRecord(payload) || !Array.isArray(payload['aircraft']) ||
      payload['aircraft'].length === 0 || payload['total_count'] !== payload['aircraft'].length) {
    throw new Error('Invalid or incomplete SkyLink snapshot');
  }
  const snapshotTime = timestamp(payload['timestamp']);
  if (now - snapshotTime > OBSERVATION_MAX_AGE_MS || snapshotTime - now > 60_000) {
    throw new Error('SkyLink snapshot is not current');
  }
  const observations = deduplicateObservations(payload['aircraft'] as unknown[]);
  return {
    updatedAt: new Date(snapshotTime).toISOString(),
    airlines: groupOperators(observations, snapshotTime),
    isStale: false,
  };
}

export async function fetchSnapshot(apiKey: string): Promise<Snapshot> {
  const response = await fetch('https://data.skylinkapi.com/v3.1/adsb/aircraft', {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) { throw new Error(`SkyLink request failed (${response.status})`); }
  const payload: unknown = await response.json();
  return countAircraft(payload);
}
