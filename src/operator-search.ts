import type { Airline } from '../shared/ranking';

export function filterOperators(airlines: readonly Airline[], query: string): { airline: Airline; rank: number }[] {
  const search = query.trim().toLowerCase();
  const rankedOperators = airlines.map((airline, index) => ({ airline, rank: index + 1 }));

  return rankedOperators.filter(({ airline }) => {
    const name = airline.name.toLowerCase();
    const prefix = airline.id.toLowerCase();
    return name.includes(search) || prefix.includes(search);
  });
}
