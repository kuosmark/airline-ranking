import type { Airline } from '../shared/ranking';

export function filterOperators(airlines: readonly Airline[], query: string): { airline: Airline; rank: number }[] {
  const search = query.trim().toLowerCase();
  const rankedOperators = airlines.map((airline, index) => ({ airline, rank: index + 1 }));

  return rankedOperators.filter(({ airline }) => {
    const fields = [airline.name, airline.id, airline.icao ?? '', airline.iata ?? '', airline.country ?? ''];
    return fields.some(field => field.toLowerCase().includes(search));
  });
}
