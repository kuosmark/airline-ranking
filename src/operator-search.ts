import { resolveAircraftClass } from './aircraft-classes.ts';
import type { RankingRow } from '../shared/ranking';

export function filterOperators(airlines: readonly RankingRow[], query: string, classId = '', engineCount = ''): { airline: RankingRow; rank: number }[] {
  const search = query.trim().toLowerCase();
  const rankedOperators = airlines.map((airline, index) => ({ airline, rank: index + 1 }));
  if (search.length === 0 && !classId && !engineCount) { return rankedOperators; }

  return rankedOperators.filter(({ airline }) => {
    if (classId && (!('operators' in airline) || resolveAircraftClass(airline.classification).id !== classId)) { return false; }
    if (engineCount) {
      const count = 'operators' in airline ? airline.classification?.[1] : undefined;
      const isMatchingCount = engineCount === '5+' ? /^[5-9]$/.test(count ?? '') : count === engineCount;
      if (!isMatchingCount) { return false; }
    }
    const fields = [airline.name, airline.id];
    if ('aircraftTypes' in airline) {
      fields.push(airline.icao ?? '', airline.iata ?? '', airline.country ?? '');
    }
    return fields.some(field => field.toLowerCase().includes(search));
  });
}
