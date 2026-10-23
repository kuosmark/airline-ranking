const categories: Readonly<Record<string, string>> = {
  L: 'Landplane', S: 'Seaplane', A: 'Amphibian', H: 'Helicopter', G: 'Gyrocopter', R: 'Tiltrotor', W: 'Tiltwing',
};
const engineTypes: Readonly<Record<string, string>> = {
  J: 'jet', P: 'piston', E: 'electric', R: 'rocket',
};

export function aircraftCategory(classification?: string): string {
  return categories[classification?.[0] ?? ''] ?? 'Unavailable';
}

export function aircraftEngines(classification?: string): string {
  if (!classification || !/^[A-Z][1-9][A-Z]$/.test(classification)) { return 'Unavailable'; }
  const [category, count, engine] = classification;
  let engineType = engineTypes[engine];
  if (engine === 'T') {
    if (['L', 'S', 'A'].includes(category)) { engineType = 'turboprop'; }
    if (['H', 'G', 'R', 'W'].includes(category)) { engineType = 'turboshaft'; }
  }
  if (!engineType) { return 'Unavailable'; }
  return `${count} ${engineType} ${count === '1' ? 'engine' : 'engines'}`;
}

export function availableAircraftCategories(
  types: readonly { classification?: string; count: number }[],
  selected = '',
): Set<string> {
  const available = new Set(types.filter(type => type.count > 0).map(type => aircraftCategory(type.classification)));
  available.delete('Unavailable');
  if (selected) { available.add(selected); }
  return available;
}
