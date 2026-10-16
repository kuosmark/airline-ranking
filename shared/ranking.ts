export interface AircraftPosition {
  id: string;
  callsign: string;
  aircraftType: string;
  latitude: number;
  longitude: number;
  altitudeFt?: number;
}

export function isValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export interface AircraftGroup {
  count: number;
  positions?: AircraftPosition[];
  aircraftTypes: { name: string; count: number }[];
}

export interface Airline extends AircraftGroup {
  id: string;
  name: string;
  country?: string | null;
  countryIso?: string | null;
  iata?: string | null;
  icao?: string | null;
  // Positive values move up; zero is unchanged. Omitted before the first comparison.
  rankChange?: number | 'new';
}

export interface AircraftTypeGroup {
  count: number;
  positions?: AircraftPosition[];
  operators: { id: string | null; count: number }[];
}

export interface AircraftTypeRanking extends AircraftTypeGroup {
  id: string;
  name: string;
  rankChange?: number | 'new';
}

export type RankingRow = Airline | AircraftTypeRanking;
export type RankingView = 'operators' | 'types';

export interface Snapshot {
  updatedAt: string;
  airlines: Airline[];
  // Absent together in snapshots created before complete airborne coverage.
  airborneCount?: number;
  unassignedAircraft?: AircraftGroup;
  // Absent together until the first snapshot with aircraft-type rankings.
  aircraftTypeRankings?: AircraftTypeRanking[];
  unknownAircraftType?: AircraftTypeGroup;
  isStale: boolean;
}

export function rankAirlines<T extends { id: string; count: number }>(airlines: T[]): T[] {
  return [...airlines].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, 'en'));
}

export function compareRanks(next: Snapshot, previous: Snapshot | null): Snapshot {
  if (!previous) { return next; }
  const airlines = rankChanges(next.airlines, previous.airlines);
  if (!next.aircraftTypeRankings || !previous.aircraftTypeRankings) { return { ...next, airlines }; }
  const aircraftTypeRankings = rankChanges(next.aircraftTypeRankings, previous.aircraftTypeRankings);
  return { ...next, airlines, aircraftTypeRankings };
}

function rankChanges<T extends RankingRow>(next: T[], previous: T[]): T[] {
  const previousRanks = new Map(rankAirlines(previous).map((row, index) => [row.id, index]));
  return rankAirlines(next).map((row, index) => {
    const previousRank = previousRanks.get(row.id);
    const rankChange = previousRank === undefined ? 'new' as const : previousRank - index;
    return { ...row, rankChange };
  });
}

export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export function isSnapshotStale(snapshot: Snapshot, now: number): boolean {
  return snapshot.isStale || now - Date.parse(snapshot.updatedAt) > REFRESH_INTERVAL_MS + 30_000;
}
