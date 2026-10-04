export interface Airline {
  id: string;
  name: string;
  count: number;
}

export interface Snapshot {
  updatedAt: string;
  airlines: Airline[];
  stale: boolean;
}

export function rankAirlines(airlines: Airline[]): Airline[] {
  return [...airlines].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
}
