import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryFlag } from '../src/country-flag.ts';

test('converts country and territory ISO codes to flag emojis', () => {
  assert.equal(countryFlag('FI'), '🇫🇮');
  assert.equal(countryFlag('US'), '🇺🇸');
  assert.equal(countryFlag('HK'), '🇭🇰');
});

test('omits flags for missing or malformed country codes', () => {
  for (const code of [undefined, null, '', 'fi', 'FIN', ' F', '12']) {
    assert.equal(countryFlag(code), '');
  }
});
