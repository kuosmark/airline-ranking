import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'reference', Path(__file__).resolve().parents[1] / 'scripts/update-aircraft-types.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
LICENSE = '# ODC Attribution License (ODC-By)'


class ReferenceUpdateTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.target = self.root / 'mictronics-aircraft-types.json'
        self.archive = self.root / 'export.zip'

    def write_archive(self, records, license_text=LICENSE):
        with zipfile.ZipFile(self.archive, 'w') as archive:
            archive.writestr('types.json', records)
            archive.writestr('LICENSE', license_text)

    def test_import_is_deterministic_and_excludes_generic_codes(self):
        self.write_archive(json.dumps({'B738': [' BOEING  737-800 ', 'L2J', 'M'],
                                       'BALL': ['', 'B0-', '-']}))
        reference.update(self.archive, self.root)
        first = self.target.read_bytes()
        reference.update(self.archive, self.root)
        self.assertEqual(first, self.target.read_bytes())
        self.assertEqual(json.loads(first), {'B738': 'BOEING 737-800'})

    def test_invalid_input_preserves_existing_reference(self):
        original = '{"B738": "BOEING 737-800"}\n'
        self.target.write_text(original)
        for records in ['{}', '[]', '{"B738":["", "L2J", "M"]}',
                        '{"B738":["Boeing","L2J","M"],"B738":["Other","L2J","M"]}',
                        '{"BADCODE":["Boeing","L2J","M"]}',
                        '{"A320":["AIRBUS A-320","L2J","M"]}']:
            with self.subTest(records=records):
                self.write_archive(records)
                with self.assertRaises(ValueError):
                    reference.update(self.archive, self.root)
                self.assertEqual(self.target.read_text(), original)

    def test_changed_license_requires_review(self):
        self.write_archive('{"B738":["BOEING 737-800","L2J","M"]}')
        reference.update(self.archive, self.root)
        original = self.target.read_bytes()
        self.write_archive('{"B738":["New name","L2J","M"]}', LICENSE + ' changed')
        with self.assertRaises(ValueError):
            reference.update(self.archive, self.root)
        self.assertEqual(self.target.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
