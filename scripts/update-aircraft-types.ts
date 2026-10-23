import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visit } from 'jsonc-parser';

const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../backend/data');
const genericCodes = new Set(['BALL', 'GLID', 'GLIM', 'GYRO', 'SHIP', 'UHEL', 'ULAC', 'ZZZZ',
  'DRON', 'EMER', 'FFLO', 'GND', 'PARA', 'SERV', 'TWR', 'VFHC']);

function readMember(archive: string, name: string): string {
  const bytes = execFileSync('unzip', ['-p', resolve(archive), name], { maxBuffer: 256 * 1024 * 1024 });
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

function readRecords(text: string): Record<string, unknown> {
  const objects: Set<string>[] = [];
  visit(text, {
    onObjectBegin: () => { objects.push(new Set()); },
    onObjectProperty: key => {
      const keys = objects[objects.length - 1];
      if (keys.has(key)) { throw new Error(`Duplicate code: ${key}`); }
      keys.add(key);
    },
    onObjectEnd: () => { objects.pop(); },
    onError: () => { throw new Error('Invalid reference JSON'); },
  }, { disallowComments: true, allowTrailingComma: false });
  const records: unknown = JSON.parse(text);
  if (typeof records !== 'object' || records === null || Array.isArray(records) || Object.keys(records).length === 0) {
    throw new Error('Expected a nonempty reference dictionary');
  }
  return records as Record<string, unknown>;
}

function readNames(text: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const [code, fields] of Object.entries(readRecords(text))) {
    if (!/^[A-Z0-9]{2,4}$/.test(code)) { throw new Error(`Invalid type code: ${code}`); }
    if (!Array.isArray(fields) || fields.length !== 3) { throw new Error(`Invalid type entry: ${code}`); }
    if (genericCodes.has(code)) { continue; }
    const name: unknown = fields[0];
    if (typeof name !== 'string' || !name.trim() || name.length > 200) { throw new Error(`Invalid type name: ${code}`); }
    names.set(code, name.trim().split(/\s+/).join(' '));
  }
  return names;
}

function readClassifications(text: string, names: Map<string, string>): Map<string, string> {
  const classifications = new Map<string, string>();
  for (const [code, fields] of Object.entries(readRecords(text))) {
    if (!names.has(code)) { continue; }
    const classification: unknown = (fields as unknown[])[1];
    if (typeof classification !== 'string' || !/^[A-Z-][A-Z0-9][A-Z-]$/.test(classification)) {
      throw new Error(`Invalid aircraft classification: ${code}`);
    }
    classifications.set(code, classification);
  }
  return classifications;
}

function readAircraft(text: string, names: Map<string, string>): Map<string, [string, string]> {
  const aircraft = new Map<string, [string, string]>();
  const seen = new Set<string>();
  for (const [rawAddress, fields] of Object.entries(readRecords(text))) {
    if (!/^[A-Fa-f0-9]{6}$/.test(rawAddress)) { throw new Error(`Invalid ICAO24 address: ${rawAddress}`); }
    const address = rawAddress.toLowerCase();
    if (seen.has(address)) { throw new Error(`Duplicate ICAO24 address: ${address}`); }
    seen.add(address);
    if (!Array.isArray(fields) || ![3, 4].includes(fields.length) || !fields.every((field: unknown) => typeof field === 'string')) {
      throw new Error(`Invalid aircraft entry: ${address}`);
    }
    const [registration, code] = fields;
    if (!names.has(code)) { continue; }
    aircraft.set(address, [code, registration.replace(/[-\s]/g, '').toUpperCase()]);
  }
  if (aircraft.size === 0) { throw new Error('No aircraft with recognized types'); }
  return aircraft;
}

function reportChanges(target: string, records: Map<string, unknown>, label: string): void {
  const previous = existsSync(target) ? readRecords(readFileSync(target, 'utf8')) : {};
  const previousKeys = Object.keys(previous);
  const removed = previousKeys.filter(key => !records.has(key));
  if (removed.length > previousKeys.length * 0.05) { throw new Error(`More than 5% of existing ${label} removed; review the source`); }
  const added = [...records.keys()].filter(key => !Object.hasOwn(previous, key));
  const changed = [...records].filter(([key, value]) => Object.hasOwn(previous, key) && JSON.stringify(previous[key]) !== JSON.stringify(value));
  console.log(`${records.size} ${label}: ${added.length} added, ${removed.length} removed, ${changed.length} changed`);
}

function sortedEntries<T>(records: Map<string, T>): [string, T][] {
  return [...records].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
}

// Retain the existing aircraft file's ASCII escaping to avoid formatting-only updates.
function asciiJson(value: string): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, character =>
    '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function update(archive: string, directory = dataDirectory): void {
  const target = join(directory, 'mictronics-aircraft-types.json');
  const aircraftTarget = join(directory, 'mictronics-aircraft.json');
  const licensePath = join(directory, 'mictronics-LICENSE.txt');
  const names = readNames(readMember(archive, 'types.json'));
  const aircraft = readAircraft(readMember(archive, 'aircrafts.json'), names);
  const license = readMember(archive, 'LICENSE');
  if (existsSync(licensePath) && readFileSync(licensePath, 'utf8') !== license) { throw new Error('Upstream licence changed; review it before updating'); }
  if (!license.includes('ODC Attribution License (ODC-By)')) { throw new Error('Expected the ODC Attribution licence'); }
  reportChanges(target, names, 'types');
  reportChanges(aircraftTarget, aircraft, 'aircraft');
  // Explicit sorting also preserves lexical order for all-numeric ICAO24 keys.
  const classifications = readClassifications(readMember(archive, 'types.json'), names);
  const classificationText = JSON.stringify(Object.fromEntries(sortedEntries(classifications)), null, 2) + '\n';
  const nameLines = sortedEntries(names).map(([code, name]) => `  ${JSON.stringify(code)}: ${JSON.stringify(name)}`);
  const aircraftLines = sortedEntries(aircraft).map(([address, [code, registration]]) =>
    `${JSON.stringify(address)}: [${JSON.stringify(code)}, ${asciiJson(registration)}]`);
  writeFileSync(join(directory, 'mictronics-aircraft-classifications.json'), classificationText);
  writeFileSync(target, `{\n${nameLines.join(',\n')}\n}\n`);
  writeFileSync(aircraftTarget, `{\n${aircraftLines.join(',\n')}\n}\n`);
  writeFileSync(licensePath, license);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const archive = process.argv[2];
  if (!archive) { throw new Error('Usage: update-aircraft-types.ts ARCHIVE.zip'); }
  update(archive);
}
