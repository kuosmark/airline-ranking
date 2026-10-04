export interface Airline {
  id: string;
  name: string;
  count: number;
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
