"""Import type names and aircraft identities from the Mictronics indexedDB export (standard library only)."""
import json
import re
import sys
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'backend' / 'data'
GENERIC_CODES = {'BALL', 'GLID', 'GLIM', 'GYRO', 'SHIP', 'UHEL', 'ULAC', 'ZZZZ',
                 'DRON', 'EMER', 'FFLO', 'GND', 'PARA', 'SERV', 'TWR', 'VFHC'}


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate code: {key}')
        result[key] = value
    return result


def read_names(archive):
    records = json.loads(archive.read('types.json'), object_pairs_hook=unique_pairs)
    if not isinstance(records, dict) or not records:
        raise ValueError('Expected a nonempty type dictionary')
    names = {}
    for code, fields in records.items():
        if not re.fullmatch(r'[A-Z0-9]{2,4}', code):
            raise ValueError(f'Invalid type code: {code}')
        if not isinstance(fields, list) or len(fields) != 3:
            raise ValueError(f'Invalid type entry: {code}')
        if code in GENERIC_CODES:
            continue
        name = fields[0]
        if not isinstance(name, str) or not name.strip() or len(name) > 200:
            raise ValueError(f'Invalid type name: {code}')
        names[code] = ' '.join(name.split())
    return dict(sorted(names.items()))


def read_aircraft(archive, names):
    records = json.loads(archive.read('aircrafts.json'), object_pairs_hook=unique_pairs)
    if not isinstance(records, dict) or not records:
        raise ValueError('Expected a nonempty aircraft dictionary')
    aircraft = {}
    seen = set()
    for address, fields in records.items():
        if not re.fullmatch(r'[A-Fa-f0-9]{6}', address):
            raise ValueError(f'Invalid ICAO24 address: {address}')
        address = address.lower()
        if address in seen:
            raise ValueError(f'Duplicate ICAO24 address: {address}')
        seen.add(address)
        if not isinstance(fields, list) or len(fields) not in (3, 4) or not all(isinstance(field, str) for field in fields):
            raise ValueError(f'Invalid aircraft entry: {address}')
        registration, code = fields[:2]
        if code not in names:
            continue
        aircraft[address] = [code, re.sub(r'[-\s]', '', registration).upper()]
    if not aircraft:
        raise ValueError('No aircraft with recognized types')
    return dict(sorted(aircraft.items()))


def report_changes(target, records, label):
    previous = json.loads(target.read_text()) if target.exists() else {}
    removed = previous.keys() - records.keys()
    if previous and len(removed) > len(previous) * 0.05:
        raise ValueError(f'More than 5% of existing {label} removed; review the source')
    added = records.keys() - previous.keys()
    changed = [key for key in records.keys() & previous.keys() if records[key] != previous[key]]
    print(f'{len(records)} {label}: {len(added)} added, {len(removed)} removed, {len(changed)} changed')


def update(archive_path, data_dir=DATA):
    target = data_dir / 'mictronics-aircraft-types.json'
    aircraft_target = data_dir / 'mictronics-aircraft.json'
    license_path = data_dir / 'mictronics-LICENSE.txt'
    with zipfile.ZipFile(archive_path) as archive:
        names = read_names(archive)
        aircraft = read_aircraft(archive, names)
        license_text = archive.read('LICENSE').decode('utf-8')
    if license_path.exists() and license_path.read_text() != license_text:
        raise ValueError('Upstream licence changed; review it before updating')
    if 'ODC Attribution License (ODC-By)' not in license_text:
        raise ValueError('Expected the ODC Attribution licence')
    report_changes(target, names, 'types')
    report_changes(aircraft_target, aircraft, 'aircraft')
    target.write_text(json.dumps(names, indent=2, ensure_ascii=False) + '\n')
    lines = [json.dumps(key) + ': ' + json.dumps(value) for key, value in aircraft.items()]
    aircraft_target.write_text('{\n' + ',\n'.join(lines) + '\n}\n')
    license_path.write_text(license_text)


if __name__ == '__main__':
    update(sys.argv[1])
