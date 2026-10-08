export function countryFlag(countryIso: string | null | undefined): string {
  if (!countryIso || !/^[A-Z]{2}$/.test(countryIso)) { return ''; }
  const regionalIndicatorStart = 0x1f1e6;
  const letterA = 'A'.charCodeAt(0);
  const firstLetter = regionalIndicatorStart + countryIso.charCodeAt(0) - letterA;
  const secondLetter = regionalIndicatorStart + countryIso.charCodeAt(1) - letterA;
  return String.fromCodePoint(firstLetter, secondLetter);
}
