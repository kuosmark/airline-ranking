export interface OperatorDetails {
  name: string | null;
  country: string | null;
  countryIso?: string | null;
  iata: string | null;
  icao: string | null;
}

const emptyDetails: OperatorDetails = { name: null, country: null, countryIso: null, iata: null, icao: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function operatorDetails(payload: unknown, prefix: string): OperatorDetails {
  if (!isRecord(payload) || !Array.isArray(payload['response'])) { throw new Error('Invalid ADSBDB response'); }
  const records: unknown[] = payload['response'];
  const matches = records.filter((entry): entry is Record<string, unknown> =>
    isRecord(entry) && entry['icao'] === prefix && typeof entry['name'] === 'string' && entry['name'].trim().length > 0);
  if (records.length > 0 && matches.length === 0) { throw new Error('Invalid ADSBDB match'); }
  const names = new Set(matches.map(entry => (entry['name'] as string).trim()));
  if (names.size !== 1) { return { ...emptyDetails }; }
  const name = [...names][0];
  const countries = new Set(matches.map(entry => entry['country'])
    .filter((country): country is string => typeof country === 'string' && country.trim().length > 0)
    .map(country => country.trim()));
  const countryCodes = new Set(matches.map(entry => entry['country_iso'])
    .filter((code): code is string => typeof code === 'string' && /^[A-Z]{2}$/.test(code)));
  const iataCodes = new Set(matches.map(entry => entry['iata'])
    .filter((code): code is string => typeof code === 'string' && /^[A-Z\d]{2}$/.test(code)));
  return {
    name,
    country: countries.size === 1 ? [...countries][0] : null,
    countryIso: countries.size === 1 && countryCodes.size === 1 ? [...countryCodes][0] : null,
    iata: iataCodes.size === 1 ? [...iataCodes][0] : null,
    icao: prefix,
  };
}

export async function fetchOperatorDetails(prefix: string): Promise<OperatorDetails> {
  const response = await fetch(`https://api.adsbdb.com/v0/airline/${prefix}`, {
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  if (response.status === 404) { return { ...emptyDetails }; }
  if (!response.ok) { throw new Error('ADSBDB lookup failed'); }
  const payload: unknown = await response.json();
  return operatorDetails(payload, prefix);
}
