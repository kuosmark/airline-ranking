export interface Airline {
  id: string;
  name: string;
  count: number;
}

export interface Snapshot {
  updatedAt: string;
  airlines: Airline[];
}

const airlines = [
  { id: 'air-canada', name: 'Air Canada' },
  { id: 'korean-air', name: 'Korean Air' },
  { id: 'british-airways', name: 'British Airways' },
  { id: 'iberia', name: 'Iberia' },
  { id: 'aer-lingus', name: 'Aer Lingus' },
  { id: 'cathay-pacific', name: 'Cathay Pacific' },
  { id: 'american-airlines', name: 'American Airlines' },
  { id: 'delta-air-lines', name: 'Delta Air Lines' },
  { id: 'air-france', name: 'Air France' },
  { id: 'klm', name: 'KLM Royal Dutch Airlines' },
];

// Illustrative counts, not observations from SkyLink.
export const samples: Snapshot[] = [
  { updatedAt: '2026-10-04T10:00:00Z', counts: [77, 21, 85, 28, 19, 24, 447, 439, 59, 62] },
  { updatedAt: '2026-10-04T10:15:00Z', counts: [89, 26, 81, 24, 19, 19, 438, 452, 67, 58] },
].map(({ updatedAt, counts }) => ({
  updatedAt,
  airlines: airlines.map((airline, index) => ({ ...airline, count: counts[index] })),
}));

export function rankAirlines(airlines: Airline[]): Airline[] {
  return [...airlines].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'));
}
