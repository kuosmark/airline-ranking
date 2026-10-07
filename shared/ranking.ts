export interface Airline {
  id: string;
  name: string;
  country?: string | null;
  iata?: string | null;
  icao?: string | null;
  count: number;
  // Positive values move up; zero is unchanged. Omitted before the first comparison.
  rankChange?: number | 'new';
  aircraftTypes: { name: string; count: number }[];
}

export interface Snapshot {
  updatedAt: string;
  airlines: Airline[];
  isStale: boolean;
}

export function rankAirlines(airlines: Airline[]): Airline[] {
  return [...airlines].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id, 'en'));
}

export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export function isSnapshotStale(snapshot: Snapshot, now: number): boolean {
  return snapshot.isStale || now - Date.parse(snapshot.updatedAt) > REFRESH_INTERVAL_MS + 30_000;
}
