import { rankAirlines, type AircraftPosition, type AircraftTypeGroup, type AircraftTypeRanking, type UnknownAircraftType } from '../shared/ranking.ts';

interface TypeObservation {
  label: unknown;
  type: { id: string; name: string } | null;
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
  unknownAircraftType: UnknownAircraftType;
} {
  const groups = new Map<string, { name: string; aircraft: TypeGroupBuilder }>();
  const unknown = createGroup();
  const descriptions = new Map<string, number>();
  for (const observation of observations) {
    const type = observation.type;
    let group = unknown;
    if (type) {
      const entry = groups.get(type.id) ?? { name: type.name, aircraft: createGroup() };
      groups.set(type.id, entry);
      group = entry.aircraft;
    }
    if (!type) {
      const description = typeof observation.label === 'string' && observation.label.trim() ? observation.label.trim() : 'Description unavailable';
      descriptions.set(description, (descriptions.get(description) ?? 0) + 1);
    }
    group.count++;
    group.operators.set(observation.operatorId, (group.operators.get(observation.operatorId) ?? 0) + 1);
    if (observation.position) { group.positions.push(observation.position); }
  }
  return {
    aircraftTypeRankings: rankAirlines(Array.from(groups, ([id, group]) => ({ id, name: group.name, ...finishGroup(group.aircraft) }))),
    unknownAircraftType: {
      ...finishGroup(unknown),
      descriptions: Array.from(descriptions, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en')),
    },
  };
}
