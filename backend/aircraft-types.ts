import reference from './data/mictronics-aircraft-types.json' with { type: 'json' };

const typeReference = new Map(Object.entries(reference));
const codesByName = buildNameLookup();

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s-]+/g, '');
}

function buildNameLookup(): Map<string, string | null> {
  const codes = new Map<string, string | null>();
  for (const [code, name] of typeReference) {
    const normalizedName = normalizeName(name);
    // Duplicate names cannot reliably identify one ICAO code.
    codes.set(normalizedName, codes.has(normalizedName) ? null : code);
  }
  return codes;
}

export function resolveAircraftType(value: unknown): { id: string; name: string } | null {
  if (typeof value !== 'string' || !value.trim()) { return null; }
  // Prefer an explicit trailing code, then try a unique full reference name.
  const code = value.trim().split(/\s+/).at(-1)?.toUpperCase() ?? '';
  const name = typeReference.get(code);
  if (name) { return { id: code, name }; }
  const matchedCode = codesByName.get(normalizeName(value));
  if (!matchedCode) { return null; }
  const matchedName = typeReference.get(matchedCode);
  return matchedName ? { id: matchedCode, name: matchedName } : null;
}

export function aircraftTypeName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) { return 'Unknown type'; }
  return resolveAircraftType(value)?.name ?? value.trim();
}
