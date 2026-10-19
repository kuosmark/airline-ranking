import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { update } from '../scripts/update-aircraft-types.ts';

const license = '# ODC Attribution License (ODC-By)';
const types = '{"B738":["BOEING 737-800","L2J","M"]}';
const aircraft = '{"ABC123":["N-123","B738","00"]}';
const files = ['mictronics-aircraft-types.json', 'mictronics-aircraft.json', 'mictronics-LICENSE.txt'];

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'aircraft-reference-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  mkdirSync(source);
  const archive = join(root, 'export.zip');
  return {
    root,
    write(typeText = types, aircraftText = aircraft, licenseText = license) {
      writeFileSync(join(source, 'types.json'), typeText);
      writeFileSync(join(source, 'aircrafts.json'), aircraftText);
      writeFileSync(join(source, 'LICENSE'), licenseText);
      rmSync(archive, { force: true });
      execFileSync('zip', ['-q', archive, 'types.json', 'aircrafts.json', 'LICENSE'], { cwd: source });
    },
    update: () => update(archive, root),
    contents: () => files.map(file => existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null),
  };
}

test('reference import is deterministic, sorted and excludes generic codes', t => {
  const f = fixture(t);
  f.write('{"B738":[" BOEING  737-800 ","L2J","M"],"BALL":["","B0-","-"]}',
    '{"ABC123":["N123","B738","00"],"100000":["N2","B738","00"],"000001":["N1","B738","00"]}');
  f.update();
  const first = f.contents();
  f.update();
  assert.deepEqual(f.contents(), first);
  assert.equal(first[0], '{\n  "B738": "BOEING 737-800"\n}\n');
  assert.equal(first[1], '{\n"000001": ["B738", "N1"],\n"100000": ["B738", "N2"],\n"abc123": ["B738", "N123"]\n}\n');
});

test('invalid type input preserves all existing reference files', t => {
  const f = fixture(t);
  f.write(); f.update();
  const original = f.contents();
  for (const records of ['{}', '[]', '{"B738":["","L2J","M"]}',
    '{"B738":["Boeing","L2J","M"],"B738":["Other","L2J","M"]}',
    '{"B738":["Boeing","L2J","M"],"B\\u003738":["Other","L2J","M"]}',
    '{"BADCODE":["Boeing","L2J","M"]}', '{"A320":["AIRBUS A-320","L2J","M"]}',
    '{"B738":["Boeing","L2J","M"],}', '// comment\n' + types]) {
    f.write(records);
    assert.throws(f.update);
    assert.deepEqual(f.contents(), original);
  }
});

test('aircraft validation normalizes addresses and registrations without replacing files on failure', t => {
  const f = fixture(t);
  f.write(types, '{"ABC123":[" n-123 ","B738","00",""],"000001":["N1","ZZZZ","00"]}');
  f.update();
  const original = f.contents();
  assert.deepEqual(JSON.parse(original[1]), { abc123: ['B738', 'N123'] });
  for (const records of ['{}', '{"NOTHEX":["N1","B738","00"]}', '{"abc123":[null,"B738","00"]}',
    '{"ABC123":["N1","B738","00"],"abc123":["N1","B738","00"]}',
    '{"ABC123":["N1","B738","00"],"ABC123":["N2","B738","00"]}',
    '{"000002":["N1","B738","00"]}']) {
    f.write(types, records);
    assert.throws(f.update);
    assert.deepEqual(f.contents(), original);
  }
});

test('changed or unexpected licence prevents reference updates', t => {
  const f = fixture(t);
  f.write(types, aircraft, 'Unknown licence');
  assert.throws(f.update);
  assert.deepEqual(f.contents(), [null, null, null]);
  f.write(); f.update();
  const original = f.contents();
  for (const changedLicense of [license + ' changed', '\ufeff' + license]) {
    f.write('{"B738":["New name","L2J","M"]}', aircraft, changedLicense);
    assert.throws(f.update);
    assert.deepEqual(f.contents(), original);
  }
});
