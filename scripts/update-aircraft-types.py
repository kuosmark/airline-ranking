"""Import only type names from the Mictronics indexedDB export (standard library only)."""
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


def update(archive_path, data_dir=DATA):
    target = data_dir / 'mictronics-aircraft-types.json'
    license_path = data_dir / 'mictronics-LICENSE.txt'
    with zipfile.ZipFile(archive_path) as archive:
        names = read_names(archive)
        license_text = archive.read('LICENSE').decode('utf-8')
    if license_path.exists() and license_path.read_text() != license_text:
        raise ValueError('Upstream licence changed; review it before updating')
    if 'ODC Attribution License (ODC-By)' not in license_text:
        raise ValueError('Expected the ODC Attribution licence')
    previous = json.loads(target.read_text()) if target.exists() else {}
    removed = previous.keys() - names.keys()
    if previous and len(removed) > len(previous) * 0.05:
        raise ValueError('More than 5% of existing codes removed; review the source')
    added = names.keys() - previous.keys()
    changed = [code for code in names.keys() & previous.keys() if names[code] != previous[code]]
    print(f'{len(names)} types: {len(added)} added, {len(removed)} removed, {len(changed)} renamed')
    target.write_text(json.dumps(names, indent=2, ensure_ascii=False) + '\n')
    license_path.write_text(license_text)


if __name__ == '__main__':
    update(sys.argv[1])
