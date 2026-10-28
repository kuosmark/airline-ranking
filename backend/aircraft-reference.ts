import { createHash } from 'node:crypto';
import classifications from './data/mictronics-aircraft-classifications.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import names from './data/mictronics-aircraft-types.json' with { type: 'json' };

// Lambda supplies its package root; local commands run from the repository root.
const path = join(process.env['LAMBDA_TASK_ROOT'] ?? 'backend', 'data/mictronics-aircraft.json');
function loadReference() {
  const data = readFileSync(path, 'utf8');
  return {
    aircraft: JSON.parse(data) as Partial<Record<string, [string, string]>>,
    version: createHash('sha256').update(data).update(JSON.stringify(names)).update(JSON.stringify(classifications)).digest('hex'),
  };
}
const { aircraft, version } = loadReference();
export const aircraftReferenceVersion = version;
const typeNames: Partial<Record<string, string>> = names;

export function aircraftReferenceType(id: string, registration: string): { id: string; name: string } | null {
  const entry = aircraft[id];
  if (!entry) { return null; }
  const [code, referenceRegistration] = entry;
  if (registration && referenceRegistration && registration !== referenceRegistration) { return null; }
  const name = typeNames[code];
  return name ? { id: code, name } : null;
}
