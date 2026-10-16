import type { RankingRow } from '../shared/ranking';

export function filterOperators(airlines: readonly RankingRow[], query: string): { airline: RankingRow; rank: number }[] {
  const search = query.trim().toLowerCase();
  const rankedOperators = airlines.map((airline, index) => ({ airline, rank: index + 1 }));
  if (search.length === 0) { return rankedOperators; }

  return rankedOperators.filter(({ airline }) => {
    const fields = [airline.name, airline.id];
    if ('aircraftTypes' in airline) {
      fields.push(airline.icao ?? '', airline.iata ?? '', airline.country ?? '');
    }
    return fields.some(field => field.toLowerCase().includes(search));
  });
}
