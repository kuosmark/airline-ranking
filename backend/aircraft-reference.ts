import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import names from './data/mictronics-aircraft-types.json' with { type: 'json' };

// Lambda supplies its package root; local commands run from the repository root.
const path = join(process.env['LAMBDA_TASK_ROOT'] ?? 'backend', 'data/mictronics-aircraft.json');
const aircraft = JSON.parse(readFileSync(path, 'utf8')) as Partial<Record<string, [string, string]>>;
const typeNames: Partial<Record<string, string>> = names;

export function aircraftReferenceType(id: string, registration: string): { id: string; name: string } | null {
  const entry = aircraft[id];
  if (!entry) { return null; }
  const [code, referenceRegistration] = entry;
  if (registration && referenceRegistration && registration !== referenceRegistration) { return null; }
  const name = typeNames[code];
  return name ? { id: code, name } : null;
}
