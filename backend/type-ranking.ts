import { rankAirlines, type AircraftPosition, type AircraftTypeGroup, type AircraftTypeRanking } from '../shared/ranking.ts';
import { resolveAircraftType } from './aircraft-types.ts';

interface TypeObservation {
  label: unknown;
  operatorId: string | null;
  position: AircraftPosition | null;
}

interface TypeGroupBuilder {
  count: number;
  operators: Map<string | null, number>;
  positions: AircraftPosition[];
}

function createGroup(): TypeGroupBuilder {
  return { count: 0, operators: new Map(), positions: [] };
}

function finishGroup(group: TypeGroupBuilder): AircraftTypeGroup {
  return {
    count: group.count,
    operators: Array.from(group.operators, ([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || (a.id ?? '').localeCompare(b.id ?? '', 'en')),
    positions: group.positions.sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
}

export function buildAircraftTypeRanking(observations: TypeObservation[]): {
  aircraftTypeRankings: AircraftTypeRanking[];
  unknownAircraftType: AircraftTypeGroup;
} {
  const groups = new Map<string, { name: string; aircraft: TypeGroupBuilder }>();
  const unknown = createGroup();
  for (const observation of observations) {
    const type = resolveAircraftType(observation.label);
    let group = unknown;
    if (type) {
      const entry = groups.get(type.id) ?? { name: type.name, aircraft: createGroup() };
      groups.set(type.id, entry);
      group = entry.aircraft;
    }
    group.count++;
    group.operators.set(observation.operatorId, (group.operators.get(observation.operatorId) ?? 0) + 1);
    if (observation.position) { group.positions.push(observation.position); }
  }
  return {
    aircraftTypeRankings: rankAirlines(Array.from(groups, ([id, group]) => ({ id, name: group.name, ...finishGroup(group.aircraft) }))),
    unknownAircraftType: finishGroup(unknown),
  };
}
