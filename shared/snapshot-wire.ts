import type { AircraftPosition, Snapshot } from './ranking.ts';
import { isAircraftPosition, isSnapshot } from './snapshot-validation.ts';

type PositionGroup = { positions?: AircraftPosition[] };

// Keep the domain model unchanged; only the public transport shares positions.
export function compactSnapshot(snapshot: Snapshot) {
  const positions: AircraftPosition[] = [];
  const indexes = new Map<string, number>();
  function compactGroup<T extends PositionGroup>(group: T) {
    const { positions: groupPositions, ...details } = group;
    if (groupPositions === undefined) { return details; }
    const positionIndexes = groupPositions.map(position => {
      const existing = indexes.get(position.id);
      if (existing !== undefined) { return existing; }
      const index = positions.length;
      indexes.set(position.id, index);
      positions.push(position);
      return index;
    });
    return { ...details, positionIndexes };
  }
  return {
    ...snapshot,
    airlines: snapshot.airlines.map(compactGroup),
    unassignedAircraft: snapshot.unassignedAircraft && compactGroup(snapshot.unassignedAircraft),
    aircraftTypeRankings: snapshot.aircraftTypeRankings?.map(compactGroup),
    unknownAircraftType: snapshot.unknownAircraftType && compactGroup(snapshot.unknownAircraftType),
    positions,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function expandSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) || !Array.isArray(value['positions']) || !Array.isArray(value['airlines'])) {
    throw new Error('Invalid compact snapshot');
  }
  const positions: unknown[] = value['positions'];
  if (!positions.every(isAircraftPosition)) { throw new Error('Invalid aircraft positions'); }
  const ids = positions.map(position => (position as AircraftPosition).id);
  if (new Set(ids).size !== ids.length) { throw new Error('Duplicate aircraft positions'); }
  function expandGroup(group: unknown): unknown {
    if (!isRecord(group)) { throw new Error('Invalid aircraft group'); }
    if ('positions' in group) { throw new Error('Unexpected inline positions'); }
    const { positionIndexes, ...details } = group;
    if (positionIndexes === undefined) { return details; }
    if (!Array.isArray(positionIndexes) || new Set(positionIndexes).size !== positionIndexes.length) {
      throw new Error('Invalid position references');
    }
    const groupPositions = positionIndexes.map((index: unknown) => {
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= positions.length) {
        throw new Error('Invalid position reference');
      }
      return positions[index];
    });
    return { ...details, positions: groupPositions };
  }
  const types: unknown = value['aircraftTypeRankings'];
  if (types !== undefined && !Array.isArray(types)) { throw new Error('Invalid aircraft types'); }
  const details = { ...value };
  delete details['positions'];
  const snapshot = {
    ...details,
    airlines: value['airlines'].map(expandGroup),
    unassignedAircraft: value['unassignedAircraft'] === undefined ? undefined : expandGroup(value['unassignedAircraft']),
    aircraftTypeRankings: types?.map(expandGroup),
    unknownAircraftType: value['unknownAircraftType'] === undefined ? undefined : expandGroup(value['unknownAircraftType']),
  };
  if (!isSnapshot(snapshot)) { throw new Error('Invalid ranking response'); }
  return snapshot;
}
