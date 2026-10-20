import { isValidCoordinates, rankAirlines, type AircraftPosition, type AircraftGroup, type Snapshot } from '../shared/ranking.ts';
import { buildAircraftTypeRanking } from './type-ranking.ts';
import { aircraftReferenceType } from './aircraft-reference.ts';
import { aircraftTypeName, resolveAircraftType } from './aircraft-types.ts';

const OBSERVATION_MAX_AGE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

type SkyLinkErrorCategory = 'invalid timestamp' | 'invalid aircraft identifier' | 'incomplete snapshot' |
  'stale snapshot' | 'invalid JSON' | 'HTTP error';

export class SkyLinkError extends Error {
  readonly category: SkyLinkErrorCategory;
  readonly status?: number;

  constructor(category: SkyLinkErrorCategory, message: string, status?: number) {
    super(message);
    this.category = category;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) {
    throw new SkyLinkError('invalid timestamp', 'Invalid SkyLink timestamp');
  }
  // SkyLink also returns UTC timestamps without a timezone suffix.
  const time = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(time)) { throw new SkyLinkError('invalid timestamp', 'Invalid SkyLink timestamp'); }
  return time;
}

interface AircraftObservation {
  id: string;
  seen: number;
  callsign: string;
  isAirborne: boolean;
  aircraftType: unknown;
  resolvedType: { id: string; name: string } | null;
  registration: string;
  latitude: unknown;
  longitude: unknown;
  altitude: unknown;
}

function parseObservation(record: unknown): AircraftObservation {
  if (!isRecord(record) || typeof record['icao24'] !== 'string' || !/^[\da-f]{6}$/i.test(record['icao24'])) {
    throw new SkyLinkError('invalid aircraft identifier', 'Invalid SkyLink aircraft identifier');
  }
  const id = record['icao24'].toLowerCase();
  const registration = typeof record['registration'] === 'string'
    ? record['registration'].replace(/[-\s]/g, '').toUpperCase() : '';
  const resolvedType = resolveAircraftType(record['aircraft_type']) ?? aircraftReferenceType(id, registration);
  return {
    id,
    resolvedType,
    seen: timestamp(record['last_seen']),
    callsign: typeof record['callsign'] === 'string' ? record['callsign'].trim().toUpperCase() : '',
    isAirborne: record['is_on_ground'] === false,
    registration,
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
  return observation.isAirborne && observation.seen <= snapshotTime &&
    snapshotTime - observation.seen <= OBSERVATION_MAX_AGE_MS;
}

function operatorPrefix(observation: AircraftObservation): string | null {
  const { callsign, registration } = observation;
  if (!/^[A-Z]{3}[A-Z\d]{1,4}$/.test(callsign) || callsign === registration) { return null; }
  return callsign.slice(0, 3);
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

interface AircraftGroupBuilder {
  types: Map<string, number>;
  positions: AircraftPosition[];
}

function createGroup(): AircraftGroupBuilder {
  return { types: new Map(), positions: [] };
}

function addAircraft(group: AircraftGroupBuilder, observation: AircraftObservation): void {
  const name = observation.resolvedType?.name ?? aircraftTypeName(observation.aircraftType);
  group.types.set(name, (group.types.get(name) ?? 0) + 1);
  const position = aircraftPosition(observation, name);
  if (position) { group.positions.push(position); }
}

function finishGroup(group: AircraftGroupBuilder): AircraftGroup {
  const aircraftTypes = Array.from(group.types, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
  return {
    count: aircraftTypes.reduce((total, type) => total + type.count, 0),
    aircraftTypes,
    positions: group.positions.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
}

function groupAircraft(observations: AircraftObservation[], snapshotTime: number) {
  const operators = new Map<string, AircraftGroupBuilder>();
  const unassigned = createGroup();
  const typeObservations: Parameters<typeof buildAircraftTypeRanking>[0] = [];
  let airborneCount = 0;
  for (const observation of observations) {
    if (!isQualifyingObservation(observation, snapshotTime)) { continue; }
    airborneCount += 1;
    const prefix = operatorPrefix(observation);
    typeObservations.push({
      label: observation.aircraftType,
      type: observation.resolvedType,
      operatorId: prefix,
      position: aircraftPosition(observation, observation.resolvedType?.name ?? aircraftTypeName(observation.aircraftType)),
    });
    if (prefix === null) {
      addAircraft(unassigned, observation);
      continue;
    }
    const group = operators.get(prefix) ?? createGroup();
    addAircraft(group, observation);
    operators.set(prefix, group);
  }
  const airlines = rankAirlines(Array.from(operators, ([id, group]) => ({ id, name: id, ...finishGroup(group) })));
  return { airlines, airborneCount, unassignedAircraft: finishGroup(unassigned), ...buildAircraftTypeRanking(typeObservations) };
}

export function countAircraft(payload: unknown, now = Date.now()): Snapshot {
  if (!isRecord(payload) || !Array.isArray(payload['aircraft']) ||
      payload['aircraft'].length === 0 || payload['total_count'] !== payload['aircraft'].length) {
    throw new SkyLinkError('incomplete snapshot', 'Invalid or incomplete SkyLink snapshot');
  }
  const snapshotTime = timestamp(payload['timestamp']);
  if (now - snapshotTime > OBSERVATION_MAX_AGE_MS || snapshotTime - now > 60_000) {
    throw new SkyLinkError('stale snapshot', 'SkyLink snapshot is not current');
  }
  const observations = deduplicateObservations(payload['aircraft'] as unknown[]);
  return {
    updatedAt: new Date(snapshotTime).toISOString(),
    ...groupAircraft(observations, snapshotTime),
    isStale: false,
  };
}

export async function fetchSnapshot(apiKey: string): Promise<Snapshot> {
  const response = await fetch('https://data.skylinkapi.com/v3.1/adsb/aircraft', {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) { throw new SkyLinkError('HTTP error', `SkyLink request failed (${response.status})`, response.status); }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) { throw error; }
    // Do not retain the parser error: it can contain provider response data.
    throw new SkyLinkError('invalid JSON', 'Invalid SkyLink JSON');
  }
  return countAircraft(payload);
}
